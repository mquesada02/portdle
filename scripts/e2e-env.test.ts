import { expect, test } from "vitest";
import { authStorageKey, checkStack, STACK_MESSAGE } from "./e2e-env.ts";

const KEY = "sb_publishable_abc";

function dailiesAnswer(rows: unknown): typeof fetch {
	return async () => new Response(JSON.stringify(rows), { status: 200 });
}

const THREE = [
	{ category: "mixed", entry_id: "a" },
	{ category: "protocols", entry_id: "b" },
	{ category: "applications", entry_id: "c" },
];

test("derives the auth storage key from the first label of the host name", () => {
	expect(authStorageKey("http://127.0.0.1:54321")).toBe("sb-127-auth-token");
	expect(authStorageKey("https://abcd.supabase.co")).toBe("sb-abcd-auth-token");
});

test("passes when the current Dailies read names all three categories", async () => {
	await expect(
		checkStack("http://127.0.0.1:54321", KEY, dailiesAnswer(THREE)),
	).resolves.toBeUndefined();
});

test("fails with the one message when the address is unreachable", async () => {
	await expect(checkStack("http://127.0.0.1:9", KEY)).rejects.toThrow(
		STACK_MESSAGE,
	);
});

test("fails with the one message on an error status", async () => {
	const failing: typeof fetch = async () =>
		new Response("nope", { status: 500 });
	await expect(checkStack("http://x", KEY, failing)).rejects.toThrow(
		STACK_MESSAGE,
	);
});

test("fails with the one message on an empty answer or a missing category", async () => {
	await expect(checkStack("http://x", KEY, dailiesAnswer([]))).rejects.toThrow(
		STACK_MESSAGE,
	);
	await expect(
		checkStack("http://x", KEY, dailiesAnswer(THREE.slice(0, 2))),
	).rejects.toThrow(STACK_MESSAGE);
	await expect(
		checkStack(
			"http://x",
			KEY,
			dailiesAnswer([{ category: "mixed", entry_id: null }, ...THREE.slice(1)]),
		),
	).rejects.toThrow(STACK_MESSAGE);
});

test("names pnpm dev and pnpm dev:schedule in the message", () => {
	expect(STACK_MESSAGE).toContain("pnpm dev");
	expect(STACK_MESSAGE).toContain("pnpm dev:schedule");
});
