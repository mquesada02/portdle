import { afterEach, expect, test } from "vitest";
import indexHtml from "../index.html?raw";
import privacyHtml from "../privacy.html?raw";
import { THEME_KEY } from "./persist/storage";
import { stubMatchMedia } from "./test/helpers";
import script from "./theme-script.js?raw";

const MARKER = "<!--theme-script-->";

function run(stored: string | null, prefersDark: boolean): boolean {
	stubMatchMedia(prefersDark, false);
	localStorage.clear();
	if (stored !== null) {
		localStorage.setItem(THEME_KEY, stored);
	}
	document.documentElement.className = "";
	new Function(script)();
	return document.documentElement.classList.contains("dark");
}

afterEach(() => {
	localStorage.clear();
	document.documentElement.className = "";
	document.documentElement.removeAttribute("data-x");
});

test("the script reads the app's stored theme key", () => {
	expect(/getItem\("([^"]+)"\)/.exec(script)?.[1]).toBe(THEME_KEY);
});

test("a stored dark theme wins on a light system", () => {
	expect(run('"dark"', false)).toBe(true);
});

test("a stored light theme wins on a dark system", () => {
	expect(run('"light"', true)).toBe(false);
});

test.each([
	["system", '"system"'],
	["no value", null],
	["invalid JSON", "not json"],
	["another string", '"foo"'],
	["a number", "123"],
	["null", "null"],
])("%s follows the system on a dark and a light system", (_name, stored) => {
	expect(run(stored, true)).toBe(true);
	expect(run(stored, false)).toBe(false);
});

test("a throwing getItem follows the system and does not throw", () => {
	stubMatchMedia(true, false);
	const getItem = Storage.prototype.getItem;
	Storage.prototype.getItem = () => {
		throw new Error("blocked");
	};
	try {
		document.documentElement.className = "";
		expect(() => new Function(script)()).not.toThrow();
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	} finally {
		Storage.prototype.getItem = getItem;
	}
});

test("a throwing localStorage getter follows the system and does not throw", () => {
	stubMatchMedia(true, false);
	const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		get() {
			throw new Error("blocked");
		},
	});
	try {
		document.documentElement.className = "";
		expect(() => new Function(script)()).not.toThrow();
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	} finally {
		if (descriptor) {
			Object.defineProperty(window, "localStorage", descriptor);
		}
	}
});

test("the script only toggles the dark class of the html element", () => {
	stubMatchMedia(true, false);
	localStorage.clear();
	document.documentElement.className = "keep";
	const before = localStorage.length;
	new Function(script)();
	expect([...document.documentElement.classList].sort()).toEqual([
		"dark",
		"keep",
	]);
	expect(document.documentElement.attributes.length).toBe(1);
	expect(localStorage.length).toBe(before);
	expect(script).not.toContain("getElementById");
});

test.each([
	["index.html", indexHtml],
	["privacy.html", privacyHtml],
])(
	"%s has the marker once in the head, before every other head asset",
	(_name, html) => {
		expect(html.split(MARKER)).toHaveLength(2);
		const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
		const marker = head.indexOf(MARKER);
		expect(marker).toBeGreaterThan(-1);
		for (const asset of [
			'<link rel="stylesheet"',
			'<link rel="icon"',
			"<style",
			"<script",
		]) {
			const at = head.indexOf(asset);
			if (at !== -1) {
				expect(marker).toBeLessThan(at);
			}
		}
	},
);

test("privacy.html has no script element of its own", () => {
	expect(privacyHtml).not.toContain("<script");
});
