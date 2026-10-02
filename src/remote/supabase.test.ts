import { expect, test, vi } from "vitest";
import { AccountGoneError } from "./remote";
import {
	createSupabaseRemote,
	hasStoredSignIn,
	parseAuthRedirect,
	stripAuthError,
} from "./supabase";

const URL = "https://abcdef.supabase.co";
const KEY = "sb-abcdef-auth-token";

test("hasStoredSignIn finds the library's stored sign-in key by host label", () => {
	expect(
		hasStoredSignIn(URL, { getItem: (k) => (k === KEY ? "{}" : null) }),
	).toBe(true);
	expect(hasStoredSignIn(URL, { getItem: () => null })).toBe(false);
	expect(
		hasStoredSignIn("https://other.supabase.co", {
			getItem: (k) => (k === KEY ? "{}" : null),
		}),
	).toBe(false);
});

test("hasStoredSignIn counts a throwing storage as no stored sign-in", () => {
	expect(
		hasStoredSignIn(URL, {
			getItem: () => {
				throw new Error("blocked");
			},
		}),
	).toBe(false);
});

test("parseAuthRedirect reads an error from the query or the hash", () => {
	expect(
		parseAuthRedirect("?error=access_denied&error_description=User+denied", ""),
	).toEqual({ hasResult: false, error: "User denied" });
	expect(
		parseAuthRedirect("", "#error=server_error&error_description=No%20email"),
	).toEqual({ hasResult: false, error: "No email" });
});

test("parseAuthRedirect gives a default line for an error without a description", () => {
	expect(parseAuthRedirect("?error=access_denied", "").error).toBe(
		"Sign-in did not complete.",
	);
});

test("parseAuthRedirect collapses whitespace in the description", () => {
	expect(
		parseAuthRedirect("?error=x&error_description=a%0A%20%20b", "").error,
	).toBe("a b");
});

test("parseAuthRedirect treats code and access_token as a result, not an error", () => {
	expect(parseAuthRedirect("?code=abc", "")).toEqual({
		hasResult: true,
		error: null,
	});
	expect(parseAuthRedirect("", "#access_token=t&type=bearer")).toEqual({
		hasResult: true,
		error: null,
	});
	expect(parseAuthRedirect("", "")).toEqual({ hasResult: false, error: null });
});

test("parseAuthRedirect does not treat an error alone as a result", () => {
	expect(parseAuthRedirect("?error=access_denied", "").hasResult).toBe(false);
});

test("stripAuthError removes the three error keys and keeps the rest", () => {
	expect(
		stripAuthError(
			"?error=a&error_code=b&error_description=c&code=z&keep=1",
			"#error=a&error_description=c&x=2",
		),
	).toEqual({ search: "?code=z&keep=1", hash: "#x=2" });
	expect(stripAuthError("?error=a", "#error=a")).toEqual({
		search: "",
		hash: "",
	});
});

type FakeClient = {
	auth: {
		getSession: () => Promise<unknown>;
		signInWithOAuth: (o: unknown) => Promise<{ error: Error | null }>;
		signOut: (o: unknown) => Promise<{ error: Error | null }>;
	};
	from: (table: string) => unknown;
	rpc: (name: string) => Promise<{ error: Error | null }>;
};

function fakeClient(overrides: Partial<FakeClient["auth"]> = {}): FakeClient {
	return {
		rpc: async () => ({ error: null }),
		auth: {
			getSession: async () => ({
				data: { session: { user: { id: "u1" } } },
				error: null,
			}),
			signInWithOAuth: async () => ({ error: null }),
			signOut: async () => ({ error: null }),
			...overrides,
		},
		from: () => ({
			select: () => ({
				eq: () => ({
					single: async () => ({
						data: { display_name: "Ada", name_confirmed: true },
						error: null,
					}),
				}),
			}),
		}),
	};
}

function makeRemote(
	options: {
		client?: FakeClient;
		stored?: boolean;
		search?: string;
		hash?: string;
		loadFails?: boolean;
	} = {},
) {
	const removed: string[] = [];
	const replaced: string[] = [];
	const createClient = vi.fn(() => options.client ?? fakeClient());
	const loadLibrary = vi.fn(async () => {
		if (options.loadFails) {
			throw new Error("offline");
		}
		return { createClient } as never;
	});
	const remote = createSupabaseRemote(
		{ url: URL, anonKey: "anon" },
		{
			storage: {
				getItem: (k) => (options.stored && k === KEY ? "{}" : null),
				removeItem: (k) => {
					removed.push(k);
				},
			},
			location: {
				pathname: "/portdle/",
				search: options.search ?? "",
				hash: options.hash ?? "",
				origin: "https://site.example",
			},
			history: {
				replaceState: (_s, _t, u) => {
					replaced.push(String(u));
				},
			},
			baseUrl: "/portdle/",
			loadLibrary,
		},
	);
	return { remote, loadLibrary, createClient, removed, replaced };
}

test("getAccount is signed out without loading the library when there is no stored sign-in and no result", async () => {
	const { remote, loadLibrary } = makeRemote();
	expect(await remote.getAccount()).toEqual({ status: "signedOut" });
	expect(loadLibrary).not.toHaveBeenCalled();
});

test("getAccount loads nothing for a redirect error alone", async () => {
	const { remote, loadLibrary } = makeRemote({
		search: "?error=access_denied",
	});
	expect(await remote.getAccount()).toEqual({ status: "signedOut" });
	expect(loadLibrary).not.toHaveBeenCalled();
});

test("getAccount reads the account row when a stored sign-in exists", async () => {
	const { remote, createClient } = makeRemote({ stored: true });
	expect(await remote.getAccount()).toEqual({
		status: "signedIn",
		accountId: "u1",
		displayName: "Ada",
		nameConfirmed: true,
	});
	expect(createClient).toHaveBeenCalledOnce();
});

test("getAccount is signed out when a redirect result yields an error or no session", async () => {
	const noSession = makeRemote({
		search: "?code=abc",
		client: fakeClient({
			getSession: async () => ({ data: { session: null }, error: null }),
		}),
	});
	expect(await noSession.remote.getAccount()).toEqual({ status: "signedOut" });
	const errored = makeRemote({
		search: "?code=abc",
		client: fakeClient({
			getSession: async () => ({
				data: { session: null },
				error: new Error("exchange failed"),
			}),
		}),
	});
	expect(await errored.remote.getAccount()).toEqual({ status: "signedOut" });
});

test("getAccount rejects when the account row cannot be read", async () => {
	const client = fakeClient();
	client.from = () => ({
		select: () => ({
			eq: () => ({
				single: async () => ({ data: null, error: new Error("boom") }),
			}),
		}),
	});
	const { remote } = makeRemote({ stored: true, client });
	await expect(remote.getAccount()).rejects.toThrow();
});

test("a redirect error is kept once, stripped from the address, and cleared on request", () => {
	const { remote, replaced } = makeRemote({
		search: "?error=access_denied&error_description=Denied&keep=1",
		hash: "#error=x",
	});
	expect(replaced).toEqual(["/portdle/?keep=1"]);
	expect(remote.redirectError()).toBe("Denied");
	expect(remote.redirectError()).toBe("Denied");
	remote.clearRedirectError();
	expect(remote.redirectError()).toBeNull();
});

test("no redirect error leaves the address alone", () => {
	const { remote, replaced } = makeRemote({ search: "?code=abc" });
	expect(replaced).toEqual([]);
	expect(remote.redirectError()).toBeNull();
});

test("signIn starts the provider redirect to the site root and throws the library's error", async () => {
	const calls: unknown[] = [];
	const client = fakeClient({
		signInWithOAuth: async (o) => {
			calls.push(o);
			return { error: null };
		},
	});
	const { remote } = makeRemote({ client });
	await remote.signIn("github");
	expect(calls).toEqual([
		{
			provider: "github",
			options: { redirectTo: "https://site.example/portdle/" },
		},
	]);
	const failing = makeRemote({
		client: fakeClient({
			signInWithOAuth: async () => ({ error: new Error("nope") }),
		}),
	});
	await expect(failing.remote.signIn("google")).rejects.toThrow("nope");
});

test("signOut ends only this device's session", async () => {
	const calls: unknown[] = [];
	const { remote } = makeRemote({
		client: fakeClient({
			signOut: async (o) => {
				calls.push(o);
				return { error: null };
			},
		}),
	});
	await remote.signOut();
	expect(calls).toEqual([{ scope: "local" }]);
});

test("signOut removes the stored sign-in key when the library cannot load", async () => {
	const { remote, removed } = makeRemote({ stored: true, loadFails: true });
	await remote.signOut();
	expect(removed).toEqual([KEY]);
});

test("preload starts loading the library and swallows a failure", async () => {
	const ok = makeRemote();
	ok.remote.preload();
	expect(ok.loadLibrary).toHaveBeenCalledOnce();
	const failing = makeRemote({ loadFails: true });
	expect(() => failing.remote.preload()).not.toThrow();
	await Promise.resolve();
});

type UpdateCall = {
	table: string;
	fields: unknown;
	column: string;
	id: unknown;
};

function updatingClient(
	result: { data: unknown; error: Error | null },
	calls: UpdateCall[],
	getSession?: FakeClient["auth"]["getSession"],
): FakeClient {
	const client = fakeClient(getSession ? { getSession } : {});
	client.from = (table: string) => ({
		update: (fields: unknown) => ({
			eq: (column: string, id: unknown) => ({
				select: async () => {
					calls.push({ table, fields, column, id });
					return result;
				},
			}),
		}),
	});
	return client;
}

test("confirmDisplayName sets the name and the confirmed flag on the own row", async () => {
	const calls: UpdateCall[] = [];
	const { remote } = makeRemote({
		client: updatingClient({ data: [{ id: "u1" }], error: null }, calls),
	});
	await remote.confirmDisplayName("Ada");
	expect(calls).toEqual([
		{
			table: "accounts",
			fields: { display_name: "Ada", name_confirmed: true },
			column: "id",
			id: "u1",
		},
	]);
});

test("changeDisplayName sets only the name", async () => {
	const calls: UpdateCall[] = [];
	const { remote } = makeRemote({
		client: updatingClient({ data: [{ id: "u1" }], error: null }, calls),
	});
	await remote.changeDisplayName("Grace");
	expect(calls).toEqual([
		{
			table: "accounts",
			fields: { display_name: "Grace" },
			column: "id",
			id: "u1",
		},
	]);
});

test("a name update throws on a library error, an empty result, or no session", async () => {
	const failing = makeRemote({
		client: updatingClient(
			{ data: null, error: new Error("check failed") },
			[],
		),
	});
	await expect(failing.remote.changeDisplayName("Ada")).rejects.toThrow(
		"check failed",
	);
	const empty = makeRemote({
		client: updatingClient({ data: [], error: null }, []),
	});
	await expect(empty.remote.confirmDisplayName("Ada")).rejects.toThrow();
	const signedOut = makeRemote({
		client: updatingClient(
			{ data: [{ id: "u1" }], error: null },
			[],
			async () => ({
				data: { session: null },
				error: null,
			}),
		),
	});
	await expect(signedOut.remote.changeDisplayName("Ada")).rejects.toThrow();
});

class AuthError extends Error {
	status?: number;
	code?: string;
	constructor(name: string, status?: number, code?: string) {
		super(name);
		this.name = name;
		this.status = status;
		this.code = code;
	}
}

test("getAccount rejects with AccountGoneError when the account row is missing or the user is not found", async () => {
	const client = fakeClient();
	client.from = () => ({
		select: () => ({
			eq: () => ({
				single: async () => ({
					data: null,
					error: Object.assign(new Error("no rows"), { code: "PGRST116" }),
				}),
			}),
		}),
	});
	const missing = makeRemote({ stored: true, client });
	await expect(missing.remote.getAccount()).rejects.toBeInstanceOf(
		AccountGoneError,
	);
	const notFound = makeRemote({
		stored: true,
		client: fakeClient({
			getSession: async () => ({
				data: { session: null },
				error: new AuthError("AuthApiError", 403, "user_not_found"),
			}),
		}),
	});
	await expect(notFound.remote.getAccount()).rejects.toBeInstanceOf(
		AccountGoneError,
	);
});

test("getAccount keeps a retryable auth failure an ordinary error and a refused sign-in signed out", async () => {
	for (const error of [
		new AuthError("AuthRetryableFetchError", 0),
		new AuthError("AuthApiError", 503),
	]) {
		const { remote } = makeRemote({
			stored: true,
			client: fakeClient({
				getSession: async () => ({ data: { session: null }, error }),
			}),
		});
		const rejection = await remote.getAccount().catch((e: unknown) => e);
		expect(rejection).toBe(error);
	}
	const refused = makeRemote({
		stored: true,
		client: fakeClient({
			getSession: async () => ({
				data: { session: null },
				error: new AuthError("AuthApiError", 400, "refresh_token_not_found"),
			}),
		}),
	});
	expect(await refused.remote.getAccount()).toEqual({ status: "signedOut" });
});

type Call = { table: string; steps: unknown[][] };

// A query builder that records its calls and answers a paged read from `rows`.
function dataClient(
	tables: Record<string, unknown[]>,
	calls: Call[],
	upsertError: Error | null = null,
): FakeClient {
	const client = fakeClient();
	client.from = (table: string) => {
		const call: Call = { table, steps: [] };
		calls.push(call);
		const builder: Record<string, unknown> = {};
		let range: [number, number] | null = null;
		let limit: number | null = null;
		function answer() {
			const all = tables[table] ?? [];
			const data = range
				? all.slice(range[0], range[1] + 1)
				: all.slice(0, limit ?? all.length);
			return { data, error: null };
		}
		for (const name of ["select", "order"]) {
			builder[name] = (...args: unknown[]) => {
				call.steps.push([name, ...args]);
				return builder;
			};
		}
		builder.range = (from: number, to: number) => {
			call.steps.push(["range", from, to]);
			range = [from, to];
			return Promise.resolve(answer());
		};
		builder.limit = (n: number) => {
			call.steps.push(["limit", n]);
			limit = n;
			return Promise.resolve(answer());
		};
		builder.upsert = async (records: unknown[], options: unknown) => {
			call.steps.push(["upsert", records, options]);
			return { error: upsertError };
		};
		return builder;
	};
	return client;
}

test("pull maps the tables, orders by primary key, pages past 1000 rows, and limits runs to 50", async () => {
	const dailies = Array.from({ length: 1500 }, (_, i) => ({
		category: "mixed",
		day: `2020-01-${String((i % 28) + 1).padStart(2, "0")}#${i}`,
		status: "won",
		guesses: [],
	}));
	const calls: Call[] = [];
	const { remote } = makeRemote({
		client: dataClient(
			{
				codex_entries: [{ entry_id: "http", state: "correct" }],
				blitz_bests: [
					{
						category: "mixed",
						orientation: "default",
						mode: "sprint",
						score: 4,
						time_to_score_ms: null,
					},
				],
				dailies,
				preferences: [
					{
						account_id: "u1",
						theme: "dark",
						how_to_seen: null,
						codex_sort: "port",
					},
				],
				blitz_runs: [
					{
						ended_at: "2026-09-29T10:00:00+00:00",
						category: "mixed",
						orientation: "default",
						mode: "sprint",
						ended: "lives",
						score: 4,
						time_to_score_ms: 12.5,
						// jsonb returns keys in its own order
						rounds: [
							{
								wrong: null,
								outcome: "correct",
								port: 80,
								name: "HTTP",
								id: "http",
							},
						],
					},
				],
			},
			calls,
		),
	});
	const rows = await remote.pull();
	expect(rows.codex).toEqual({ http: "correct" });
	expect(rows.bests).toEqual({ "mixed|default|sprint": { score: 4 } });
	expect(Object.keys(rows.dailies)).toHaveLength(1500);
	expect(rows.preferences).toEqual({ theme: "dark", codexSort: "port" });
	expect(JSON.stringify(rows.runs[0])).toBe(
		JSON.stringify({
			category: "mixed",
			orientation: "default",
			mode: "sprint",
			ended: "lives",
			endedAt: "2026-09-29T10:00:00.000Z",
			score: 4,
			timeToScoreMs: 12.5,
			rounds: [
				{ id: "http", name: "HTTP", port: 80, outcome: "correct", wrong: null },
			],
		}),
	);
	const dailyReads = calls.filter((c) => c.table === "dailies");
	expect(dailyReads.map((c) => c.steps.at(-1))).toEqual([
		["range", 0, 999],
		["range", 1000, 1999],
	]);
	expect(dailyReads[0]?.steps).toContainEqual(["order", "category"]);
	expect(dailyReads[0]?.steps).toContainEqual(["order", "day"]);
	const runRead = calls.find((c) => c.table === "blitz_runs");
	expect(runRead?.steps).toContainEqual([
		"order",
		"ended_at",
		{ ascending: false },
	]);
	expect(runRead?.steps.at(-1)).toEqual(["limit", 50]);
});

test("push upserts each table with its conflict columns, the account id, chunks of 500, and skips invalid values", async () => {
	const calls: Call[] = [];
	const { remote } = makeRemote({ client: dataClient({}, calls) });
	const daily = { status: "won" as const, guesses: [] };
	const dailies: Record<string, typeof daily> = {
		"mixed|2026-13-45": daily,
	};
	for (let i = 0; i < 600; i += 1) {
		const day = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
		dailies[`mixed|${day}`] = daily;
	}
	await remote.push("u1", {
		codex: { http: "correct" },
		bests: { "mixed|default|sprint": { score: 3, timeToScoreMs: 1.5 } },
		runs: [
			{
				category: "mixed",
				orientation: "default",
				mode: "sprint",
				ended: "lives",
				endedAt: "nonsense",
				score: 1,
				rounds: [],
			},
		],
		dailies,
		preferences: {},
	});
	const upserts = calls.flatMap((c) =>
		c.steps
			.filter((s) => s[0] === "upsert")
			.map((s) => ({ table: c.table, records: s[1] as unknown[], on: s[2] })),
	);
	expect(upserts.find((u) => u.table === "codex_entries")).toEqual({
		table: "codex_entries",
		records: [{ account_id: "u1", entry_id: "http", state: "correct" }],
		on: { onConflict: "account_id,entry_id" },
	});
	expect(upserts.find((u) => u.table === "blitz_bests")).toEqual({
		table: "blitz_bests",
		records: [
			{
				account_id: "u1",
				category: "mixed",
				orientation: "default",
				mode: "sprint",
				score: 3,
				time_to_score_ms: 1.5,
			},
		],
		on: { onConflict: "account_id,category,orientation,mode" },
	});
	expect(upserts.some((u) => u.table === "blitz_runs")).toBe(false);
	expect(upserts.some((u) => u.table === "preferences")).toBe(false);
	const dailyUpserts = upserts.filter((u) => u.table === "dailies");
	expect(dailyUpserts.map((u) => u.records.length)).toEqual([500, 100]);
	expect(dailyUpserts[0]?.on).toEqual({
		onConflict: "account_id,category,day",
	});
});

test("pull reads late into the record and a null late as absent", async () => {
	const dailies = [true, false, null].map((late, i) => ({
		category: "mixed",
		day: `2026-09-1${i}`,
		status: "won",
		guesses: [],
		late,
	}));
	const { remote } = makeRemote({
		client: dataClient({ dailies }, []),
	});
	const rows = await remote.pull();
	expect(rows.dailies["mixed|2026-09-10"]).toEqual({
		status: "won",
		guesses: [],
		late: true,
	});
	expect(rows.dailies["mixed|2026-09-11"]).toEqual({
		status: "won",
		guesses: [],
		late: false,
	});
	expect(rows.dailies["mixed|2026-09-12"]).toEqual({
		status: "won",
		guesses: [],
	});
});

test("push sends late, and null for a record with no late", async () => {
	const calls: Call[] = [];
	const { remote } = makeRemote({ client: dataClient({}, calls) });
	await remote.push("u1", {
		codex: {},
		bests: {},
		runs: [],
		dailies: {
			"mixed|2026-09-10": { status: "won", guesses: [], late: true },
			"mixed|2026-09-11": { status: "won", guesses: [], late: false },
			"mixed|2026-09-12": { status: "won", guesses: [] },
		},
		preferences: {},
	});
	const upsert = calls
		.filter((c) => c.table === "dailies")
		.flatMap((c) => c.steps.filter((step) => step[0] === "upsert"))[0];
	const records = (upsert?.[1] ?? []) as Array<{
		day: string;
		late: boolean | null;
	}>;
	expect(records.map((record) => [record.day, record.late])).toEqual([
		["2026-09-10", true],
		["2026-09-11", false],
		["2026-09-12", null],
	]);
});

test("push maps a foreign-key violation to AccountGoneError and rethrows other errors", async () => {
	const gone = makeRemote({
		client: dataClient(
			{},
			[],
			Object.assign(new Error("fk"), { code: "23503" }),
		),
	});
	await expect(
		gone.remote.push("u1", {
			codex: { http: "correct" },
			bests: {},
			runs: [],
			dailies: {},
			preferences: {},
		}),
	).rejects.toBeInstanceOf(AccountGoneError);
	const other = new Error("boom");
	const failing = makeRemote({ client: dataClient({}, [], other) });
	await expect(
		failing.remote.push("u1", {
			codex: { http: "correct" },
			bests: {},
			runs: [],
			dailies: {},
			preferences: {},
		}),
	).rejects.toBe(other);
});

test("deleteAccount reads the session, calls the RPC, then drops the stored sign-in", async () => {
	const order: string[] = [];
	const client = fakeClient({
		signOut: async (o) => {
			order.push(`signOut ${JSON.stringify(o)}`);
			return { error: null };
		},
	});
	client.rpc = async (name) => {
		order.push(`rpc ${name}`);
		return { error: null };
	};
	const { remote, removed } = makeRemote({ stored: true, client });
	await remote.deleteAccount();
	expect(order).toEqual(["rpc delete_account", 'signOut {"scope":"local"}']);
	expect(removed).toEqual([]);
});

test("deleteAccount keeps the stored sign-in when the RPC is refused, and rejects", async () => {
	const client = fakeClient({
		signOut: async () => {
			throw new Error("must not sign out");
		},
	});
	const refused = new Error("refused");
	client.rpc = async () => ({ error: refused });
	const { remote, removed } = makeRemote({ stored: true, client });
	await expect(remote.deleteAccount()).rejects.toBe(refused);
	expect(removed).toEqual([]);
});

test("deleteAccount rejects with nothing changed when the library cannot load, there is no session, or the read fails", async () => {
	const offline = makeRemote({ stored: true, loadFails: true });
	await expect(offline.remote.deleteAccount()).rejects.toThrow("offline");
	const noSession = fakeClient({
		getSession: async () => ({ data: { session: null }, error: null }),
	});
	const rpc = vi.fn(async () => ({ error: null }));
	noSession.rpc = rpc;
	const signedOut = makeRemote({ stored: true, client: noSession });
	await expect(signedOut.remote.deleteAccount()).rejects.toThrow(
		"Not signed in",
	);
	const retryable = new AuthError("AuthRetryableFetchError", 0);
	const failing = fakeClient({
		getSession: async () => ({ data: { session: null }, error: retryable }),
	});
	failing.rpc = rpc;
	const network = makeRemote({ stored: true, client: failing });
	await expect(network.remote.deleteAccount()).rejects.toBe(retryable);
	expect(rpc).not.toHaveBeenCalled();
	expect(signedOut.removed).toEqual([]);
	expect(network.removed).toEqual([]);
});

test("deleteAccount rejects with AccountGoneError when the user is not found", async () => {
	const { remote } = makeRemote({
		stored: true,
		client: fakeClient({
			getSession: async () => ({
				data: { session: null },
				error: new AuthError("AuthApiError", 403, "user_not_found"),
			}),
		}),
	});
	await expect(remote.deleteAccount()).rejects.toBeInstanceOf(AccountGoneError);
});

test("deleteAccount still resolves and removes the stored key when the local sign-out throws or returns an error", async () => {
	for (const signOut of [
		async () => {
			throw new Error("boom");
		},
		async () => ({ error: new Error("network") }),
	]) {
		const { remote, removed } = makeRemote({
			stored: true,
			client: fakeClient({ signOut }),
		});
		await remote.deleteAccount();
		expect(removed).toEqual([KEY]);
	}
});

test("pull maps a missing Preferences row to no preferences", async () => {
	const { remote } = makeRemote({ client: dataClient({}, []) });
	expect((await remote.pull()).preferences).toEqual({});
});

test("push upserts one Preferences row with only the changed columns", async () => {
	const calls: Call[] = [];
	const { remote } = makeRemote({ client: dataClient({}, calls) });
	await remote.push("u1", {
		codex: {},
		bests: {},
		runs: [],
		dailies: {},
		preferences: { howToSeen: true, codexSort: "port" },
	});
	const upserts = calls
		.filter((c) => c.table === "preferences")
		.flatMap((c) => c.steps.filter((s) => s[0] === "upsert"));
	expect(upserts).toEqual([
		[
			"upsert",
			[{ account_id: "u1", how_to_seen: true, codex_sort: "port" }],
			{ onConflict: "account_id" },
		],
	]);
});

// A query builder that records each step; `order` ends the chain.
function leaderboardClient(
	steps: unknown[][],
	answer: { data: unknown; error: Error | null },
	session: unknown = { user: { id: "u1" } },
): FakeClient {
	const client = fakeClient({
		getSession: async () => ({ data: { session }, error: null }),
	});
	client.from = (table: string) => {
		steps.push(["from", table]);
		const builder: Record<string, unknown> = {};
		for (const name of ["select", "eq", "lte", "or"]) {
			builder[name] = (...args: unknown[]) => {
				steps.push([name, ...args]);
				return builder;
			};
		}
		builder.order = async (...args: unknown[]) => {
			steps.push(["order", ...args]);
			return answer;
		};
		return builder;
	};
	return client;
}

const QUERY = {
	window: "weekly",
	category: "mixed",
	orientation: "inverted",
	mode: "sprint",
} as const;

test("readLeaderboard reads the window's view for the key, with the viewer's own row, ordered by rank", async () => {
	const steps: unknown[][] = [];
	const { remote } = makeRemote({
		client: leaderboardClient(steps, {
			data: [
				{
					account_id: "p1",
					display_name: "Grace",
					score: 9,
					time_to_score_ms: 1500.5,
					rank: 1,
				},
				{
					account_id: "u1",
					display_name: "Ada",
					score: 2,
					time_to_score_ms: null,
					rank: 140,
				},
			],
			error: null,
		}),
	});
	expect(await remote.readLeaderboard(QUERY)).toEqual({
		viewerId: "u1",
		rows: [
			{
				accountId: "p1",
				displayName: "Grace",
				score: 9,
				timeToScoreMs: 1500.5,
				rank: 1,
			},
			{
				accountId: "u1",
				displayName: "Ada",
				score: 2,
				timeToScoreMs: null,
				rank: 140,
			},
		],
	});
	expect(steps).toEqual([
		["from", "leaderboard_weekly"],
		["select", "account_id, display_name, score, time_to_score_ms, rank"],
		["eq", "category", "mixed"],
		["eq", "orientation", "inverted"],
		["eq", "mode", "sprint"],
		["or", "rank.lte.100,account_id.eq.u1"],
		["order", "rank"],
	]);
});

test("readLeaderboard reads only the top 100 without a session", async () => {
	const steps: unknown[][] = [];
	const { remote } = makeRemote({
		client: leaderboardClient(steps, { data: [], error: null }, null),
	});
	expect(await remote.readLeaderboard({ ...QUERY, window: "allTime" })).toEqual(
		{ viewerId: null, rows: [] },
	);
	expect(steps[0]).toEqual(["from", "leaderboard_all_time"]);
	expect(steps).toContainEqual(["lte", "rank", 100]);
	expect(steps.some((step) => step[0] === "or")).toBe(false);
});

test("readLeaderboard rejects with the library's error", async () => {
	const error = new Error("boom");
	const { remote } = makeRemote({
		client: leaderboardClient([], { data: null, error }),
	});
	await expect(remote.readLeaderboard(QUERY)).rejects.toBe(error);
});

function publicRemote(replies: Array<{ ok?: boolean; body: unknown }>) {
	const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
	const loadLibrary = vi.fn(async () => {
		throw new Error("the library must stay lazy");
	});
	const fetch = vi.fn(async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		const reply = replies[calls.length - 1] ?? { body: [] };
		return {
			ok: reply.ok ?? true,
			status: reply.ok === false ? 500 : 200,
			json: async () => reply.body,
		} as Response;
	}) as unknown as typeof globalThis.fetch;
	const remote = createSupabaseRemote(
		{ url: URL, anonKey: "anon" },
		{
			storage: { getItem: () => null, removeItem: () => {} },
			location: {
				pathname: "/",
				search: "",
				hash: "",
				origin: "https://x.example",
			},
			history: { replaceState: () => {} },
			baseUrl: "/",
			loadLibrary,
			fetch,
		},
	);
	return { remote, calls, loadLibrary };
}

function catalogRow(id: string, kind: string, overrides = {}) {
	return {
		id,
		kind,
		name: id.toUpperCase(),
		aliases: [],
		port: 80,
		transport: "tcp",
		description: "d",
		blurb: null,
		answer_eligible: true,
		retired: false,
		sources: [],
		...overrides,
	};
}

test("readCatalog splits entries by kind, maps fields, and never loads the library", async () => {
	const { remote, calls, loadLibrary } = publicRemote([
		{
			body: [
				catalogRow("http", "protocol", { blurb: "b", retired: true }),
				catalogRow("vite", "application"),
			],
		},
	]);
	const catalog = await remote.readCatalog();
	expect(catalog.protocols).toEqual([
		{
			id: "http",
			name: "HTTP",
			aliases: [],
			port: 80,
			transport: "tcp",
			description: "d",
			blurb: "b",
			answerEligible: true,
			retired: true,
			sources: [],
		},
	]);
	expect(catalog.applications.map((entry) => entry.id)).toEqual(["vite"]);
	expect("blurb" in (catalog.applications[0] ?? {})).toBe(false);
	expect(calls[0]?.url).toBe(
		`${URL}/rest/v1/catalog_entries?select=*&order=id&limit=1000&offset=0`,
	);
	expect(calls[0]?.init?.headers).toEqual({ apikey: "anon" });
	expect(loadLibrary).not.toHaveBeenCalled();
});

test("readCatalog rejects an unknown kind and a non-ok reply", async () => {
	await expect(
		publicRemote([{ body: [catalogRow("x", "other")] }]).remote.readCatalog(),
	).rejects.toThrow("Unknown catalog kind");
	await expect(
		publicRemote([{ ok: false, body: null }]).remote.readCatalog(),
	).rejects.toThrow("500");
});

test("readSchedule pages until a short page and maps the rows", async () => {
	const full = Array.from({ length: 1000 }, (_, index) => ({
		category: "mixed",
		day: `d${index}`,
		entry_id: "http",
	}));
	const { remote, calls } = publicRemote([
		{ body: full },
		{ body: [{ category: "protocols", day: "z", entry_id: "ssh" }] },
	]);
	const rows = await remote.readSchedule();
	expect(rows).toHaveLength(1001);
	expect(rows.at(-1)).toEqual({
		category: "protocols",
		date: "z",
		entryId: "ssh",
	});
	expect(calls.map((call) => call.url)).toEqual([
		`${URL}/rest/v1/schedule?select=category,day,entry_id&order=day,category&limit=1000&offset=0`,
		`${URL}/rest/v1/schedule?select=category,day,entry_id&order=day,category&limit=1000&offset=1000`,
	]);
});

const DAILY_ROWS = [
	{
		server_time: "2026-10-02T12:00:00.123456+00:00",
		utc_date: "2026-10-02",
		category: "mixed",
		entry_id: "a",
	},
	{
		server_time: "2026-10-02T12:00:00.123456+00:00",
		utc_date: "2026-10-02",
		category: "protocols",
		entry_id: "b",
	},
	{
		server_time: "2026-10-02T12:00:00.123456+00:00",
		utc_date: "2026-10-02",
		category: "applications",
		entry_id: "c",
	},
];

test("readCurrentDailies posts to the function and returns the date and ids", async () => {
	const { remote, calls } = publicRemote([{ body: DAILY_ROWS }]);
	expect(await remote.readCurrentDailies()).toEqual({
		today: "2026-10-02",
		serverNow: Date.parse("2026-10-02T12:00:00.123Z"),
		entryIds: { mixed: "a", protocols: "b", applications: "c" },
	});
	expect(calls[0]?.url).toBe(`${URL}/rest/v1/rpc/current_dailies`);
	expect(calls[0]?.init?.method).toBe("POST");
	expect(calls[0]?.init?.body).toBe("{}");
	expect(calls[0]?.init?.headers).toEqual({
		apikey: "anon",
		"Content-Type": "application/json",
	});
});

test("readCurrentDailies rejects a null id, a missing row, and a repeated category", async () => {
	const nullId = DAILY_ROWS.map((row, index) =>
		index === 1 ? { ...row, entry_id: null } : row,
	);
	for (const body of [
		nullId,
		DAILY_ROWS.slice(0, 2),
		[...DAILY_ROWS.slice(0, 2), DAILY_ROWS[0]],
		[],
	]) {
		await expect(
			publicRemote([{ body }]).remote.readCurrentDailies(),
		).rejects.toThrow("incomplete");
	}
});

test("readCurrentDailies rejects a missing, null, or unparseable server time", async () => {
	for (const server_time of [undefined, null, "not a time"]) {
		const body = DAILY_ROWS.map((row) => ({ ...row, server_time }));
		await expect(
			publicRemote([{ body }]).remote.readCurrentDailies(),
		).rejects.toThrow("server time");
	}
});

test("readSchedule rejects an unknown category", async () => {
	await expect(
		publicRemote([
			{ body: [{ category: "other", day: "d", entry_id: "x" }] },
		]).remote.readSchedule(),
	).rejects.toThrow("Unknown Schedule category");
});
