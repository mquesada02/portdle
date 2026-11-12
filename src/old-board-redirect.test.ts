import { expect, test } from "vitest";
import script from "./old-board-redirect.js?raw";

// The script runs in 404.html with the page's `location`; here it gets a fake
// one that records the argument of `replace`.
function run(pathname: string): string[] {
	const replaced: string[] = [];
	new Function("location", script)({
		pathname,
		replace: (url: string) => replaced.push(url),
	});
	return replaced;
}

test("an old board link is replaced with the new board URL", () => {
	expect(run("/portdle/archive/mixed/2026-10-09")).toEqual([
		"/portdle/archive/board?category=mixed&date=2026-10-09",
	]);
});

test.each([
	["an unknown category and an impossible date", "nope", "2026-02-30"],
	["a percent-encoded segment", "a%20b", "2026-10-09"],
	["a raw ampersand", "a&b", "2026-10-09"],
])("%s: the two segments are copied as they are", (_name, category, date) => {
	expect(run(`/portdle/archive/${category}/${date}`)).toEqual([
		`/portdle/archive/board?category=${category}&date=${date}`,
	]);
});

test.each([
	"/portdle/",
	"/portdle/archive",
	"/portdle/archive/mixed",
	"/portdle/archive/a/b/c",
	"/portdle/archive/mixed/2026-10-09/",
	"/portdle/archive/board",
	"/portdle/nope",
])("%s: nothing is replaced", (pathname) => {
	expect(run(pathname)).toEqual([]);
});
