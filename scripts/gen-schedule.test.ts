import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";

test("gen:schedule --check is idempotent on committed files", () => {
	expect(() =>
		execFileSync("pnpm", ["gen:schedule", "--check"], {
			env: { ...process.env, PORTDLE_UTC_TODAY: "2026-09-09" },
			stdio: "pipe",
		}),
	).not.toThrow();
});
