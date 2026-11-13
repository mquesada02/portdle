import { existsSync } from "node:fs";
import { join } from "node:path";

// The `pnpm` arguments that build the site of the checkout `src` into `outDir`
// (an absolute path). A checkout that has the build pipeline builds with it.
// A merge-base from before the pipeline has no scripts/build-site.ts and
// builds with its own `vite build`; the Pages-like server then serves it in
// fallback mode.
export function siteBuildArgs(src: string, outDir: string): string[] {
	if (existsSync(join(src, "scripts", "build-site.ts"))) {
		return ["exec", "tsx", "scripts/build-site.ts", "--out", outDir];
	}
	return ["exec", "vite", "build", "--outDir", outDir, "--emptyOutDir"];
}

// The environment variable that tells the gate tests not to wait for the
// hydration signal (see scripts/wait-for-hydration.ts).
export const NO_HYDRATION_WAIT = "PORTDLE_GATE_NO_HYDRATION_WAIT";

// A merge-base from before the signal builds a site that never sets it, so the
// tests of this checkout must not wait for it there. Such a build is the
// baseline capture, which has the old click race; the checkout that has the
// signal waits for it.
export function hydrationSignalEnv(src: string): Record<string, string> {
	return existsSync(join(src, "src", "hydrated-attribute.ts"))
		? {}
		: { [NO_HYDRATION_WAIT]: "1" };
}
