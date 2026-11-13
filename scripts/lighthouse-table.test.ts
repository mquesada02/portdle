import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseConfig, planAudits } from "./lighthouse-core.ts";
import { parseGuardLog, type Row, renderTable } from "./lighthouse-table.ts";

const config = parseConfig(
	JSON.parse(
		readFileSync(
			join(import.meta.dirname, "..", "lighthouse", "floors.json"),
			"utf8",
		),
	),
);
const plan = planAudits(config.pages).map((audit) => audit.id);

function row(id: string, performance = 100, lcp = "h1.title"): Row {
	return {
		id,
		scores: {
			performance,
			accessibility: 100,
			"best-practices": 100,
			seo: 100,
		},
		lcp,
	};
}

function logLine(r: Row, prefix = ""): string {
	const s = r.scores;
	return `${prefix}PASS ${r.id}  performance ${s.performance}  accessibility ${s.accessibility}  best-practices ${s["best-practices"]}  seo ${s.seo}  LCP ${r.lcp}`;
}

describe("parseGuardLog", () => {
	test("reads a line with the prefix of gh run view --log", () => {
		const prefix = "lighthouse-codex\tRun guard\t2026-11-13T10:00:00.1234567Z ";
		const log = [
			`${prefix}build output`,
			logLine(row("codex-first-mobile", 99, "p.lead"), prefix),
			`${prefix}  MISS performance 99 < floor 100`,
			`${prefix}FAIL codex-first-desktop  performance 100  accessibility 96  best-practices 100  seo 100  LCP none`,
		].join("\n");
		expect(parseGuardLog(log)).toEqual([
			row("codex-first-mobile", 99, "p.lead"),
			{
				id: "codex-first-desktop",
				scores: {
					performance: 100,
					accessibility: 96,
					"best-practices": 100,
					seo: 100,
				},
				lcp: "none",
			},
		]);
	});

	test("keeps an LCP text with spaces and pipes", () => {
		const text = "div.a | b  p.x <p class='y'>Hello</p>";
		expect(
			parseGuardLog(logLine(row("codex-first-mobile", 100, text)))[0]?.lcp,
		).toBe(text);
	});
});

describe("renderTable", () => {
	test("renders the 28 audits in plan order, mobile before desktop", () => {
		expect(plan).toHaveLength(28);
		const shuffled = plan.map((id) => row(id)).reverse();
		const lines = renderTable(shuffled, config).split("\n");
		expect(lines).toHaveLength(30);
		expect(lines.slice(2).map((line) => line.split(" | ")[0])).toEqual(
			plan.map((id) => `| ${id}`),
		);
		expect(plan.slice(0, 2)).toEqual([
			"daily-mixed-first-mobile",
			"daily-mixed-first-desktop",
		]);
	});

	test("marks the target column", () => {
		const rows = plan.map((id) =>
			row(id, id === "blitz-first-mobile" ? 98 : 100),
		);
		const lines = renderTable(rows, config).split("\n");
		const marks = new Map(
			lines.slice(2).map((line) => {
				const cells = line.split(" | ");
				return [cells[0]?.slice(2), cells[5]] as const;
			}),
		);
		expect(marks.get("blitz-first-mobile")).toBe("no");
		expect(marks.get("blitz-first-desktop")).toBe("yes");
	});

	test("escapes a pipe in the LCP element", () => {
		const rows = plan.map((id) => row(id, 100, "a | b"));
		const line = renderTable(rows, config).split("\n")[2] as string;
		expect(line.endsWith("| a \\| b |")).toBe(true);
	});

	test("throws for a missing audit", () => {
		const rows = plan.slice(1).map((id) => row(id));
		expect(() => renderTable(rows, config)).toThrow(
			"missing daily-mixed-first-mobile",
		);
	});

	test("throws for an audit that is not in the plan", () => {
		const rows = [...plan.map((id) => row(id)), row("nowhere-first-mobile")];
		expect(() => renderTable(rows, config)).toThrow(
			"unknown nowhere-first-mobile",
		);
	});

	test("throws for a repeated audit", () => {
		const rows = [...plan.map((id) => row(id)), row("codex-first-mobile")];
		expect(() => renderTable(rows, config)).toThrow(
			"repeated codex-first-mobile",
		);
	});
});
