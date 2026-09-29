import { expect, test, vi } from "vitest";
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
};

function fakeClient(overrides: Partial<FakeClient["auth"]> = {}): FakeClient {
	return {
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
