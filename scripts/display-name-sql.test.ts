import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { DISPLAY_NAME_CASES } from "../src/engine/display-name-cases";
import {
	DISPLAY_NAME_ANCHOR_RANGES,
	DISPLAY_NAME_RANGES,
} from "../src/engine/display-name-ranges";
import { rangesToPgClass, toPgLiteral } from "./display-name-pg-class";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("the migration carries the client's character ranges in every regex", () => {
	const sql = read("supabase/migrations/20260929000002_display_name_rule.sql");
	const allowed = rangesToPgClass(DISPLAY_NAME_RANGES);
	const anchor = rangesToPgClass(DISPLAY_NAME_ANCHOR_RANGES);
	// normalize_display_name (strip), the update's WHERE, and the CHECK
	expect(sql.split(`${allowed} ''.-]`).length - 1).toBe(3);
	// normalize_display_name, the update's WHERE, and the CHECK
	expect(sql.split(`[${anchor}]`).length - 1).toBe(3);
	// every bracket expression in the file holds one of the two classes
	const brackets = sql.match(/\[\^?(?:\\[uU][0-9a-f]+-?)+[^\]]*\]/g) ?? [];
	expect(brackets).toHaveLength(6);
	for (const b of brackets) {
		expect(b.includes(`${allowed} ''.-]`) || b === `[${anchor}]`).toBe(true);
	}
});

test("the SQL parity test lists every shared case with its verdict", () => {
	const sql = read("supabase/tests/display-name-parity.sql");
	for (const { label, name, valid } of DISPLAY_NAME_CASES) {
		expect(sql).toContain(`(${toPgLiteral(name)}, ${valid}, '${label}')`);
	}
	expect(sql.match(/^\t\t\(E'/gm)).toHaveLength(DISPLAY_NAME_CASES.length);
});
