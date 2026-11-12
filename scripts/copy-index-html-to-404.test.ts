import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import redirectScript from "../src/old-board-redirect.js?raw";
import { copyIndexHtmlTo404 } from "./copy-index-html-to-404";

function withTempDir(run: (dir: string) => void): void {
	const dir = mkdtempSync(join(tmpdir(), "portdle-404-"));
	try {
		run(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

const SCRIPT = `<script>${redirectScript.trim()}</script>`;
const INDEX =
	'<!doctype html><html><head><meta charset="UTF-8" /><title>portdle</title></head><body></body></html>';
const INDEX_WITH_SCRIPT = INDEX.replace("<head>", `<head>${SCRIPT}`);

test("copyIndexHtmlTo404 writes index.html with the redirect script first in the head", () => {
	withTempDir((dir) => {
		writeFileSync(join(dir, "index.html"), INDEX);
		copyIndexHtmlTo404(dir);
		const written = readFileSync(join(dir, "404.html"), "utf8");
		expect(written).toBe(INDEX_WITH_SCRIPT);
		expect(written.split(SCRIPT)).toHaveLength(2);
		expect(written.indexOf(SCRIPT)).toBeLessThan(written.indexOf("<meta"));
	});
});

test.each([
	['<head class="x">', '<head class="x">'],
	["<HEAD>", "<HEAD>"],
])("copyIndexHtmlTo404 finds the head tag %s", (open, expected) => {
	withTempDir((dir) => {
		writeFileSync(join(dir, "index.html"), `<html>${open}<title>p</title>`);
		copyIndexHtmlTo404(dir);
		expect(readFileSync(join(dir, "404.html"), "utf8")).toBe(
			`<html>${expected}${SCRIPT}<title>p</title>`,
		);
	});
});

test("copyIndexHtmlTo404 fails when index.html is missing and does not write 404.html", () => {
	withTempDir((dir) => {
		expect(() => copyIndexHtmlTo404(dir)).toThrow();
		expect(existsSync(join(dir, "404.html"))).toBe(false);
	});
});

test("copyIndexHtmlTo404 fails when index.html has no head and does not write 404.html", () => {
	withTempDir((dir) => {
		writeFileSync(join(dir, "index.html"), "<!doctype html><title>p</title>");
		expect(() => copyIndexHtmlTo404(dir)).toThrow();
		expect(existsSync(join(dir, "404.html"))).toBe(false);
	});
});

test("copyIndexHtmlTo404 does not change index.html", () => {
	withTempDir((dir) => {
		writeFileSync(join(dir, "index.html"), INDEX);
		copyIndexHtmlTo404(dir);
		expect(readFileSync(join(dir, "index.html"), "utf8")).toBe(INDEX);
	});
});

test("copyIndexHtmlTo404 overwrites a stale 404.html", () => {
	withTempDir((dir) => {
		writeFileSync(join(dir, "index.html"), INDEX);
		writeFileSync(join(dir, "404.html"), "stale");
		copyIndexHtmlTo404(dir);
		expect(readFileSync(join(dir, "404.html"), "utf8")).toBe(INDEX_WITH_SCRIPT);
	});
});

test("copyIndexHtmlTo404 is idempotent", () => {
	withTempDir((dir) => {
		writeFileSync(join(dir, "index.html"), INDEX);
		copyIndexHtmlTo404(dir);
		copyIndexHtmlTo404(dir);
		expect(readFileSync(join(dir, "404.html"), "utf8")).toBe(INDEX_WITH_SCRIPT);
	});
});
