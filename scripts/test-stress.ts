// `pnpm test:stress [runs]`: runs the full Vitest suite `runs` times (5 by
// default), each beside two CPU burners per core, and prints the name of each
// failed test. A burner is a process that loops and uses one full core. The
// stress loop is the proof that the suite stays stable on a loaded machine.
// pnpm puts the vitest binary on PATH for package scripts.

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
		burners.push(
			spawn(process.execPath, ["-e", "for(;;){}"], { stdio: "ignore" }),
		);
	}
}

function stopBurners() {
	for (const burner of burners.splice(0)) {
		burner.kill();
	}
}

// The suite runs in an async child, so a signal handler runs at once and
// stops the suite and the burners.
let suite: ChildProcess | undefined;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		suite?.kill();
		stopBurners();
		process.exit(1);
	});
}

function runSuite(): Promise<number | null> {
	return new Promise((resolve) => {
		suite = spawn(
			"vitest",
			["run", "--reporter=json", `--outputFile=${reportFile}`],
			{ stdio: ["ignore", "ignore", "inherit"] },
		);
		suite.on("close", resolve);
	});
}

const reportFile = join(mkdtempSync(join(tmpdir(), "stress-")), "report.json");
let passed = 0;
try {
	for (let run = 1; run <= runs; run += 1) {
		console.log(`Stress run ${run} of ${runs}`);
		startBurners();
		let status: number | null;
		try {
			status = await runSuite();
		} finally {
			stopBurners();
		}
		const failed = readFailedTests();
		if (status === 0 && failed) {
			passed += 1;
			continue;
		}
		console.log(`Run ${run} failed (exit code ${status}).`);
		for (const name of failed ?? ["no readable report"]) {
			console.log(`  ${name}`);
		}
	}
} finally {
	stopBurners();
}

console.log(`${passed} of ${runs} runs passed`);
process.exit(passed === runs ? 0 : 1);

// Null when the report is missing or does not parse.
function readFailedTests(): string[] | null {
	try {
		return failedTests(
			JSON.parse(readFileSync(reportFile, "utf8")),
			process.cwd(),
		);
	} catch {
		return null;
	}
}
