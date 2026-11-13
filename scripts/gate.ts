// `pnpm gate`: builds the stub build (the site with its backend address set to
// the stub host) and runs the screenshot gate (gate/) against it. It compares
// with gate-baseline/ and never writes it. `pnpm gate:capture` (--capture)
// writes gate-baseline/ instead. `--src <dir>` builds the site from another
// checkout (CI uses it to capture the merge-base commit); the gate tests are
// always the ones in this checkout. The build runs the build pipeline of the
// checkout (prerender, 404.html); a merge-base from before the pipeline builds
// with `vite build` (see gate-build.ts). No stack is needed: Playwright answers
// the backend. `pnpm exec` runs the tools of the `--src` checkout; pnpm puts
// the playwright binary on PATH for scripts. The run reports to
// gate-results.json, which tells frame differences (exit code 2) from errors.
// A capture with `--src` exits 0 when tests error: see isCaptureErrorsOnly.

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { STUB_KEY, STUB_URL } from "../gate/stub.ts";
import { siteBuildArgs } from "./gate-build.ts";
import {
	classifyReport,
	type GateOutcome,
	isCaptureErrorsOnly,
} from "./gate-report.ts";

// Exit code when frames differ and no test errored (an error exits with 1).
// The CI label step excuses only this code.
const EXIT_DIFFERENCES = 2;
const REPORT = "gate-results.json";

let capture = false;
let src = ".";
const rest: string[] = [];
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
	const arg = args[index];
	if (arg === "--capture") {
		capture = true;
	} else if (arg === "--src") {
		const value = args[++index];
		if (value === undefined) {
			console.error("--src needs a directory.");
			process.exit(1);
		}
		src = value;
	} else if (arg !== undefined) {
		rest.push(arg);
	}
}

// No `tsc -b` here: `pnpm typecheck` runs it.
execFileSync("pnpm", siteBuildArgs(src, resolve("dist-gate")), {
	cwd: src,
	stdio: "inherit",
	env: {
		...process.env,
		VITE_SUPABASE_URL: STUB_URL,
		VITE_SUPABASE_ANON_KEY: STUB_KEY,
	},
});

rmSync(REPORT, { force: true });
const result = spawnSync(
	"playwright",
	[
		"test",
		"-c",
		"playwright.gate.config.ts",
		`--update-snapshots=${capture ? "all" : "none"}`,
		...rest,
	],
	{ stdio: "inherit" },
);
const status = result.status ?? 1;
if (status === 0) {
	process.exit(0);
}
let report: unknown = null;
try {
	report = JSON.parse(readFileSync(REPORT, "utf8"));
} catch {
	// No readable report: it classifies as "errors".
}
// A capture of another checkout reports errored tests, but does not fail: their
// frames are new frames in the compare. A capture of this checkout stays strict.
if (capture && resolve(src) !== resolve(".") && isCaptureErrorsOnly(report)) {
	console.error(
		"gate: tests errored on the --src checkout; their frames stay uncaptured.",
	);
	process.exit(0);
}
const outcome: GateOutcome = classifyReport(report);
process.exit(outcome === "differences" ? EXIT_DIFFERENCES : status);
