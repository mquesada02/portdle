// The pure logic of the Lighthouse guard (scripts/lighthouse.ts): the page
// list from lighthouse/floors.json, the audit plan, the median of the runs of
// an audit, the floor check, the log line, the Chrome launch retry, and the
// order of the runs (one discarded warm-up run, then 3 runs per audit). The
// Chrome launch and the Lighthouse run are injected, so nothing here needs a
// browser.

export const CATEGORIES = [
	"performance",
	"accessibility",
	"best-practices",
	"seo",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Scores = Record<Category, number>;

export const FORM_FACTORS = ["mobile", "desktop"] as const;
export type FormFactor = (typeof FORM_FACTORS)[number];
export type State = "first" | "returning";

export type Page = { name: string; path: string; returning: boolean };
export type Config = { floors: Scores; pages: Page[] };

// One page audit: a page in a state on a form factor.
export type Audit = {
	id: string;
	page: Page;
	state: State;
	formFactor: FormFactor;
};

// What one Lighthouse run gives the guard.
export type RunResult = { scores: Scores; lcp: string; report: string };

export type Miss = { category: Category; score: number; floor: number };

export type AuditResult = {
	audit: Audit;
	medians: Scores;
	lcp: string;
	misses: Miss[];
	runs: RunResult[];
};

export const RUNS_PER_AUDIT = 3;
export const LAUNCH_RETRIES = 2;

function isScore(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isInteger(value) &&
		value >= 0 &&
		value <= 100
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Reads the parsed JSON of lighthouse/floors.json. A floor that is missing or
// not a score would make every comparison false and pass every run, so a bad
// file throws.
export function parseConfig(value: unknown): Config {
	if (
		!isRecord(value) ||
		!isRecord(value.floors) ||
		!Array.isArray(value.pages)
	) {
		throw new Error("floors.json needs `floors` and `pages`.");
	}
	const floors = {} as Scores;
	for (const category of CATEGORIES) {
		const floor = value.floors[category];
		if (!isScore(floor)) {
			throw new Error(`floors.json: the floor of ${category} is not a score.`);
		}
		floors[category] = floor;
	}
	const names = new Set<string>();
	const pages = value.pages.map((entry: unknown): Page => {
		if (
			!isRecord(entry) ||
			typeof entry.name !== "string" ||
			entry.name === "" ||
			typeof entry.path !== "string" ||
			!entry.path.startsWith("/") ||
			typeof entry.returning !== "boolean"
		) {
			throw new Error(
				"floors.json: each page needs a name, a path and a returning flag.",
			);
		}
		if (names.has(entry.name)) {
			throw new Error(`floors.json: the page name ${entry.name} repeats.`);
		}
		names.add(entry.name);
		return { name: entry.name, path: entry.path, returning: entry.returning };
	});
	return { floors, pages };
}

// The audits of a job: every state of every page on both form factors. A page
// name limits the plan to that page; an unknown name throws.
export function planAudits(pages: Page[], only?: string): Audit[] {
	const chosen =
		only === undefined ? pages : pages.filter((p) => p.name === only);
	if (chosen.length === 0) {
		throw new Error(`No page is named ${only}.`);
	}
	return chosen.flatMap((page) =>
		(page.returning
			? (["first", "returning"] as const)
			: (["first"] as const)
		).flatMap((state) =>
			FORM_FACTORS.map((formFactor) => ({
				id: `${page.name}-${state}-${formFactor}`,
				page,
				state,
				formFactor,
			})),
		),
	);
}

// The middle value of the sorted values (the upper middle of an even count).
export function median(values: number[]): number {
	if (values.length === 0) {
		throw new Error("The median of no values.");
	}
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] as number;
}

export function medianScores(runs: RunResult[]): Scores {
	const medians = {} as Scores;
	for (const category of CATEGORIES) {
		medians[category] = median(runs.map((run) => run.scores[category]));
	}
	return medians;
}

// The categories whose median is below its floor. A median at the floor passes.
export function missedFloors(medians: Scores, floors: Scores): Miss[] {
	return CATEGORIES.flatMap((category) =>
		medians[category] < floors[category]
			? [{ category, score: medians[category], floor: floors[category] }]
			: [],
	);
}

// The LCP element of the first run (in run order) whose performance equals the
// performance median.
function lcpOf(runs: RunResult[], performance: number): string {
	return (
		runs.find((run) => run.scores.performance === performance)?.lcp ?? "none"
	);
}

const SNIPPET_LENGTH = 80;

// The LCP element as the log shows it: its selector and the start of its
// snippet, or "none" when the report has no element.
export function describeLcpNode(
	node: { selector?: string; snippet?: string } | undefined,
): string {
	const parts = [node?.selector, node?.snippet?.slice(0, SNIPPET_LENGTH)];
	const shown = parts.filter((part) => part !== undefined && part !== "");
	return shown.length === 0 ? "none" : shown.join(" ");
}

export function summarize(
	audit: Audit,
	runs: RunResult[],
	floors: Scores,
): AuditResult {
	const medians = medianScores(runs);
	return {
		audit,
		medians,
		lcp: lcpOf(runs, medians.performance),
		misses: missedFloors(medians, floors),
		runs,
	};
}

// The log of one audit: its id, its medians, its LCP element, and one line
// for each missed floor.
export function formatAudit(result: AuditResult): string {
	const medians = CATEGORIES.map((c) => `${c} ${result.medians[c]}`).join("  ");
	const lines = [
		`${result.misses.length === 0 ? "PASS" : "FAIL"} ${result.audit.id}  ${medians}  LCP ${result.lcp}`,
	];
	for (const miss of result.misses) {
		lines.push(`  MISS ${miss.category} ${miss.score} < floor ${miss.floor}`);
	}
	return lines.join("\n");
}

// 1 when any audit missed a floor, else 0.
export function guardExitCode(results: AuditResult[]): 0 | 1 {
	return results.some((result) => result.misses.length > 0) ? 1 : 0;
}

export class LaunchError extends Error {
	constructor(message: string, options?: { cause: unknown }) {
		super(message, options);
		this.name = "LaunchError";
	}
}

// Launches Chrome. A failed launch is tried again up to `retries` more times;
// the last failure throws a LaunchError. Only the launch is retried: what the
// caller does with the result is not.
export async function launchWithRetry<T>(
	launch: () => Promise<T>,
	retries: number = LAUNCH_RETRIES,
): Promise<T> {
	let failure: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await launch();
		} catch (error) {
			failure = error;
		}
	}
	throw new LaunchError(
		`Chrome did not launch after ${retries + 1} tries: ${failure instanceof Error ? failure.message : String(failure)}`,
		{ cause: failure },
	);
}

// Runs the plan: one warm-up run of the first audit, discarded, then
// RUNS_PER_AUDIT runs of each audit in turn, one at a time. `run` does one
// Lighthouse run in a fresh Chrome. `onResult` gets each audit as it ends. A
// run error ends the job.
export async function runAudits(
	plan: Audit[],
	floors: Scores,
	run: (audit: Audit) => Promise<RunResult>,
	onResult: (result: AuditResult) => void = () => {},
): Promise<AuditResult[]> {
	const [first] = plan;
	if (first === undefined) {
		return [];
	}
	await run(first);
	const results: AuditResult[] = [];
	for (const audit of plan) {
		const runs: RunResult[] = [];
		for (let n = 0; n < RUNS_PER_AUDIT; n++) {
			runs.push(await run(audit));
		}
		const result = summarize(audit, runs, floors);
		onResult(result);
		results.push(result);
	}
	return results;
}
