import { expect, test } from "vitest";
import { createPersist } from "../persist/storage";
import { createAppRouter } from "../router";
import { memoryStore } from "../test/helpers";
import { boardCanonical, HEAD, SITE_URL } from "./head";
import { createServerStore } from "./server-store";

const router = createAppRouter({
	persist: createPersist(memoryStore()),
	remount: () => {},
	serverStore: createServerStore(undefined),
	random: Math.random,
});

// The routes that render a page: not the root, and not a redirect-only route
// (no component).
const pageRouteIds = Object.entries(router.routesById)
	.filter(([id, route]) => id !== "__root__" && route.options.component)
	.map(([id]) => id);

test("the test sees the page routes", () => {
	expect(pageRouteIds).toContain("/codex");
	expect(Object.keys(router.routesById)).toContain("/help");
});

test("every router route that renders a page has a head entry", () => {
	for (const id of pageRouteIds) {
		expect(HEAD[id], id).toBeDefined();
	}
});

test("the redirect-only route has no head entry", () => {
	expect(HEAD["/help"]).toBeUndefined();
});

test("the table has no entry for a route that does not exist", () => {
	for (const id of Object.keys(HEAD)) {
		expect(Object.keys(router.routesById), id).toContain(id);
	}
});

test("every title and description is filled and every title is its own", () => {
	const heads = Object.values(HEAD);
	for (const head of heads) {
		expect(head.title.trim()).not.toBe("");
		expect(head.description.trim()).not.toBe("");
	}
	expect(new Set(heads.map((head) => head.title)).size).toBe(heads.length);
});

test("a canonical is under the base URL, with no .html", () => {
	for (const [id, head] of Object.entries(HEAD)) {
		if (head.canonical === null) {
			continue;
		}
		expect(head.canonical, id).toMatch(new RegExp(`^${SITE_URL}/`));
		expect(head.canonical, id).not.toContain(".html");
	}
	expect(HEAD["/"]?.canonical).toBe(`${SITE_URL}/`);
	expect(HEAD["/blitz"]?.canonical).toBe(`${SITE_URL}/blitz`);
});

test("only the Archive board has no static canonical", () => {
	const boardId = Object.keys(router.routesById).find((id) =>
		id.startsWith("/archive/"),
	);
	expect(boardId).toBeDefined();
	const withoutCanonical = Object.entries(HEAD)
		.filter(([, head]) => head.canonical === null)
		.map(([id]) => id);
	expect(withoutCanonical).toEqual([boardId]);
});

test("the board canonical carries its category and date", () => {
	const url = new URL(
		boardCanonical({ category: "mixed", date: "2026-10-09" }),
	);
	expect(`${url.origin}${url.pathname}`).toBe(`${SITE_URL}/archive/board`);
	expect(url.searchParams.get("category")).toBe("mixed");
	expect(url.searchParams.get("date")).toBe("2026-10-09");
});

test("the board canonical encodes its values", () => {
	const url = boardCanonical({ category: "a b&c", date: "2026-10-09" });
	expect(url).toContain("category=a+b%26c");
	expect(new URL(url).searchParams.get("category")).toBe("a b&c");
});
