import { describe, expect, it } from "vitest";
import { lateBundlePlugin, loadBundleLate } from "./late-bundle-plugin.ts";

const ENTRY =
	'<script type="module" crossorigin src="/portdle/assets/index-a1.js"></script>';
const PRELOAD =
	'<link rel="modulepreload" crossorigin href="/portdle/assets/vendor-b2.js">';
const STYLE =
	'<link rel="stylesheet" crossorigin href="/portdle/assets/index-c3.css">';
const page = (head: string) =>
	`<!doctype html><html><head>${head}</head><body><div id="root"></div></body></html>`;

describe("loadBundleLate", () => {
	it("replaces the module script with an inline loader that starts on load", () => {
		const out = loadBundleLate(page(`${ENTRY}${PRELOAD}${STYLE}`));
		expect(out).not.toContain(ENTRY);
		expect(out).toContain('addEventListener("load"');
		expect(out).toContain('s.src="/portdle/assets/index-a1.js"');
		expect(out).toContain('s.type="module"');
		expect(out).toContain("first-contentful-paint");
	});

	it("removes the modulepreload links and keeps the stylesheet", () => {
		const out = loadBundleLate(page(`${ENTRY}${PRELOAD}${STYLE}`));
		expect(out).not.toContain("modulepreload");
		expect(out).toContain(STYLE);
	});

	it("leaves a page with no module script as it is", () => {
		const html = page("<title>Privacy</title>");
		expect(loadBundleLate(html)).toBe(html);
	});

	it("throws on a page with two module scripts", () => {
		expect(() => loadBundleLate(page(`${ENTRY}${ENTRY}`))).toThrow(
			"one module script",
		);
	});

	it("keeps `<` out of the inline script", () => {
		const out = loadBundleLate(
			page('<script type="module" src="/a<b.js"></script>'),
		);
		const loader = out.slice(
			out.indexOf("<script>") + 8,
			out.indexOf("</script>"),
		);
		expect(loader).toContain("/a\\u003cb.js");
		expect(loader).not.toContain("<");
	});

	it("inserts the loader text as it is ($& is no pattern)", () => {
		const out = loadBundleLate(
			page('<script type="module" src="/a$&b.js"></script>'),
		);
		expect(out).toContain('s.src="/a$&b.js"');
	});
});

// Runs the inline loader of a built page with fakes for the browser globals.
// `observer` is the fake PerformanceObserver class (or undefined for a browser
// without it); the result has the scripts that the loader added.
function runLoader(
	observer: unknown,
	timers: { set: (fn: () => void, ms: number) => void } = {
		set: () => {},
	},
) {
	const html = loadBundleLate(page(ENTRY));
	const code = html.slice(
		html.indexOf("<script>") + 8,
		html.indexOf("</script>"),
	);
	const added: { type?: string; src?: string }[] = [];
	const listeners: Record<string, () => void> = {};
	const document = {
		createElement: () => ({}) as { type?: string; src?: string },
		head: {
			appendChild: (node: { type?: string; src?: string }) => added.push(node),
		},
	};
	new Function(
		"addEventListener",
		"PerformanceObserver",
		"document",
		"setTimeout",
		code,
	)(
		(name: string, fn: () => void) => {
			listeners[name] = fn;
		},
		observer,
		document,
		timers.set,
	);
	return { added, load: () => listeners.load?.() };
}

// A fake PerformanceObserver: `emit` delivers a list of paint entry names.
function fakeObserver(options: { throws?: boolean } = {}) {
	const state: {
		callback?: (list: { getEntriesByName: (n: string) => unknown[] }) => void;
		observed?: unknown;
	} = {};
	class Fake {
		constructor(
			callback: (list: { getEntriesByName: (n: string) => unknown[] }) => void,
		) {
			state.callback = callback;
		}
		observe(init: unknown) {
			if (options.throws) {
				throw new Error("unsupported entry type");
			}
			state.observed = init;
		}
	}
	const emit = (...names: string[]) =>
		state.callback?.({
			getEntriesByName: (name) => names.filter((n) => n === name),
		});
	return { Fake, emit, state };
}

describe("the loader at run time", () => {
	it("adds nothing before load", () => {
		const { Fake } = fakeObserver();
		expect(runLoader(Fake).added).toEqual([]);
	});

	it("adds nothing on load alone, and observes paint entries (buffered)", () => {
		const { Fake, state } = fakeObserver();
		const { added, load } = runLoader(Fake);
		load();
		expect(added).toEqual([]);
		expect(state.observed).toEqual({ type: "paint", buffered: true });
	});

	it("adds the module script once on the first-contentful-paint entry", () => {
		const { Fake, emit } = fakeObserver();
		const { added, load } = runLoader(Fake);
		load();
		emit("first-contentful-paint");
		emit("first-contentful-paint");
		expect(added).toEqual([
			{ type: "module", src: "/portdle/assets/index-a1.js" },
		]);
	});

	it("does not add it for a first-paint entry alone", () => {
		const { Fake, emit } = fakeObserver();
		const { added, load } = runLoader(Fake);
		load();
		emit("first-paint");
		expect(added).toEqual([]);
	});

	it("adds it when the timer fires with no paint entry, and only once", () => {
		const { Fake, emit } = fakeObserver();
		const pending: { fn: () => void; ms: number }[] = [];
		const { added, load } = runLoader(Fake, {
			set: (fn, ms) => pending.push({ fn, ms }),
		});
		load();
		expect(pending.map((timer) => timer.ms)).toEqual([3000]);
		pending[0]?.fn();
		emit("first-contentful-paint");
		expect(added).toHaveLength(1);
	});

	it("adds it once when the entry comes first and the timer fires later", () => {
		const { Fake, emit } = fakeObserver();
		const pending: (() => void)[] = [];
		const { added, load } = runLoader(Fake, {
			set: (fn) => pending.push(fn),
		});
		load();
		emit("first-contentful-paint");
		pending[0]?.();
		expect(added).toHaveLength(1);
	});

	it("adds it at once when PerformanceObserver is missing", () => {
		const { added, load } = runLoader(undefined);
		load();
		expect(added).toHaveLength(1);
	});

	it("adds it at once when observing paint entries throws", () => {
		const { Fake } = fakeObserver({ throws: true });
		const { added, load } = runLoader(Fake);
		load();
		expect(added).toHaveLength(1);
	});
});

describe("lateBundlePlugin", () => {
	it("runs in builds only, after Vite's own tags", () => {
		const plugin = lateBundlePlugin();
		expect(plugin.apply).toBe("build");
		expect(plugin.transformIndexHtml).toMatchObject({ order: "post" });
	});
});
