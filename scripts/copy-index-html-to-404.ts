import { copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function copyIndexHtmlTo404(outputDir: string): void {
	copyFileSync(join(outputDir, "index.html"), join(outputDir, "404.html"));
}

const entry = process.argv[1];
if (
	entry !== undefined &&
	import.meta.url === pathToFileURL(resolve(entry)).href
) {
	copyIndexHtmlTo404(
		join(dirname(fileURLToPath(import.meta.url)), "..", "dist"),
	);
}
