// Reads the JSON report of the screenshot gate (gate-results.json) and tells
// frame differences from errors. Playwright gives one exit code for both, and
// the `visual-change` label must excuse only the differences.

import { stripVTControlCharacters } from "node:util";

export type GateOutcome = "pass" | "differences" | "errors";

// Playwright's messages for a new frame (no baseline), a changed frame, and a
// frame of another size. A frame that never gets stable, or that a test never
// takes, fails with another message. Only the text before the call log counts:
// the log of an unstable frame also lists earlier pixel differences.
const FRAME_ERROR =
	/A snapshot doesn't exist|\d+ pixels? \(ratio [\d.]+ of all image pixels\) are different|Expected an image \d+px by \d+px, received/;

interface Result {
	status: string;
	errors?: { message?: string }[];
}
interface Suite {
	specs?: { tests?: { results?: Result[] }[] }[];
	suites?: Suite[];
}
interface Report {
	errors?: unknown[];
	suites?: Suite[];
}

function* results(suites: Suite[]): Generator<Result> {
	for (const suite of suites) {
		for (const spec of suite.specs ?? []) {
			for (const test of spec.tests ?? []) {
				yield* test.results ?? [];
			}
		}
		yield* results(suite.suites ?? []);
	}
}

function isFrameError(error: { message?: string }): boolean {
	const message = stripVTControlCharacters(error.message ?? "");
	return FRAME_ERROR.test(message.split("\n\nCall log:")[0] ?? "");
}

// `differences`: at least one test failed, and every failed test has errors
// that are all frame errors. Anything else that failed is `errors`. An
// unreadable report is `errors`, so the caller fails safe.
export function classifyReport(report: unknown): GateOutcome {
	const { errors, suites } = (report ?? {}) as Report;
	if (!Array.isArray(suites) || (Array.isArray(errors) && errors.length > 0)) {
		return "errors";
	}
	let differences = false;
	for (const result of results(suites)) {
		if (result.status === "passed" || result.status === "skipped") {
			continue;
		}
		const found = result.errors ?? [];
		if (
			result.status !== "failed" ||
			found.length === 0 ||
			!found.every(isFrameError)
		) {
			return "errors";
		}
		differences = true;
	}
	return differences ? "differences" : "pass";
}
