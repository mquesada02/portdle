import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	hydrationSignalEnv,
	NO_HYDRATION_WAIT,
	siteBuildArgs,
} from "./gate-build.ts";

const folders: string[] = [];

function checkout(): string {
	const folder = mkdtempSync(join(tmpdir(), "gate-build-"));
	folders.push(folder);
	return folder;
}

afterEach(() => {
	for (const folder of folders.splice(0)) {
		rmSync(folder, { recursive: true, force: true });
	}
});

describe("siteBuildArgs", () => {
	it("runs the pipeline in a checkout that has it", () => {
		const src = checkout();
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
		expect(siteBuildArgs(checkout(), "/out")).toEqual([
			"exec",
			"vite",
			"build",
			"--outDir",
			"/out",
			"--emptyOutDir",
		]);
	});
});

describe("hydrationSignalEnv", () => {
	it("leaves the tests waiting in a checkout that has the signal", () => {
		const src = checkout();
		mkdirSync(join(src, "src"));
		writeFileSync(join(src, "src", "hydrated-attribute.ts"), "");
		expect(hydrationSignalEnv(src)).toEqual({});
	});

	it("tells the tests not to wait in a checkout from before the signal", () => {
		expect(hydrationSignalEnv(checkout())).toEqual({
			[NO_HYDRATION_WAIT]: "1",
		});
	});
});
