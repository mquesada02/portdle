import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { SCHEDULE_DAYS } from "../gate/answers.ts";
import { parseConfig, planAudits, type Scores } from "./lighthouse-core.ts";

const FLOORS: Scores = {
	performance: 98,
	accessibility: 100,
	"best-practices": 100,
	seo: 100,
};

const config = parseConfig(
	JSON.parse(
		readFileSync(
			join(import.meta.dirname, "..", "lighthouse", "floors.json"),
			"utf8",
		),
	),
);

describe("lighthouse/floors.json", () => {
	test("holds the four floors of the spec", () => {
		expect(config.floors).toEqual(FLOORS);
	});

	test("holds the 10 pages, with the four returning ones", () => {
		expect(config.pages.map((p) => [p.name, p.path, p.returning])).toEqual([
			["daily-mixed", "/", false],
			["daily-protocols", "/protocols", false],
			["daily-applications", "/applications", false],
			["archive", "/archive", true],
			["board", "/archive/board?category=mixed&date=2026-10-09", true],
			["blitz", "/blitz", false],
			["history", "/history", true],
			["history-blitz", "/history/blitz", true],
			["codex", "/codex", false],
			["privacy", "/privacy.html", false],
		]);
	});

	test("every page name is unique and the pages make 28 audits", () => {
		expect(new Set(config.pages.map((p) => p.name)).size).toBe(10);
		expect(planAudits(config.pages)).toHaveLength(28);
	});

	test("the board's date is a day of the stub's Schedule fixture", () => {
		const board = config.pages.find((p) => p.name === "board");
		const date = new URL(board?.path ?? "", "http://x").searchParams.get(
			"date",
		);
		expect(SCHEDULE_DAYS).toContain(date);
	});

	test.each([
		["a missing floor", { floors: { ...FLOORS, seo: undefined }, pages: [] }],
		["a floor above 100", { floors: { ...FLOORS, seo: 101 }, pages: [] }],
		["no pages list", { floors: FLOORS }],
		[
			"a repeated page name",
			{
				floors: FLOORS,
				pages: [
					{ name: "a", path: "/a", returning: false },
					{ name: "a", path: "/b", returning: false },
				],
			},
		],
		[
			"a page with no returning flag",
			{ floors: FLOORS, pages: [{ name: "a", path: "/a" }] },
		],
	])("parseConfig rejects %s", (_name, value) => {
		expect(() => parseConfig(value)).toThrow();
	});
});
