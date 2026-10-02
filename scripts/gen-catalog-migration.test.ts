import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
	buildMigration,
	migrationPath,
	readInputs,
	sqlText,
} from "./gen-catalog-migration.ts";

const entry = (id: string, overrides = {}) => ({
	id,
	name: id.toUpperCase(),
	port: 80,
	transport: "tcp" as const,
	description: `${id} description`,
	answerEligible: true,
	...overrides,
});

const fixture = (switchOverDay: string) => ({
	protocols: [
		entry("a", {
			aliases: ["alpha", "it's"],
			blurb: "Blurb",
			sources: [{ label: "Doc's", url: "https://x.test" }],
		}),
		entry("b", { answerEligible: false, retired: true }),
	],
	applications: [entry("c")],
	schedules: {
		mixed: {
			epoch: "2026-09-09",
			cycles: [{ startDay: 0, order: ["a", "b"] }],
		},
		protocols: {
			epoch: "2026-09-09",
			cycles: [
				{ startDay: 0, order: ["a"] },
				{ startDay: 1, order: ["b"] },
			],
		},
		applications: {
			epoch: "2026-09-09",
			cycles: [{ startDay: 0, order: ["c", "c"] }],
		},
	},
	switchOverDay,
});

test("sqlText doubles single quotes and keeps newlines", () => {
	expect(sqlText("it's\nfine")).toBe("'it''s\nfine'");
});

test("the migration holds the switch-over function and every entry", () => {
	const sql = buildMigration(fixture("2026-09-10"));
	expect(sql).toContain("select date '2026-09-10'");
	expect(sql).toContain("array['alpha', 'it''s']::text[]");
	expect(sql).toContain(
		'\'[{"label":"Doc\'\'s","url":"https://x.test"}]\'::jsonb',
	);
	expect(sql).toContain("('b', 'protocol', 'B'");
	expect(sql).toContain("('c', 'application', 'C'");
	expect(sql).toContain(
		"'{}'::text[], 80, 'tcp', 'c description', null, true, false",
	);
	expect(sql).toContain("'b', 'protocol'");
});

test("schedule rows run from the epoch through the switch-over day", () => {
	const sql = buildMigration(fixture("2026-09-10"));
	expect(sql).toContain("('mixed', '2026-09-09', 'a', '2026-09-09')");
	expect(sql).toContain("('mixed', '2026-09-10', 'b', '2026-09-09')");
	expect(sql).toContain("('protocols', '2026-09-10', 'b', '2026-09-10')");
	expect(sql).not.toContain("'2026-09-11'");
});

test("a day with no covering cycle throws", () => {
	expect(() => buildMigration(fixture("2026-09-11"))).toThrow(
		/no cycle covers/,
	);
});

test("an epoch other than the schedule epoch throws", () => {
	const input = fixture("2026-09-09");
	input.schedules.mixed.epoch = "2026-09-01";
	expect(() => buildMigration(input)).toThrow(/epoch/);
});

test("a schedule id missing from the catalog throws", () => {
	const input = fixture("2026-09-09");
	input.schedules.mixed.cycles[0].order = ["zzz", "b"];
	expect(() => buildMigration(input)).toThrow(/zzz/);
});

test("the committed migration matches the committed files and constant", () => {
	expect(readFileSync(migrationPath, "utf8")).toBe(
		buildMigration(readInputs()),
	);
});
