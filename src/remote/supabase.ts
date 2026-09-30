import type { SupabaseClient } from "@supabase/supabase-js";
import {
	AccountGoneError,
	type AccountState,
	NEWEST_RUNS,
	type Provider,
	type Remote,
	type SyncedRows,
} from "./remote";
import {
	type BestRow,
	type CodexRow,
	type DailyRow,
	fromRows,
	type PreferencesRow,
	type RunRow,
	toRows,
} from "./rows";

const ERROR_KEYS = ["error", "error_code", "error_description"];
const DEFAULT_ERROR = "Sign-in did not complete.";

function authStorageKey(url: string): string {
	return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
}

export function hasStoredSignIn(
	url: string,
	storage: Pick<Storage, "getItem">,
): boolean {
	try {
		return storage.getItem(authStorageKey(url)) !== null;
	} catch {
		return false;
	}
}

function paramsOf(part: string): URLSearchParams {
	return new URLSearchParams(part.replace(/^[?#]/, ""));
}

export function parseAuthRedirect(
	search: string,
	hash: string,
): { hasResult: boolean; error: string | null } {
	let hasResult = false;
	let error: string | null = null;
	for (const params of [paramsOf(search), paramsOf(hash)]) {
		if (params.has("code") || params.has("access_token")) {
			hasResult = true;
		}
		if (error === null && params.has("error")) {
			const description = (params.get("error_description") ?? "")
				.replace(/\s+/g, " ")
				.trim();
			error = description === "" ? DEFAULT_ERROR : description;
		}
	}
	return { hasResult, error };
}

export function stripAuthError(
	search: string,
	hash: string,
): { search: string; hash: string } {
	function strip(part: string, prefix: "?" | "#"): string {
		const params = paramsOf(part);
		for (const key of ERROR_KEYS) {
			params.delete(key);
		}
		const text = params.toString();
		return text === "" ? "" : `${prefix}${text}`;
	}
	return { search: strip(search, "?"), hash: strip(hash, "#") };
}

const PAGE_SIZE = 1000;
const PUSH_CHUNK = 500;

function errorCode(error: unknown): string | undefined {
	return (error as { code?: string } | null)?.code;
}

// A network failure or a server error: the sign-in may still be good.
function isRetryableAuthError(error: unknown): boolean {
	const { name, status } = error as { name?: string; status?: number };
	return (
		name === "AuthRetryableFetchError" ||
		status === 0 ||
		(typeof status === "number" && status >= 500)
	);
}

const CONFLICT_COLUMNS = {
	codex_entries: "account_id,entry_id",
	blitz_bests: "account_id,category,orientation,mode",
	blitz_runs: "account_id,ended_at",
	dailies: "account_id,category,day",
	preferences: "account_id",
} as const;

// Reads a whole table in pages, ordered by primary key so no page skips or
// repeats a row.
async function readAll<T>(
	supabase: SupabaseClient,
	table: string,
	order: string[],
): Promise<T[]> {
	const all: T[] = [];
	for (let from = 0; ; from += PAGE_SIZE) {
		let query = supabase.from(table).select("*");
		for (const column of order) {
			query = query.order(column);
		}
		const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
		if (error) {
			throw error;
		}
		const page = (data ?? []) as T[];
		all.push(...page);
		if (page.length < PAGE_SIZE) {
			return all;
		}
	}
}

type Library = typeof import("@supabase/supabase-js");

// Browser globals and the library import, injectable so tests need no jsdom
// URL tricks or module mocks.
type Deps = {
	storage: Pick<Storage, "getItem" | "removeItem">;
	location: Pick<Location, "pathname" | "search" | "hash" | "origin">;
	history: Pick<History, "replaceState">;
	baseUrl: string;
	loadLibrary: () => Promise<Library>;
};

export function createSupabaseRemote(
	options: { url: string; anonKey: string },
	deps: Partial<Deps> = {},
): Remote {
	const { url, anonKey } = options;
	const storage = deps.storage ?? window.localStorage;
	const location = deps.location ?? window.location;
	const history = deps.history ?? window.history;
	const baseUrl = deps.baseUrl ?? import.meta.env.BASE_URL;
	const loadLibrary =
		deps.loadLibrary ?? (() => import("@supabase/supabase-js"));

	const redirect = parseAuthRedirect(location.search, location.hash);
	let pendingError = redirect.error;
	if (redirect.error !== null) {
		const stripped = stripAuthError(location.search, location.hash);
		history.replaceState(
			null,
			"",
			`${location.pathname}${stripped.search}${stripped.hash}`,
		);
	}

	let client: Promise<SupabaseClient> | null = null;
	function loadClient(): Promise<SupabaseClient> {
		client ??= loadLibrary()
			.then(({ createClient }) =>
				createClient(url, anonKey, {
					auth: {
						flowType: "pkce",
						storageKey: authStorageKey(url),
						detectSessionInUrl: true,
						persistSession: true,
					},
				}),
			)
			.catch((error: unknown) => {
				client = null;
				throw error;
			});
		return client;
	}

	async function updateOwnAccount(fields: {
		display_name: string;
		name_confirmed?: true;
	}): Promise<void> {
		const supabase = await loadClient();
		const { data, error } = await supabase.auth.getSession();
		if (error || !data.session) {
			throw error ?? new Error("Not signed in");
		}
		const { data: rows, error: updateError } = await supabase
			.from("accounts")
			.update(fields)
			.eq("id", data.session.user.id)
			.select("id");
		if (updateError) {
			throw updateError;
		}
		// A policy that filters the row updates nothing without an error.
		if (!rows || rows.length === 0) {
			throw new Error("Account row not updated");
		}
	}

	return {
		async getAccount(): Promise<AccountState> {
			if (!redirect.hasResult && !hasStoredSignIn(url, storage)) {
				return { status: "signedOut" };
			}
			const supabase = await loadClient();
			const { data, error } = await supabase.auth.getSession();
			if (error) {
				if (errorCode(error) === "user_not_found") {
					throw new AccountGoneError();
				}
				if (isRetryableAuthError(error)) {
					throw error;
				}
				return { status: "signedOut" };
			}
			if (!data.session) {
				return { status: "signedOut" };
			}
			const accountId = data.session.user.id;
			const { data: row, error: rowError } = await supabase
				.from("accounts")
				.select("display_name, name_confirmed")
				.eq("id", accountId)
				.single();
			// Deleting an account cascades its row away; `.single()` then finds
			// no row.
			if (errorCode(rowError) === "PGRST116") {
				throw new AccountGoneError();
			}
			if (rowError || !row) {
				throw rowError ?? new Error("Account row missing");
			}
			const account = row as { display_name: string; name_confirmed: boolean };
			return {
				status: "signedIn",
				accountId,
				displayName: account.display_name,
				nameConfirmed: account.name_confirmed,
			};
		},
		async signIn(provider: Provider): Promise<void> {
			const supabase = await loadClient();
			const { error } = await supabase.auth.signInWithOAuth({
				provider,
				options: { redirectTo: `${location.origin}${baseUrl}` },
			});
			if (error) {
				throw error;
			}
		},
		async signOut(): Promise<void> {
			let supabase: SupabaseClient;
			try {
				supabase = await loadClient();
			} catch {
				storage.removeItem(authStorageKey(url));
				return;
			}
			const { error } = await supabase.auth.signOut({ scope: "local" });
			if (error) {
				throw error;
			}
		},
		confirmDisplayName: (name) =>
			updateOwnAccount({ display_name: name, name_confirmed: true }),
		changeDisplayName: (name) => updateOwnAccount({ display_name: name }),
		async pull(): Promise<SyncedRows> {
			const supabase = await loadClient();
			const [codex, bests, dailies, preferences, runsResult] =
				await Promise.all([
					readAll<CodexRow>(supabase, "codex_entries", ["entry_id"]),
					readAll<BestRow>(supabase, "blitz_bests", [
						"category",
						"orientation",
						"mode",
					]),
					readAll<DailyRow>(supabase, "dailies", ["category", "day"]),
					readAll<PreferencesRow>(supabase, "preferences", ["account_id"]),
					supabase
						.from("blitz_runs")
						.select("*")
						.order("ended_at", { ascending: false })
						.limit(NEWEST_RUNS),
				]);
			if (runsResult.error) {
				throw runsResult.error;
			}
			return fromRows({
				codex,
				bests,
				dailies,
				preferences: preferences[0] ?? null,
				runs: (runsResult.data ?? []) as RunRow[],
			});
		},
		async push(accountId: string, rows: SyncedRows): Promise<void> {
			const supabase = await loadClient();
			// Row-level security refuses rows when the stored sign-in belongs to
			// another account.
			const tables = toRows(accountId, rows);
			for (const [table, onConflict] of Object.entries(CONFLICT_COLUMNS)) {
				const records: unknown[] = tables[table as keyof typeof tables];
				for (let start = 0; start < records.length; start += PUSH_CHUNK) {
					const { error: upsertError } = await supabase
						.from(table)
						.upsert(records.slice(start, start + PUSH_CHUNK), {
							onConflict,
						});
					if (upsertError) {
						// A foreign-key violation means the account row is gone.
						if (errorCode(upsertError) === "23503") {
							throw new AccountGoneError();
						}
						throw upsertError;
					}
				}
			}
		},
		redirectError: () => pendingError,
		clearRedirectError() {
			pendingError = null;
		},
		preload() {
			loadClient().catch(() => {});
		},
	};
}
