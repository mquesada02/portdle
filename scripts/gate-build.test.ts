import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteBuildArgs } from "./gate-build.ts";

describe("siteBuildArgs", () => {
	it("runs the pipeline in a checkout that has it", () => {
		const src = mkdtempSync(join(tmpdir(), "gate-build-"));
		mkdirSync(join(src, "scripts"));
		writeFileSync(join(src, "scripts", "build-site.ts"), "");
		expect(siteBuildArgs(src, "/out")).toEqual([
			"exec",
			"tsx",
			"scripts/build-site.ts",
			"--out",
			"/out",
		]);
	});

	it("runs vite build in a checkout from before the pipeline", () => {
		const src = mkdtempSync(join(tmpdir(), "gate-build-"));
		expect(siteBuildArgs(src, "/out")).toEqual([
			"exec",
			"vite",
			"build",
			"--outDir",
			"/out",
			"--emptyOutDir",
		]);
	});
});
