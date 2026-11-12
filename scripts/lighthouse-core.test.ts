import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
	type Audit,
	type AuditResult,
	CATEGORIES,
	describeLcpNode,
	formatAudit,
	guardExitCode,
	LaunchError,
	launchWithRetry,
	median,
	medianScores,
	missedFloors,
	parseConfig,
	planAudits,
	type RunResult,
	runAudits,
	type Scores,
	summarize,
} from "./lighthouse-core.ts";

const FLOORS: Scores = {
	performance: 98,
	accessibility: 100,
	"best-practices": 100,
	seo: 100,
};

function scores(overrides: Partial<Scores> = {}): Scores {
	return {
		performance: 100,
		accessibility: 100,
		"best-practices": 100,
		seo: 100,
		...overrides,
	};
}

function run(overrides: Partial<Scores> = {}, lcp = "p.lead"): RunResult {
	return { scores: scores(overrides), lcp, report: "{}" };
}

const config = parseConfig(
	JSON.parse(
		readFileSync(
			join(import.meta.dirname, "..", "lighthouse", "floors.json"),
			"utf8",
		),
	),
);

describe("planAudits", () => {
	test("makes 28 audits: 14 page states on 2 form factors", () => {
		const plan = planAudits(config.pages);
		expect(plan).toHaveLength(28);
		expect(new Set(plan.map((a) => a.id)).size).toBe(28);
		expect(plan[0]?.id).toBe("daily-mixed-first-mobile");
		expect(plan.map((a) => a.id)).toContain("board-returning-desktop");
	});

	test("limits the plan to one page: a returning page gives 4 audits, another gives 2", () => {
		expect(planAudits(config.pages, "history").map((a) => a.id)).toEqual([
			"history-first-mobile",
			"history-first-desktop",
			"history-returning-mobile",
			"history-returning-desktop",
		]);
		expect(planAudits(config.pages, "privacy")).toHaveLength(2);
	});

	test("throws for an unknown page name", () => {
		expect(() => planAudits(config.pages, "nope")).toThrow("nope");
	});
});

describe("median and floors", () => {
	test("the median is the middle of the sorted values", () => {
		expect(median([99, 100, 97])).toBe(99);
		expect(median([100, 100, 54])).toBe(100);
	});

	test("one low run does not move the median of 3", () => {
		const medians = medianScores([run({ performance: 54 }), run(), run()]);
		expect(medians.performance).toBe(100);
	});

	test("a median at the floor passes and below it misses", () => {
		expect(missedFloors(scores({ performance: 98 }), FLOORS)).toEqual([]);
		expect(missedFloors(scores({ performance: 97 }), FLOORS)).toEqual([
			{ category: "performance", score: 97, floor: 98 },
		]);
	});

	test("every other category misses below 100", () => {
		const misses = missedFloors(
			scores({ accessibility: 96, "best-practices": 99, seo: 90 }),
			FLOORS,
		);
		expect(misses.map((m) => m.category)).toEqual([
			"accessibility",
			"best-practices",
			"seo",
		]);
	});
});

describe("log line", () => {
	const audit = planAudits(config.pages, "board")[3] as Audit;

	test("names the audit, its medians and its LCP element", () => {
		const result = summarize(
			audit,
			[run({}, "h1.title"), run(), run()],
			FLOORS,
		);
		const text = formatAudit(result);
		expect(text).toContain(audit.id);
		for (const category of CATEGORIES) {
			expect(text).toContain(`${category} 100`);
		}
		expect(text).toContain("LCP h1.title");
		expect(text).toContain("PASS");
	});

	test("names each missed floor", () => {
		const bad = run({ performance: 90, accessibility: 96 }, "img.hero");
		const result = summarize(audit, [bad, bad, bad], FLOORS);
		const text = formatAudit(result);
		expect(text).toContain("FAIL");
		expect(text).toContain("MISS performance 90 < floor 98");
		expect(text).toContain("MISS accessibility 96 < floor 100");
		expect(text).toContain("LCP img.hero");
	});

	test("takes the LCP element of the first run at the performance median", () => {
		const runs = [
			run({ performance: 99 }, "first"),
			run({ performance: 97 }, "low"),
			run({ performance: 99 }, "second"),
		];
		expect(summarize(audit, runs, FLOORS).lcp).toBe("first");
	});
});

describe("describeLcpNode", () => {
	test("shows the selector and the start of the snippet", () => {
		const snippet = `<p class="lead">${"x".repeat(200)}`;
		const text = describeLcpNode({ selector: "main > p.lead", snippet });
		expect(text.startsWith("main > p.lead <p class=")).toBe(true);
		expect(text.length).toBeLessThan(120);
	});

	test("shows the one that exists", () => {
		expect(describeLcpNode({ selector: "h1" })).toBe("h1");
		expect(describeLcpNode({ snippet: "<h1>" })).toBe("<h1>");
	});

	test("says none when there is no element", () => {
		expect(describeLcpNode(undefined)).toBe("none");
		expect(describeLcpNode({})).toBe("none");
	});
});

describe("launchWithRetry", () => {
	test("returns the result of the first launch that works", async () => {
		let calls = 0;
		const result = await launchWithRetry(async () => {
			calls++;
			if (calls < 3) {
				throw new Error("no port");
			}
			return "chrome";
		});
		expect(result).toBe("chrome");
		expect(calls).toBe(3);
	});

	test("stops after 2 retries and throws a LaunchError", async () => {
		let calls = 0;
		await expect(
			launchWithRetry(async () => {
				calls++;
				throw new Error("no port");
			}),
		).rejects.toBeInstanceOf(LaunchError);
		expect(calls).toBe(3);
	});
});

describe("runAudits", () => {
	const plan = planAudits(config.pages, "history");

	test("runs one warm-up of the first audit, then 3 runs of each audit", async () => {
		const calls: string[] = [];
		const results = await runAudits(plan, FLOORS, async (audit) => {
			calls.push(audit.id);
			return run();
		});
		expect(calls).toHaveLength(1 + 3 * plan.length);
		expect(calls[0]).toBe(plan[0]?.id);
		expect(calls.slice(1, 4)).toEqual(Array(3).fill(plan[0]?.id));
		expect(results.map((r) => r.audit.id)).toEqual(plan.map((a) => a.id));
		expect(results.every((r) => r.runs.length === 3)).toBe(true);
	});

	test("discards the warm-up: a bad warm-up run does not count", async () => {
		let first = true;
		const results = await runAudits(plan, FLOORS, async () => {
			if (first) {
				first = false;
				return run({ performance: 40 });
			}
			return run();
		});
		expect(results[0]?.medians.performance).toBe(100);
		expect(results[0]?.runs.every((r) => r.scores.performance === 100)).toBe(
			true,
		);
	});

	test("hands each audit result over as it ends", async () => {
		const ids: string[] = [];
		await runAudits(
			plan,
			FLOORS,
			async () => run(),
			(result) => ids.push(result.audit.id),
		);
		expect(ids).toEqual(plan.map((a) => a.id));
	});

	test("passes the state and the form factor to the run", async () => {
		const seen = new Set<string>();
		await runAudits(plan, FLOORS, async (audit) => {
			seen.add(`${audit.state}-${audit.formFactor}`);
			return run();
		});
		expect(seen).toEqual(
			new Set([
				"first-mobile",
				"first-desktop",
				"returning-mobile",
				"returning-desktop",
			]),
		);
	});

	test("rethrows a run error that is not a launch failure, with no retry", async () => {
		let calls = 0;
		await expect(
			runAudits(plan, FLOORS, async () => {
				calls++;
				throw new Error("lighthouse failed");
			}),
		).rejects.toThrow("lighthouse failed");
		expect(calls).toBe(1);
	});

	test("an empty plan runs nothing", async () => {
		expect(await runAudits([], FLOORS, async () => run())).toEqual([]);
	});
});

describe("guardExitCode", () => {
	const audit = planAudits(config.pages, "privacy")[0] as Audit;
	const pass: AuditResult = summarize(audit, [run(), run(), run()], FLOORS);
	const fail: AuditResult = summarize(
		audit,
		[run({ seo: 90 }), run({ seo: 90 }), run({ seo: 90 })],
		FLOORS,
	);

	test("is 0 when every median meets its floor", () => {
		expect(guardExitCode([pass, pass])).toBe(0);
	});

	test("is 1 when one median is below its floor", () => {
		expect(guardExitCode([pass, fail])).toBe(1);
	});
});
