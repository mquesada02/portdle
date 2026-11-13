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
