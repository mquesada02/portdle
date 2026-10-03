// `pnpm test:e2e`: builds the site against the running local stack and runs
// the Playwright suite (e2e/) on that build. It does not start the stack or
// fill the Schedule: `pnpm dev` and `pnpm dev:schedule` do, and CI runs the
// generator before this step. It never stops the stack, which other
// worktrees share.
// pnpm puts the supabase, vite, and playwright binaries on PATH for package
// scripts.

import { execFileSync, spawnSync } from "node:child_process";
import { checkStack } from "./e2e-env.ts";
import { parseStackEnv } from "./stack-env.ts";

let env: ReturnType<typeof parseStackEnv>;
try {
	env = parseStackEnv(
		execFileSync("supabase", ["status", "-o", "env"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}),
	);
	await checkStack(env.apiUrl, env.publishableKey);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}

// No `tsc -b` here: `pnpm typecheck` runs it.
execFileSync("vite", ["build", "--outDir", "dist-e2e", "--emptyOutDir"], {
	stdio: "inherit",
	env: {
		...process.env,
		VITE_SUPABASE_URL: env.apiUrl,
		VITE_SUPABASE_ANON_KEY: env.publishableKey,
	},
});

const result = spawnSync("playwright", ["test", ...process.argv.slice(2)], {
	stdio: "inherit",
	env: {
		...process.env,
		E2E_API_URL: env.apiUrl,
		E2E_PUBLISHABLE_KEY: env.publishableKey,
	},
});
process.exit(result.status ?? 1);
