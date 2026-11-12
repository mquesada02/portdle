import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

const MARKER = "<!--theme-script-->";
const SCRIPT_PATH = "src/theme-script.js";

// A function replacer inserts the script as literal text: `$&` in it is not a
// replacement pattern.
export function injectThemeScript(html: string, script: string): string {
	if (!html.includes(MARKER)) {
		throw new Error(`The page has no ${MARKER} marker.`);
	}
	return html.replace(MARKER, () => `<script>${script}</script>`);
}

// The script is shared by every HTML input: index.html and privacy.html.
export function themeScriptPlugin(): Plugin {
	return {
		name: "portdle-theme-script",
		transformIndexHtml: {
			order: "pre",
			handler: (html) =>
				injectThemeScript(html, readFileSync(SCRIPT_PATH, "utf8").trim()),
		},
	};
}
