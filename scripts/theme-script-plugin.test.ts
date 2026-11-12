import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { injectThemeScript, themeScriptPlugin } from "./theme-script-plugin.ts";

const MARKER = "<!--theme-script-->";

test("injectThemeScript replaces the marker with the script as literal text", () => {
	const html = injectThemeScript(
		`<head>${MARKER}</head>`,
		"a = '$&' + \"$'\";",
	);
	expect(html).toBe("<head><script>a = '$&' + \"$'\";</script></head>");
});

test("injectThemeScript throws when the page has no marker", () => {
	expect(() => injectThemeScript("<head></head>", "x")).toThrow(MARKER);
});

test("the plugin hook puts the text of src/theme-script.js into a page", () => {
	const hook = themeScriptPlugin().transformIndexHtml;
	if (typeof hook !== "object" || hook === null || !("handler" in hook)) {
		throw new Error("expected an object hook with a handler");
	}
	const handler = hook.handler as (html: string) => string;
	const out = handler(`<head>${MARKER}</head>`);
	const script = readFileSync("src/theme-script.js", "utf8").trim();
	expect(out).toBe(`<head><script>${script}</script></head>`);
});
