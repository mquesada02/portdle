import { describe, expect, it } from "vitest";
import { lateBundlePlugin, loadBundleLate } from "./late-bundle-plugin.ts";

const ENTRY =
	'<script type="module" crossorigin src="/portdle/assets/index-a1.js"></script>';
const PRELOAD =
	'<link rel="modulepreload" crossorigin href="/portdle/assets/vendor-b2.js">';
const STYLE =
	'<link rel="stylesheet" crossorigin href="/portdle/assets/index-c3.css">';
const EARLY_TAP = "(()=>{})();";
const late = (html: string) => loadBundleLate(html, EARLY_TAP);
const page = (head: string) =>
	`<!doctype html><html><head>${head}</head><body><div id="root"></div></body></html>`;

describe("loadBundleLate", () => {
	it("replaces the module script with a loader that runs on load", () => {
		const out = late(page(`${ENTRY}${PRELOAD}${STYLE}`));
		expect(out).not.toContain(ENTRY);
		expect(out).toContain('addEventListener("load"');
		expect(out).toContain('s.src="/portdle/assets/index-a1.js"');
		expect(out).toContain('s.type="module"');
	});

	it("starts the loader with the early tap script", () => {
		const out = late(page(ENTRY));
		expect(out).toContain(`<script>${EARLY_TAP}addEventListener("load"`);
	});

	it("throws on an early tap script that holds a <", () => {
		expect(() => loadBundleLate(page(ENTRY), "1<2;")).toThrow("<");
	});

	it("removes the modulepreload links and keeps the stylesheet", () => {
		const out = late(page(`${ENTRY}${PRELOAD}${STYLE}`));
		expect(out).not.toContain("modulepreload");
		expect(out).toContain(STYLE);
	});

	it("leaves a page with no module script as it is", () => {
		const html = page("<title>Privacy</title>");
		expect(late(html)).toBe(html);
	});

	it("throws on a page with two module scripts", () => {
		expect(() => late(page(`${ENTRY}${ENTRY}`))).toThrow("one module script");
	});

	it("keeps `<` out of the inline script", () => {
		const out = late(page('<script type="module" src="/a<b.js"></script>'));
		const loader = out.slice(
			out.indexOf("<script>") + 8,
			out.indexOf("</script>"),
		);
		expect(loader).toContain("/a\\u003cb.js");
		expect(loader).not.toContain("<");
	});

	it("inserts the loader text as it is ($& is no pattern)", () => {
		const out = late(page('<script type="module" src="/a$&b.js"></script>'));
		expect(out).toContain('s.src="/a$&b.js"');
	});
});

describe("lateBundlePlugin", () => {
	it("runs in builds only, after Vite's own tags", () => {
		const plugin = lateBundlePlugin();
		expect(plugin.apply).toBe("build");
		expect(plugin.transformIndexHtml).toMatchObject({ order: "post" });
	});
});
