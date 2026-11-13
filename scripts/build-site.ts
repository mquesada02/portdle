// The deployed build as one pipeline: the client build, the SSR build of the
// server entry, the 404.html step, the prerender and its check.
//
// `tsx scripts/build-site.ts [--out <folder>]` builds into the folder (default
// `dist`).

import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { HEAD } from "../src/ui/head.ts";
import { copyIndexHtmlTo404 } from "./copy-index-html-to-404.ts";
import { option } from "./pages-server.ts";
import { type PrerenderInput, prerender, verifyBuild } from "./prerender.ts";

// Steps 3 to 5 of the pipeline, on a folder that holds the client build. The
// 404.html step runs before the prerender, so 404.html is the template with an
// empty #root; the prerender then fills the route files.
export async function finishBuild(input: PrerenderInput): Promise<void> {
	copyIndexHtmlTo404(input.outDir);
	await prerender(input);
	verifyBuild(input);
}

// What src/entry-server.tsx exports. The type is written here because the node
// tsconfig has no DOM or JSX, so it cannot import the entry's types.
type ServerEntry = {
	renderRoute: (path: string) => Promise<string>;
	pageRoutePaths: string[];
};

const SSR_ROOT = join("node_modules", ".tmp", "portdle-ssr");

export async function buildSite(options: { outDir: string }): Promise<void> {
	const outDir = resolve(options.outDir);
	await build({ build: { outDir, emptyOutDir: true } });
	const ssrDir = resolve(SSR_ROOT, basename(outDir));
	await build({
		build: {
			ssr: "src/entry-server.tsx",
			outDir: ssrDir,
			emptyOutDir: true,
			copyPublicDir: false,
			rollupOptions: { output: { entryFileNames: "entry-server.js" } },
		},
	});
	const entry = (await import(
		pathToFileURL(join(ssrDir, "entry-server.js")).href
	)) as ServerEntry;
	await finishBuild({
		outDir,
		render: entry.renderRoute,
		routes: entry.pageRoutePaths,
		head: HEAD,
	});
}

const entry = process.argv[1];
if (
	entry !== undefined &&
	import.meta.url === pathToFileURL(resolve(entry)).href
) {
	buildSite({ outDir: option("--out") ?? "dist" }).catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
