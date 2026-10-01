// `pnpm dev`: starts or reuses the Supabase CLI local stack (Docker), applies
// migrations the stack has not seen, then starts Vite pointed at the stack.
// The stack keeps running when Vite exits; stop it with `pnpm exec supabase stop`.
// If the stack cannot start, nothing else runs: Docker must be running.

import { execFileSync, spawn } from "node:child_process";
import { parseStackEnv, type StackEnv } from "./stack-env.ts";

function supabase(args: string[]): string {
	return execFileSync("pnpm", ["exec", "supabase", ...args], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});
}

let env: StackEnv;
try {
	supabase(["start"]);
	supabase(["migration", "up", "--local"]);
	env = parseStackEnv(supabase(["status", "-o", "env"]));
} catch (error) {
	console.error(
		`Could not start the local Supabase stack. Docker must be running.\n${error instanceof Error ? error.message : error}`,
	);
	process.exit(1);
}

const vite = spawn("pnpm", ["exec", "vite", ...process.argv.slice(2)], {
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
