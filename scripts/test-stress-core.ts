// The pure parts of `pnpm test:stress`: argument parsing and the list of
// failed tests in a Vitest JSON report.

const DEFAULT_RUNS = 5;

export function parseRuns(arg: string | undefined): number {
	if (arg === undefined) {
		return DEFAULT_RUNS;
	}
	if (!/^[1-9]\d*$/.test(arg)) {
		throw new Error(`runs must be a positive integer, got "${arg}"`);
	}
	return Number(arg);
}

type Report = {
	testResults?: {
		name: string;
		assertionResults?: { status: string; fullName: string }[];
	}[];
};

export function failedTests(report: Report, root: string): string[] {
	const failed: string[] = [];
	for (const file of report.testResults ?? []) {
		const path = file.name.startsWith(`${root}/`)
			? file.name.slice(root.length + 1)
			: file.name;
		for (const test of file.assertionResults ?? []) {
			if (test.status === "failed") {
				failed.push(`${path} › ${test.fullName}`);
			}
		}
	}
	return failed;
}
