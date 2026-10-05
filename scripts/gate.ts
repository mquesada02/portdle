// `pnpm gate`: builds the stub build (the site with its backend address set to
// the stub host) and runs the screenshot gate (gate/) against it. It compares
// with gate-baseline/ and never writes it. `pnpm gate:capture` (--capture)
// writes gate-baseline/ instead. `--src <dir>` builds the site from another
// checkout (CI uses it to capture the merge-base commit); the gate tests are
// always the ones in this checkout. No stack is needed: Playwright answers the
// backend. pnpm puts the vite and playwright binaries on PATH for scripts.

import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { STUB_KEY, STUB_URL } from "../gate/stub.ts";

const args = process.argv.slice(2);
const capture = args.includes("--capture");
const srcIndex = args.indexOf("--src");
const src = srcIndex === -1 ? "." : (args[srcIndex + 1] ?? ".");
const rest = args.filter(
	(arg, index) =>
		arg !== "--capture" && arg !== "--src" && index !== srcIndex + 1,
);

// No `tsc -b` here: `pnpm typecheck` runs it.
execFileSync(
	"pnpm",
	["exec", "vite", "build", "--outDir", resolve("dist-gate"), "--emptyOutDir"],
	{
		cwd: src,
		stdio: "inherit",
		env: {
			...process.env,
			VITE_SUPABASE_URL: STUB_URL,
			VITE_SUPABASE_ANON_KEY: STUB_KEY,
		},
	},
);

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
process.exit(result.status ?? 1);
