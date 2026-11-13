import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import privacySource from "../privacy.html?raw";
import redirectScript from "../src/old-board-redirect.js?raw";
import type { Head } from "../src/ui/head";
import { finishBuild } from "./build-site";

const TEMPLATE =
	'<!doctype html><html><head><meta charset="UTF-8" /><title>Portdle</title></head><body><div id="root"></div></body></html>';
const PRIVACY =
	'<html><head><meta name="description" content="p" /><link rel="canonical" href="https://x/privacy" /></head></html>';
const HEAD: Record<string, Head> = {
	"/": { title: "Home", description: "The home.", canonical: "https://x/" },
	"/archive/board": {
		title: "Board",
		description: "A board.",
		canonical: null,
	},
};
const ROUTES = ["/", "/archive/board"];

const dirs: string[] = [];
function folder(privacy = PRIVACY): string {
	const dir = mkdtempSync(join(tmpdir(), "portdle-build-"));
	dirs.push(dir);
	writeFileSync(join(dir, "index.html"), TEMPLATE);
	writeFileSync(join(dir, "privacy.html"), privacy);
	return dir;
}
afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("finishBuild fills the route files and leaves 404.html with an empty root and the redirect", async () => {
	const dir = folder();
	await finishBuild({
		outDir: dir,
		render: (path) => `<main>${path}</main>`,
		routes: ROUTES,
		head: HEAD,
	});
	const index = readFileSync(join(dir, "index.html"), "utf8");
	expect(index).toContain('<div id="root"><main>/</main></div>');
	const notFound = readFileSync(join(dir, "404.html"), "utf8");
	expect(notFound).toContain('<div id="root"></div>');
	expect(notFound).toContain(redirectScript.trim());
	expect(notFound).not.toContain("<main>");
});

test("finishBuild fails when a route cannot render", async () => {
	const dir = folder();
	await expect(
		finishBuild({
			outDir: dir,
			render: (path) => {
				if (path.startsWith("/archive/board")) {
					throw new Error("render failed");
				}
				return "";
			},
			routes: ROUTES,
			head: HEAD,
		}),
	).rejects.toThrow("render failed");
});

test("finishBuild fails when privacy.html has no meta description", async () => {
	const dir = folder("<html><head></head></html>");
	await expect(
		finishBuild({
			outDir: dir,
			render: () => "",
			routes: ROUTES,
			head: HEAD,
		}),
	).rejects.toThrow("privacy.html: no meta description");
});

test("privacy.html in the repo has its meta description and canonical link", () => {
	expect(privacySource).toMatch(/<meta\s+name="description"/);
	expect(privacySource).toMatch(/<link\s+rel="canonical"/);
});
