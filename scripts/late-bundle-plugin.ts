import type { Plugin } from "vite";

const MODULE_SCRIPT = /<script\b[^>]*\btype="module"[^>]*>\s*<\/script>/g;
const MODULEPRELOAD = /<link\b[^>]*\brel="modulepreload"[^>]*>\s*/g;
const SRC = /\bsrc="([^"]*)"/;

// The bundle loads after the page's `load` event, so the first paint comes from
// the HTML and the stylesheet alone. The built page holds one module script
// (the entry); it becomes an inline loader that adds the script on `load`. A
// page with no module script (privacy.html) is returned as it is.
export function loadBundleLate(html: string): string {
	const scripts = html.match(MODULE_SCRIPT) ?? [];
	if (scripts.length === 0) {
		return html;
	}
	const tag = scripts[0] as string;
	const src = SRC.exec(tag)?.[1];
	if (scripts.length > 1 || src === undefined) {
		throw new Error(
			"A built page must hold one module script with a src attribute.",
		);
	}
	// No `<` inside the inline script, so a `</script>` in the path cannot end it.
	const path = JSON.stringify(src).replaceAll("<", "\\u003c");
	const loader =
		"<script>addEventListener(" +
		`"load",function(){var s=document.createElement("script");` +
		`s.type="module";s.src=${path};document.head.appendChild(s)})</script>`;
	return html.replace(MODULEPRELOAD, "").replace(MODULE_SCRIPT, () => loader);
}

export function lateBundlePlugin(): Plugin {
	return {
		name: "portdle-late-bundle",
		apply: "build",
		transformIndexHtml: { order: "post", handler: loadBundleLate },
	};
}
