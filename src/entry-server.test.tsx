import { afterEach, expect, test, vi } from "vitest";
import { pageRoutePaths, renderRoute } from "./entry-server";
import { HEAD } from "./ui/head";

afterEach(() => {
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
