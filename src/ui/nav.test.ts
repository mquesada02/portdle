import { expect, test } from "vitest";
import { NAV, onScreen } from "./nav";

const daily = NAV[0];

test("a nav item matches its own paths exactly", () => {
	expect(onScreen(daily, "/")).toBe(true);
	expect(onScreen(daily, "/protocols")).toBe(true);
	expect(onScreen(daily, "/archive")).toBe(true);
	expect(onScreen(daily, "/blitz")).toBe(false);
});

test("the Archive's boards belong to the Daily item", () => {
	expect(onScreen(daily, "/archive/mixed/2026-09-10")).toBe(true);
});

test("the Daily's root path is never a prefix of another path", () => {
	expect(onScreen(daily, "/codex")).toBe(false);
});
