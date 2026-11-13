import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import type { Head } from "../src/ui/head";
import { copyIndexHtmlTo404 } from "./copy-index-html-to-404";
import { createPagesServer, MANIFEST_FILE } from "./pages-server";
import { fileOf, prerender, verifyBuild } from "./prerender";

const TEMPLATE =
	'<!doctype html><html><head><meta charset="UTF-8" /><title>Portdle</title></head><body><div id="root"></div></body></html>';
const PRIVACY =
	'<html><head><meta name="description" content="p" /><link rel="canonical" href="https://x/privacy" /></head></html>';

const HEAD: Record<string, Head> = {
	"/": { title: "Home", description: "The home.", canonical: "https://x/" },
	"/history/blitz": {
		title: "Blitz <history> & more",
		description: 'Say "hi".',
		canonical: "https://x/history/blitz",
	},
	"/archive/board": {
		title: "Board",
		description: "A board.",
		canonical: null,
	},
};
const ROUTES = ["/", "/history/blitz", "/archive/board"];

const dirs: string[] = [];
function folder(): string {
	const dir = mkdtempSync(join(tmpdir(), "portdle-prerender-"));
	dirs.push(dir);
	writeFileSync(join(dir, "index.html"), TEMPLATE);
	writeFileSync(join(dir, "privacy.html"), PRIVACY);
	return dir;
}
afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

const render = (path: string) => `<main>${path}</main>`;

function written(dir: string, file: string): string {
	return readFileSync(join(dir, file), "utf8");
}

test("fileOf maps a route to its file", () => {
	expect(fileOf("/")).toBe("index.html");
	expect(fileOf("/protocols")).toBe("protocols.html");
	expect(fileOf("/history/blitz")).toBe("history/blitz.html");
	expect(fileOf("/archive/board")).toBe("archive/board.html");
});

test("prerender writes each route's file with its markup and head tags", async () => {
	const dir = folder();
	await prerender({ outDir: dir, routes: ROUTES, head: HEAD, render });
	const home = written(dir, "index.html");
	expect(home).toContain('<div id="root"><main>/</main></div>');
	expect(home).toContain("<title>Home</title>");
	expect(home).toContain('<meta name="description" content="The home." />');
	expect(home).toContain('<link rel="canonical" href="https://x/" />');
	expect(home).not.toContain("<title>Portdle</title>");
	expect(written(dir, "history/blitz.html")).toContain(
		'<link rel="canonical" href="https://x/history/blitz" />',
	);
});

test("prerender escapes the head texts", async () => {
	const dir = folder();
	await prerender({ outDir: dir, routes: ROUTES, head: HEAD, render });
	const html = written(dir, "history/blitz.html");
	expect(html).toContain("<title>Blitz &lt;history&gt; &amp; more</title>");
	expect(html).toContain('content="Say &quot;hi&quot;."');
});

test("the board file has no canonical link and renders with a valid query", async () => {
	const dir = folder();
	await prerender({ outDir: dir, routes: ROUTES, head: HEAD, render });
	const html = written(dir, "archive/board.html");
	expect(html).not.toContain("canonical");
	expect(html).toContain(
		"<main>/archive/board?category=mixed&date=2026-10-09</main>",
	);
});

test("prerender writes the manifest with the routes, and does not change the markup of a function replacer", async () => {
	const dir = folder();
	await prerender({
		outDir: dir,
		routes: ROUTES,
		head: HEAD,
		render: () => "$& $1",
	});
	expect(JSON.parse(written(dir, MANIFEST_FILE))).toEqual({ routes: ROUTES });
	expect(written(dir, "index.html")).toContain('<div id="root">$& $1</div>');
});

test("a route with no head entry throws and writes no file", async () => {
	const dir = folder();
	await expect(
		prerender({
			outDir: dir,
			routes: ["/", "/missing"],
			head: HEAD,
			render,
		}),
	).rejects.toThrow("/missing");
	expect(existsSync(join(dir, MANIFEST_FILE))).toBe(false);
	expect(written(dir, "index.html")).toBe(TEMPLATE);
});

test("a template with no empty root or no title throws", async () => {
	const dir = folder();
	writeFileSync(join(dir, "index.html"), "<html><title>x</title></html>");
	await expect(
		prerender({ outDir: dir, routes: ["/"], head: HEAD, render }),
	).rejects.toThrow("root");
	writeFileSync(join(dir, "index.html"), '<div id="root"></div>');
	await expect(
		prerender({ outDir: dir, routes: ["/"], head: HEAD, render }),
	).rejects.toThrow("title");
});

async function prerendered(): Promise<string> {
	const dir = folder();
	copyIndexHtmlTo404(dir);
	await prerender({ outDir: dir, routes: ROUTES, head: HEAD, render });
	return dir;
}

test("verifyBuild passes on a prerendered folder", async () => {
	const dir = await prerendered();
	expect(() =>
		verifyBuild({ outDir: dir, routes: ROUTES, head: HEAD }),
	).not.toThrow();
});

test("verifyBuild names a route with no head entry", async () => {
	const dir = await prerendered();
	expect(() =>
		verifyBuild({ outDir: dir, routes: [...ROUTES, "/new"], head: HEAD }),
	).toThrow("/new: no head entry");
});

test("verifyBuild names a route with no file", async () => {
	const dir = await prerendered();
	rmSync(join(dir, "history/blitz.html"));
	expect(() =>
		verifyBuild({ outDir: dir, routes: ROUTES, head: HEAD }),
	).toThrow("history/blitz.html");
});

test("verifyBuild does not check a route that is not in the list", async () => {
	const dir = await prerendered();
	rmSync(join(dir, "history/blitz.html"));
	expect(() =>
		verifyBuild({
			outDir: dir,
			routes: ["/", "/archive/board"],
			head: HEAD,
		}),
	).not.toThrow();
});

test("verifyBuild fails on a file with another title or a missing description", async () => {
	const dir = await prerendered();
	writeFileSync(join(dir, "index.html"), TEMPLATE);
	expect(() => verifyBuild({ outDir: dir, routes: ["/"], head: HEAD })).toThrow(
		"missing <title>Home</title>",
	);
});

test("verifyBuild fails on a missing manifest, a 404.html with markup and a bare privacy.html", async () => {
	const dir = await prerendered();
	rmSync(join(dir, MANIFEST_FILE));
	writeFileSync(join(dir, "404.html"), written(dir, "index.html"));
	writeFileSync(join(dir, "privacy.html"), "<html></html>");
	let message = "";
	try {
		verifyBuild({ outDir: dir, routes: ROUTES, head: HEAD });
	} catch (error) {
		message = String(error);
	}
	expect(message).toContain(`no ${MANIFEST_FILE}`);
	expect(message).toContain("404.html: #root is not empty");
	expect(message).toContain("404.html: no board redirect script");
	expect(message).toContain("privacy.html: no meta description");
	expect(message).toContain("privacy.html: no canonical link");
});

test("the Pages-like server serves each page route with its markup, and an unknown path with 404.html", async () => {
	const dir = await prerendered();
	const server = createPagesServer(dir, "/portdle/");
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	try {
		const { port } = server.address() as AddressInfo;
		const get = async (path: string) => {
			const response = await fetch(`http://127.0.0.1:${port}${path}`);
			return { status: response.status, body: await response.text() };
		};
		const cases: [string, string, string][] = [
			["/portdle/", "<main>/</main>", "<title>Home</title>"],
			[
				"/portdle/history/blitz",
				"<main>/history/blitz</main>",
				"<title>Blitz &lt;history&gt; &amp; more</title>",
			],
			[
				"/portdle/archive/board?category=mixed&date=2026-10-09",
				"<main>/archive/board?category=mixed&date=2026-10-09</main>",
				"<title>Board</title>",
			],
		];
		for (const [path, markup, title] of cases) {
			const { status, body } = await get(path);
			expect(status).toBe(200);
			expect(body).toContain(markup);
			expect(body).toContain(title);
		}
		const unknown = await get("/portdle/nowhere");
		expect(unknown.status).toBe(404);
		expect(unknown.body).toBe(written(dir, "404.html"));
	} finally {
		await new Promise((done) => server.close(done));
	}
});
