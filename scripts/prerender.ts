import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Head } from "../src/ui/head.ts";
import { REDIRECT_SCRIPT_PATH } from "./copy-index-html-to-404.ts";
import { MANIFEST_FILE } from "./pages-server.ts";

// What the prerender and its check need: the build folder, the page route
// paths (without the base), and the head table. The prerender also needs
// `render`, which returns the markup of one route.
export type BuildCheck = {
	outDir: string;
	routes: string[];
	head: Record<string, Head>;
};
export type PrerenderInput = BuildCheck & {
	render: (path: string) => string | Promise<string>;
};

const EMPTY_ROOT = '<div id="root"></div>';
const TITLE_ELEMENT = /<title>[^<]*<\/title>/;

// A route renders with the query that gives it a valid page. One file serves
// every board, and the board's frame is the same for every board.
const RENDER_QUERY: Record<string, string> = {
	"/archive/board": "?category=mixed&date=2026-10-09",
};

// `/` is index.html, `/x` is x.html, `/a/b` is a/b.html.
export function fileOf(route: string): string {
	return route === "/" ? "index.html" : `${route.slice(1)}.html`;
}

function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function titleTag(head: Head): string {
	return `<title>${escapeHtml(head.title)}</title>`;
}

function descriptionTag(head: Head): string {
	return `<meta name="description" content="${escapeHtml(head.description)}" />`;
}

function canonicalTag(canonical: string): string {
	return `<link rel="canonical" href="${escapeHtml(canonical)}" />`;
}

function page(template: string, head: Head, markup: string): string {
	if (!template.includes(EMPTY_ROOT)) {
		throw new Error(`The template has no ${EMPTY_ROOT}.`);
	}
	if (!TITLE_ELEMENT.test(template)) {
		throw new Error("The template has no <title> element.");
	}
	const tags = [
		titleTag(head),
		descriptionTag(head),
		...(head.canonical === null ? [] : [canonicalTag(head.canonical)]),
	].join("");
	// Function replacers insert the text as it is: `$&` in it is no pattern.
	return template
		.replace(EMPTY_ROOT, () => `<div id="root">${markup}</div>`)
		.replace(TITLE_ELEMENT, () => tags);
}

// Writes one file per route from the pristine index.html, and the manifest.
// A route with no head entry throws before any file is written.
export async function prerender(input: PrerenderInput): Promise<void> {
	const { outDir, routes, head, render } = input;
	const missing = routes.filter((route) => head[route] === undefined);
	if (missing.length > 0) {
		throw new Error(`No head entry for: ${missing.join(", ")}`);
	}
	const template = readFileSync(join(outDir, "index.html"), "utf8");
	const files = new Map<string, string>();
	for (const route of routes) {
		const entry = head[route] as Head;
		const markup = await render(`${route}${RENDER_QUERY[route] ?? ""}`);
		files.set(fileOf(route), page(template, entry, markup));
	}
	for (const [file, html] of files) {
		mkdirSync(dirname(join(outDir, file)), { recursive: true });
		writeFileSync(join(outDir, file), html);
	}
	writeFileSync(
		join(outDir, MANIFEST_FILE),
		`${JSON.stringify({ routes }, null, 2)}\n`,
	);
}

function read(outDir: string, file: string): string | undefined {
	try {
		return readFileSync(join(outDir, file), "utf8");
	} catch {
		return undefined;
	}
}

// Throws, naming every problem, when the build lacks what the app serves: a
// page route with no head entry, no file or a file without its head tags; no
// manifest; a 404.html that is not an empty app shell with the board redirect;
// a privacy.html without its description or canonical link.
export function verifyBuild(input: BuildCheck): void {
	const { outDir, routes, head } = input;
	const problems: string[] = [];
	for (const route of routes) {
		const entry = head[route];
		if (entry === undefined) {
			problems.push(`${route}: no head entry`);
			continue;
		}
		const file = fileOf(route);
		const html = read(outDir, file);
		if (html === undefined) {
			problems.push(`${route}: no file ${file}`);
			continue;
		}
		const expected = [titleTag(entry), descriptionTag(entry)];
		if (entry.canonical !== null) {
			expected.push(canonicalTag(entry.canonical));
		} else if (html.includes('rel="canonical"')) {
			problems.push(`${file}: has a canonical link, its entry has none`);
		}
		for (const tag of expected) {
			if (!html.includes(tag)) {
				problems.push(`${file}: missing ${tag}`);
			}
		}
	}
	if (read(outDir, MANIFEST_FILE) === undefined) {
		problems.push(`no ${MANIFEST_FILE}`);
	}
	const notFound = read(outDir, "404.html");
	if (notFound === undefined) {
		problems.push("no 404.html");
	} else {
		if (!notFound.includes(EMPTY_ROOT)) {
			problems.push("404.html: #root is not empty");
		}
		const redirect = readFileSync(REDIRECT_SCRIPT_PATH, "utf8").trim();
		if (!notFound.includes(redirect)) {
			problems.push("404.html: no board redirect script");
		}
	}
	const privacy = read(outDir, "privacy.html");
	if (privacy === undefined) {
		problems.push("no privacy.html");
	} else {
		if (!/<meta\s+name="description"/.test(privacy)) {
			problems.push("privacy.html: no meta description");
		}
		if (!/<link\s+rel="canonical"/.test(privacy)) {
			problems.push("privacy.html: no canonical link");
		}
	}
	if (problems.length > 0) {
		throw new Error(`The build is incomplete:\n${problems.join("\n")}`);
	}
}
