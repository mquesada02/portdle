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
import { copyIndexHtmlTo404 } from "./copy-index-html-to-404";

function withTempDir(run: (dir: string) => void): void {
	const dir = mkdtempSync(join(tmpdir(), "portdle-404-"));
	try {
		run(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

test("copyIndexHtmlTo404 writes 404.html identical to index.html", () => {
	withTempDir((dir) => {
		const index = "<!doctype html><title>portdle</title>";
		writeFileSync(join(dir, "index.html"), index);
		copyIndexHtmlTo404(dir);
		expect(readFileSync(join(dir, "404.html"), "utf8")).toBe(index);
	});
});

test("copyIndexHtmlTo404 fails when index.html is missing and does not write 404.html", () => {
	withTempDir((dir) => {
		expect(() => copyIndexHtmlTo404(dir)).toThrow();
		expect(existsSync(join(dir, "404.html"))).toBe(false);
	});
});

test("copyIndexHtmlTo404 does not change index.html", () => {
	withTempDir((dir) => {
		const index = "<!doctype html><title>portdle</title>";
		writeFileSync(join(dir, "index.html"), index);
		copyIndexHtmlTo404(dir);
		expect(readFileSync(join(dir, "index.html"), "utf8")).toBe(index);
	});
});

test("copyIndexHtmlTo404 overwrites a stale 404.html", () => {
	withTempDir((dir) => {
		const index = "<!doctype html><title>portdle</title>";
		writeFileSync(join(dir, "index.html"), index);
		writeFileSync(join(dir, "404.html"), "stale");
		copyIndexHtmlTo404(dir);
		expect(readFileSync(join(dir, "404.html"), "utf8")).toBe(index);
	});
});

test("copyIndexHtmlTo404 is idempotent", () => {
	withTempDir((dir) => {
		const index = "<!doctype html><title>portdle</title>";
		writeFileSync(join(dir, "index.html"), index);
		copyIndexHtmlTo404(dir);
		copyIndexHtmlTo404(dir);
		expect(readFileSync(join(dir, "404.html"), "utf8")).toBe(index);
	});
});
