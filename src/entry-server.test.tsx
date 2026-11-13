import { afterEach, expect, test, vi } from "vitest";
import { pageRoutePaths, renderRoute } from "./entry-server";
import { HEAD } from "./ui/head";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

test("pageRoutePaths holds the paths of the HEAD table and no redirect route", () => {
	expect([...pageRoutePaths].sort()).toEqual(Object.keys(HEAD).sort());
	expect(pageRoutePaths).not.toContain("/help");
});

test.each(pageRoutePaths)("%s renders a frame", async (path) => {
	const html = await renderRoute(
		path === "/archive/board"
			? "/archive/board?category=mixed&date=2026-10-09"
			: path,
	);
	expect(html).toContain("<header");
});

test("the board frame is the same for two different boards", async () => {
	const first = await renderRoute(
		"/archive/board?category=mixed&date=2026-10-09",
	);
	const second = await renderRoute(
		"/archive/board?category=protocols&date=2026-10-04",
	);
	expect(first).toBe(second);
});

test("renderRoute runs with no window and no document", async () => {
	vi.stubGlobal("window", undefined);
	vi.stubGlobal("document", undefined);
	await expect(renderRoute("/blitz")).resolves.toContain("<header");
});

// A build with a hosted backend (the two variables set, as in CI and on
// deploy) makes the server entry build the Supabase remote, which reads
// browser globals when it is made.
test("a build with a backend renders the frame with no window, and makes no request", async () => {
	vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.test");
	vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
	const fetch = vi.fn();
	vi.stubGlobal("fetch", fetch);
	vi.stubGlobal("window", undefined);
	vi.stubGlobal("document", undefined);
	const html = await renderRoute("/blitz");
	// The frame of a build with a remote: the server data is loading.
	expect(html).toContain("Loading...");
	expect(fetch).not.toHaveBeenCalled();
});

test("a build with no backend renders the no-remote frame", async () => {
	vi.stubEnv("VITE_SUPABASE_URL", "");
	vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
	expect(await renderRoute("/blitz")).not.toContain("Loading...");
});
