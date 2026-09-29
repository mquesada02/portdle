import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountState, Provider, Remote } from "./remote";

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

	return {
		async getAccount(): Promise<AccountState> {
			if (!redirect.hasResult && !hasStoredSignIn(url, storage)) {
				return { status: "signedOut" };
			}
			const supabase = await loadClient();
			const { data, error } = await supabase.auth.getSession();
			if (error || !data.session) {
				return { status: "signedOut" };
			}
			const accountId = data.session.user.id;
			const { data: row, error: rowError } = await supabase
				.from("accounts")
				.select("display_name, name_confirmed")
				.eq("id", accountId)
				.single();
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
		redirectError: () => pendingError,
		clearRedirectError() {
			pendingError = null;
		},
		preload() {
			loadClient().catch(() => {});
		},
	};
}
