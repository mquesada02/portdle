import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseConfig } from "./lighthouse-core.ts";

const root = join(import.meta.dirname, "..");
const workflow = readFileSync(
	join(root, ".github", "workflows", "ci.yml"),
	"utf8",
);
const config = parseConfig(
	JSON.parse(readFileSync(join(root, "lighthouse", "floors.json"), "utf8")),
);

// The text of one top-level job: from its `  <id>:` line to the next job.
function job(id: string): string {
	const start = workflow.indexOf(`\n  ${id}:\n`);
	expect(start, `job ${id}`).toBeGreaterThan(-1);
	const rest = workflow.slice(start + 1);
	const next = rest.slice(1).search(/\n {2}[a-z][a-z-]*:\n/);
	return next === -1 ? rest : rest.slice(0, next + 1);
}

// The value of the first `    <key>:` line (job level) of a job.
function jobField(id: string, key: string): string | undefined {
	return new RegExp(`^ {4}${key}: (.*)$`, "m").exec(job(id))?.[1];
}

describe("ci.yml Lighthouse wiring", () => {
	test("the lighthouse matrix lists every page of floors.json", () => {
		const list = /^ {8}page: \[(.*)\]$/m.exec(job("lighthouse"))?.[1];
		expect(list?.split(", ")).toEqual(config.pages.map((page) => page.name));
	});

	test("the lighthouse job runs under the condition of the screenshot job", () => {
		const condition = jobField("screenshots", "if");
		expect(condition).toBeDefined();
		expect(jobField("lighthouse", "if")).toBe(condition);
	});

	test("deploy waits for lighthouse", () => {
		expect(jobField("deploy", "needs")?.split(/[[\],\s]+/)).toContain(
			"lighthouse",
		);
	});

	test("live-check runs after deploy under the condition of deploy", () => {
		expect(jobField("live-check", "needs")).toBe("deploy");
		expect(jobField("live-check", "if")).toBe(jobField("deploy", "if"));
	});
});
