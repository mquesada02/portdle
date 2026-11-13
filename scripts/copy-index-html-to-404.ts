import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REDIRECT_SCRIPT_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"src",
	"old-board-redirect.js",
);

const HEAD_OPEN = /<head(?:\s[^>]*)?>/i;

// 404.html is index.html with the old-board-link redirect as the first child
// of <head>, so it runs before anything else. A function replacer inserts the
// script as literal text: `$&` in it is not a replacement pattern.
export function copyIndexHtmlTo404(outputDir: string): void {
	const index = readFileSync(join(outputDir, "index.html"), "utf8");
	const script = readFileSync(REDIRECT_SCRIPT_PATH, "utf8").trim();
	const html = index.replace(
		HEAD_OPEN,
		(head) => `${head}<script>${script}</script>`,
	);
	// The script is never empty, so an unchanged page had no <head>.
	if (html === index) {
		throw new Error("index.html has no <head> element.");
	}
	writeFileSync(join(outputDir, "404.html"), html);
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
