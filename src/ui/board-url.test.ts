import { createMemoryHistory } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { createPersist } from "../persist/storage";
import { createAppRouter } from "../router";
import { memoryStore } from "../test/helpers";
import { boardLink, parseBoardSearch } from "./board-url";
import { createServerStore } from "./server-store";

function routerAt(path: string) {
	return createAppRouter({
		persist: createPersist(memoryStore()),
		remount: () => {},
		history: createMemoryHistory({ initialEntries: [path] }),
		serverStore: createServerStore(undefined),
		random: Math.random,
	});
}

test("the builder renders the new board URL", () => {
	const router = routerAt("/portdle/archive");
	const { href } = router.buildLocation(boardLink("mixed", "2026-10-09"));
	expect(href).toBe("/portdle/archive/board?category=mixed&date=2026-10-09");
});

test("a built link opens the board route with the same category and date", async () => {
	const router = routerAt("/portdle/archive");
	const { href } = router.buildLocation(boardLink("protocols", "2026-09-09"));
	const target = routerAt(href);
	await target.load();
	const match = target.state.matches.at(-1);
	expect(match?.routeId).toBe("/archive/board");
	expect(match?.search).toEqual({
		category: "protocols",
		date: "2026-09-09",
	});
});

test("the parser keeps strings", () => {
	expect(parseBoardSearch({ category: "mixed", date: "2026-10-09" })).toEqual({
		category: "mixed",
		date: "2026-10-09",
	});
});

test.each([
	["missing", {}],
	["numbers", { category: 1, date: 20261009 }],
	["arrays", { category: ["mixed"], date: ["2026-10-09"] }],
	["objects", { category: {}, date: { a: 1 } }],
	["null", { category: null, date: null }],
])("the parser maps %s to empty strings", (_name, search) => {
	expect(parseBoardSearch(search)).toEqual({ category: "", date: "" });
});

test("a board URL with a numeric date opens the route with an empty date", async () => {
	const router = routerAt(
		"/portdle/archive/board?category=mixed&date=20261009",
	);
	await router.load();
	expect(router.state.matches.at(-1)?.search).toEqual({
		category: "mixed",
		date: "",
	});
});
