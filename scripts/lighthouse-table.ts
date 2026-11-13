// `gh run view <run-id> --log | pnpm lighthouse:table`: turns the guard logs
// of a CI run (the 10 `lighthouse` jobs) into one Markdown table of the 28
// page audits: the median of each category, whether every median meets the
// Spec 7 target of 100, and the LCP element. It reads the log on stdin and
// prints the table on stdout. It exits 1 and prints no table when an audit of
// lighthouse/floors.json is missing, an audit is not in the plan, or an audit
// appears twice (for example a log of two attempts).

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	CATEGORIES,
	type Config,
	parseConfig,
	planAudits,
	type Scores,
} from "./lighthouse-core.ts";

export const TARGET = 100;

export type Row = { id: string; scores: Scores; lcp: string };

// The line of a page audit that formatAudit (lighthouse-core.ts) prints. Text
// before PASS or FAIL is the prefix that `gh run view --log` adds (job, step,
// timestamp). The MISS lines do not match.
const LINE =
	/(?:PASS|FAIL) (\S+) {2}performance (\d+) {2}accessibility (\d+) {2}best-practices (\d+) {2}seo (\d+) {2}LCP (.*)$/;

export function parseGuardLog(text: string): Row[] {
	const rows: Row[] = [];
	for (const line of text.split("\n")) {
		const match = LINE.exec(line.trimEnd());
		if (match === null) {
			continue;
		}
		const [, id, performance, accessibility, bestPractices, seo, lcp] = match;
		rows.push({
			id: id as string,
			scores: {
				performance: Number(performance),
				accessibility: Number(accessibility),
				"best-practices": Number(bestPractices),
				seo: Number(seo),
			},
			lcp: lcp as string,
		});
	}
	return rows;
}

function cell(text: string): string {
	return text.replaceAll("|", "\\|");
}

// The table in plan order. It throws, with every problem named, when the rows
// are not exactly the audits of the plan, each once.
export function renderTable(rows: Row[], config: Config): string {
	const plan = planAudits(config.pages).map((audit) => audit.id);
	const counts = new Map<string, number>();
	for (const row of rows) {
		counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
	}
	const problems = [
		...plan.filter((id) => !counts.has(id)).map((id) => `missing ${id}`),
		...[...counts]
			.filter(([id]) => !plan.includes(id))
			.map(([id]) => `unknown ${id}`),
		...[...counts]
			.filter(([, count]) => count > 1)
			.map(([id]) => `repeated ${id}`),
	];
	if (problems.length > 0) {
		throw new Error(`The log does not hold the plan: ${problems.join(", ")}.`);
	}
	const byId = new Map(rows.map((row) => [row.id, row]));
	const header = `| audit | ${CATEGORIES.join(" | ")} | target | LCP element |`;
	const lines = [header, `|${" --- |".repeat(CATEGORIES.length + 3)}`];
	for (const id of plan) {
		const row = byId.get(id) as Row;
		const meets = CATEGORIES.every((c) => row.scores[c] >= TARGET);
		lines.push(
			`| ${id} | ${CATEGORIES.map((c) => row.scores[c]).join(" | ")} | ${meets ? "yes" : "no"} | ${cell(row.lcp)} |`,
		);
	}
	return lines.join("\n");
}

const entry = process.argv[1];
if (
	entry !== undefined &&
	import.meta.url === pathToFileURL(resolve(entry)).href
) {
	try {
		const config = parseConfig(
			JSON.parse(
				readFileSync(
					join(import.meta.dirname, "..", "lighthouse", "floors.json"),
					"utf8",
				),
			),
		);
		console.log(renderTable(parseGuardLog(readFileSync(0, "utf8")), config));
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
