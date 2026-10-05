import { expect, test } from "vitest";
import { DEFAULT_RUNS, failedTests, parseRuns } from "./test-stress-core.ts";

test("runs defaults to 5", () => {
	expect(parseRuns(undefined)).toBe(DEFAULT_RUNS);
	expect(DEFAULT_RUNS).toBe(5);
});

test("runs accepts a positive integer", () => {
	expect(parseRuns("3")).toBe(3);
	expect(parseRuns("12")).toBe(12);
});

test.each(["0", "-1", "2.5", "abc", ""])("runs rejects %j", (arg) => {
	expect(() => parseRuns(arg)).toThrow("positive integer");
});

test("a report with one failed test gives one line", () => {
	const report = {
		testResults: [
			{
				name: "/repo/src/a.test.ts",
				assertionResults: [
					{ status: "passed", fullName: "ok test" },
					{ status: "failed", fullName: "suite bad test" },
				],
			},
			{ name: "/repo/src/b.test.ts", assertionResults: [] },
		],
	};
	expect(failedTests(report, "/repo")).toEqual([
		"src/a.test.ts › suite bad test",
	]);
});

test("a green report gives no lines", () => {
	expect(
		failedTests(
			{
				testResults: [
					{
						name: "/repo/src/a.test.ts",
						assertionResults: [{ status: "passed", fullName: "ok" }],
					},
				],
			},
			"/repo",
		),
	).toEqual([]);
});
