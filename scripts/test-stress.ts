// `pnpm test:stress [runs]`: runs the full Vitest suite `runs` times (5 by
// default), each beside two CPU burners per core, and prints the name of each
// failed test. A burner is a process that loops and uses one full core. The
// stress loop is the proof that the suite stays stable on a loaded machine.

import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { failedTests, parseRuns } from "./test-stress-core.ts";

let runs: number;
try {
	runs = parseRuns(process.argv[2]);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}

const burners: ChildProcess[] = [];

function startBurners() {
	for (let index = 0; index < 2 * availableParallelism(); index += 1) {
		const burner = spawn(process.execPath, ["-e", "for(;;){}"], {
			stdio: "ignore",
		});
		burner.on("error", () => {});
		burners.push(burner);
	}
}

function stopBurners() {
	for (const burner of burners.splice(0)) {
		burner.kill();
	}
}

// One report file per run, so a run that writes none never reads an old one.
const reportDir = mkdtempSync(join(tmpdir(), "stress-"));

// Null when the report is missing or does not parse.
function readFailedTests(reportFile: string): string[] | null {
	try {
		return failedTests(
			JSON.parse(readFileSync(reportFile, "utf8")),
			process.cwd(),
		);
	} catch {
		return null;
	}
}

// The suite runs in an async child, so a signal handler runs at once. The
// child has its own process group, so one kill stops pnpm and the Vitest
// workers below it.
let suite: ChildProcess | undefined;

function stopSuite() {
	if (suite?.pid !== undefined) {
		try {
			process.kill(-suite.pid);
		} catch {
			// The group is already gone.
		}
	}
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		stopSuite();
		stopBurners();
		process.exit(1);
	});
}

function runSuite(reportFile: string): Promise<number | null> {
	return new Promise((resolve) => {
		suite = spawn(
			"pnpm",
			[
				"exec",
				"vitest",
				"run",
				"--reporter=json",
				`--outputFile=${reportFile}`,
			],
			{ stdio: ["ignore", "ignore", "inherit"], detached: true },
		);
		suite.on("error", () => resolve(null));
		suite.on("close", resolve);
	});
}

let passed = 0;
for (let run = 1; run <= runs; run += 1) {
	console.log(`Stress run ${run} of ${runs}`);
	const reportFile = join(reportDir, `report-${run}.json`);
	let status: number | null;
	try {
		startBurners();
		status = await runSuite(reportFile);
	} finally {
		stopBurners();
	}
	const failed = readFailedTests(reportFile);
	if (status === 0 && failed) {
		passed += 1;
		continue;
	}
	console.log(`Run ${run} failed (exit code ${status ?? "none"}).`);
	for (const name of failed ?? ["no readable report"]) {
		console.log(`  ${name}`);
	}
}

console.log(`${passed} of ${runs} runs passed`);
process.exit(passed === runs ? 0 : 1);
