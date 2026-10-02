// `pnpm dev`: starts or reuses the Supabase CLI local stack (Docker), applies
// migrations the stack has not seen, then starts Vite pointed at the stack.
// The stack keeps running when Vite exits; stop it with `pnpm exec supabase stop`.
// It then fills the Schedule through the frozen-through day + 7 with the
// generator role (scripts/fill-local-schedule.ts).
// If the stack cannot start, nothing else runs: Docker must be running.
// pnpm puts the supabase binary on PATH for package scripts.

import { execFileSync, spawn } from "node:child_process";
import { fillLocalSchedule } from "./fill-local-schedule.ts";
import { parseStackEnv, type StackEnv } from "./stack-env.ts";

function supabase(args: string[]): string {
	return execFileSync("supabase", args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});
}

function startStack(): StackEnv {
	supabase(["start"]);
	supabase(["migration", "up", "--local"]);
	return parseStackEnv(supabase(["status", "-o", "env"]));
}

let env: StackEnv;
try {
	env = startStack();
} catch (error) {
	console.error(
		`Could not start the local Supabase stack. Docker must be running.\n${error}`,
	);
	process.exit(1);
}

try {
	const { inserted, removed } = await fillLocalSchedule(env.dbUrl);
	console.log(`Local Schedule: ${inserted} rows inserted, ${removed} removed.`);
} catch (error) {
	console.error(`Could not fill the local Schedule.\n${error}`);
	process.exit(1);
}

const vite = spawn("vite", process.argv.slice(2), {
	stdio: "inherit",
	env: {
		...process.env,
		VITE_SUPABASE_URL: env.apiUrl,
		VITE_SUPABASE_ANON_KEY: env.publishableKey,
	},
});
vite.on("exit", (code, signal) => {
	process.exit(code ?? (signal ? 1 : 0));
});
