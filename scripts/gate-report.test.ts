import { describe, expect, it } from "vitest";
import { classifyReport, isCaptureErrorsOnly } from "./gate-report.ts";

type Status = "passed" | "failed" | "timedOut" | "interrupted" | "skipped";

function report(
	results: { status: Status; errors?: string[] }[],
	errors: unknown[] = [],
) {
	return {
		errors,
		suites: [
			{
				specs: results.map((result) => ({
					tests: [
						{
							results: [
								{
									status: result.status,
									errors: (result.errors ?? []).map((message) => ({ message })),
								},
							],
						},
					],
				})),
				suites: [],
			},
		],
	};
}

const MISSING = "Error: A snapshot doesn't exist at /x/a.png, writing actual.";
const CHANGED =
	"Error: expect(page).toHaveScreenshot(expected) failed\n\n  2582 pixels (ratio 0.01 of all image pixels) are different.\n\n  Snapshot: a.png\n\nCall log:\n  - taking page screenshot";
const RESIZED =
	"Error: expect(page).toHaveScreenshot(expected) failed\n\n  Expected an image 375px by 812px, received 375px by 900px.\n\nCall log:\n  - x";
// A frame that never gets stable: the call log still lists a pixel difference.
const UNSTABLE =
	"Error: expect(page).toHaveScreenshot(expected) failed\n\n  Failed to take two consecutive stable screenshots.\n\nCall log:\n  - 12 pixels (ratio 0.01 of all image pixels) are different.";

describe("classifyReport", () => {
	it("passes a clean report, skipped tests included", () => {
		expect(
			classifyReport(report([{ status: "passed" }, { status: "skipped" }])),
		).toBe("pass");
	});

	it("finds differences in missing frames only", () => {
		expect(
			classifyReport(
				report([{ status: "failed", errors: [MISSING] }, { status: "passed" }]),
			),
		).toBe("differences");
	});

	it("finds differences in comparison errors only", () => {
		expect(
			classifyReport(report([{ status: "failed", errors: [CHANGED] }])),
		).toBe("differences");
	});

	it("finds differences in a frame of another size", () => {
		expect(
			classifyReport(report([{ status: "failed", errors: [RESIZED] }])),
		).toBe("differences");
	});

	it("finds errors in a frame that never gets stable", () => {
		expect(
			classifyReport(report([{ status: "failed", errors: [UNSTABLE] }])),
		).toBe("errors");
	});

	it("matches a message with ANSI colour codes", () => {
		const colored =
			"\u001b[2mexpect\u001b[22m failed\n\n  \u001b[31m5 pixels (ratio 0.01 of all image pixels) are different.\u001b[39m";
		expect(
			classifyReport(report([{ status: "failed", errors: [colored] }])),
		).toBe("differences");
	});

	it("finds errors when one failed test has a non-frame error", () => {
		expect(
			classifyReport(
				report([
					{ status: "failed", errors: [CHANGED] },
					{ status: "failed", errors: ["Error: Timed out: no animation"] },
				]),
			),
		).toBe("errors");
	});

	it("finds errors when one test mixes a frame error and another error", () => {
		expect(
			classifyReport(
				report([{ status: "failed", errors: [CHANGED, "Error: boom"] }]),
			),
		).toBe("errors");
	});

	it("finds errors in a failed test with no error", () => {
		expect(classifyReport(report([{ status: "failed" }]))).toBe("errors");
	});

	it("finds errors in a timed-out or interrupted test", () => {
		expect(
			classifyReport(report([{ status: "timedOut", errors: [CHANGED] }])),
		).toBe("errors");
		expect(
			classifyReport(report([{ status: "interrupted", errors: [CHANGED] }])),
		).toBe("errors");
	});

	it("finds errors in a report-level error", () => {
		expect(
			classifyReport(report([{ status: "passed" }], [{ message: "x" }])),
		).toBe("errors");
	});

	it("finds errors in a malformed report", () => {
		expect(classifyReport(null)).toBe("errors");
		expect(classifyReport({})).toBe("errors");
		expect(classifyReport("text")).toBe("errors");
	});
});

describe("isCaptureErrorsOnly", () => {
	it("excuses failed and timed-out tests", () => {
		expect(
			isCaptureErrorsOnly(
				report([
					{ status: "passed" },
					{ status: "failed", errors: ["Error: locator not found"] },
					{ status: "timedOut" },
				]),
			),
		).toBe(true);
	});

	it("excuses a clean report", () => {
		expect(isCaptureErrorsOnly(report([{ status: "passed" }]))).toBe(true);
	});

	it("does not excuse an interrupted run", () => {
		expect(isCaptureErrorsOnly(report([{ status: "interrupted" }]))).toBe(
			false,
		);
	});

	it("does not excuse a report-level error", () => {
		expect(
			isCaptureErrorsOnly(report([{ status: "failed" }], [{ message: "x" }])),
		).toBe(false);
	});

	it("does not excuse a malformed report", () => {
		expect(isCaptureErrorsOnly(null)).toBe(false);
		expect(isCaptureErrorsOnly({})).toBe(false);
	});
});
