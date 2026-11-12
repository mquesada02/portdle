import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createPagesServer, MANIFEST_FILE } from "./pages-server.ts";

type Reply = {
	status: number;
	headers: Record<string, string | string[] | undefined>;
	body: string;
};

const BASE = "/portdle/";
const cleanups: (() => void)[] = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

// Builds a temp build folder from a map of file name to content and serves it.
async function serve(files: Record<string, string>): Promise<{
	dir: string;
	get: (path: string, method?: string) => Promise<Reply>;
}> {
	const dir = mkdtempSync(join(tmpdir(), "portdle-pages-"));
	for (const [name, content] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, name)), { recursive: true });
		writeFileSync(join(dir, name), content);
	}
	const server: Server = createPagesServer(dir, BASE);
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	cleanups.push(() => {
		server.close();
		rmSync(dir, { recursive: true, force: true });
	});
	const { port } = server.address() as AddressInfo;
	// node:http sends the path as given. fetch would collapse `..` segments.
	const get = (path: string, method = "GET") =>
		new Promise<Reply>((done, fail) => {
			const outgoing = request(
				{ host: "127.0.0.1", port, path, method },
				(incoming) => {
					let body = "";
					incoming.setEncoding("utf8");
					incoming.on("data", (chunk) => {
						body += chunk;
					});
					incoming.on("end", () =>
						done({
							status: incoming.statusCode ?? 0,
							headers: incoming.headers,
							body,
						}),
					);
				},
			);
			outgoing.on("error", fail);
			outgoing.end();
		});
	return { dir, get };
}

const PAGES = {
	[MANIFEST_FILE]: "[]",
	"index.html": "INDEX",
	"404.html": "NOT FOUND",
	"history.html": "HISTORY",
	"history/blitz.html": "BLITZ HISTORY",
	"codex/index.html": "CODEX",
	"mixed.html": "MIXED FILE",
	"mixed/index.html": "MIXED FOLDER",
	"assets/app.js": "console.log(1)",
	"assets/app.css": "a{}",
};

describe("a build with the manifest (the Pages way)", () => {
	test("a file answers itself with 200", async () => {
		const { get } = await serve(PAGES);
		const reply = await get("/portdle/assets/app.js");
		expect(reply.status).toBe(200);
		expect(reply.body).toBe("console.log(1)");
	});

	test("the base answers index.html with 200", async () => {
		const { get } = await serve(PAGES);
		const reply = await get("/portdle/");
		expect(reply.status).toBe(200);
		expect(reply.body).toBe("INDEX");
	});

	test("<path> answers <path>.html with 200", async () => {
		const { get } = await serve(PAGES);
		for (const [path, body] of [
			["/portdle/history", "HISTORY"],
			["/portdle/history/blitz", "BLITZ HISTORY"],
		] as const) {
			const reply = await get(path);
			expect(reply.status).toBe(200);
			expect(reply.body).toBe(body);
		}
	});

	test("<path>.html answers 200 next to a folder <path>/ that holds index.html", async () => {
		const { get } = await serve(PAGES);
		const reply = await get("/portdle/mixed");
		expect(reply.status).toBe(200);
		expect(reply.body).toBe("MIXED FILE");
	});

	test("a folder with only index.html answers 301 to <path>/, then 200", async () => {
		const { get } = await serve(PAGES);
		const redirect = await get("/portdle/codex?tab=a%20b");
		expect(redirect.status).toBe(301);
		expect(redirect.headers.location).toBe("/portdle/codex/?tab=a%20b");
		const served = await get("/portdle/codex/");
		expect(served.status).toBe(200);
		expect(served.body).toBe("CODEX");
	});

	test("the 301 Location encodes the path again", async () => {
		const { get } = await serve({ ...PAGES, "a b/index.html": "SPACE" });
		const redirect = await get("/portdle/a%20b");
		expect(redirect.status).toBe(301);
		expect(redirect.headers.location).toBe("/portdle/a%20b/");
	});

	test("a trailing slash without index.html answers 404.html with 404", async () => {
		const { get } = await serve(PAGES);
		const reply = await get("/portdle/history/");
		expect(reply.status).toBe(404);
		expect(reply.body).toBe("NOT FOUND");
	});

	test("the query string is ignored for the file lookup", async () => {
		const { get } = await serve(PAGES);
		const reply = await get("/portdle/history?category=mixed&date=2026-10-09");
		expect(reply.status).toBe(200);
		expect(reply.body).toBe("HISTORY");
	});

	test("an unknown path answers 404.html with 404", async () => {
		const { get } = await serve(PAGES);
		const reply = await get("/portdle/nowhere/at/all");
		expect(reply.status).toBe(404);
		expect(reply.body).toBe("NOT FOUND");
		expect(reply.headers["content-type"]).toContain("text/html");
	});

	test("an empty segment names no file", async () => {
		const { get } = await serve(PAGES);
		const reply = await get("/portdle//history");
		expect(reply.status).toBe(404);
		expect(reply.body).toBe("NOT FOUND");
	});

	test("a missing 404.html answers a plain-text 404", async () => {
		const { get } = await serve({ [MANIFEST_FILE]: "[]", "index.html": "I" });
		const reply = await get("/portdle/nowhere");
		expect(reply.status).toBe(404);
		expect(reply.headers["content-type"]).toContain("text/plain");
	});

	test("the manifest is looked up on every request", async () => {
		const { get, dir } = await serve({ "index.html": "I", "404.html": "NF" });
		expect((await get("/portdle/nowhere")).status).toBe(200);
		writeFileSync(join(dir, MANIFEST_FILE), "[]");
		expect((await get("/portdle/nowhere")).status).toBe(404);
	});
});

describe("a build without the manifest (the vite preview way)", () => {
	const OLD = { "index.html": "INDEX", "assets/app.js": "js" };

	test("every path that names no file answers index.html with 200", async () => {
		const { get } = await serve(OLD);
		for (const path of [
			"/portdle/",
			"/portdle/history",
			"/portdle/archive/mixed/2026-10-09",
			"/portdle/folder/",
		]) {
			const reply = await get(path);
			expect(reply.status).toBe(200);
			expect(reply.body).toBe("INDEX");
		}
	});

	test("a path that names a file still answers that file", async () => {
		const { get } = await serve(OLD);
		const reply = await get("/portdle/assets/app.js");
		expect(reply.status).toBe(200);
		expect(reply.body).toBe("js");
	});
});

describe("both kinds of build", () => {
	test("the bare base answers 301 to the base", async () => {
		const { get } = await serve(PAGES);
		const reply = await get("/portdle");
		expect(reply.status).toBe(301);
		expect(reply.headers.location).toBe("/portdle/");
	});

	test("a path outside the base answers a plain-text 404", async () => {
		const { get } = await serve(PAGES);
		const reply = await get("/other/history");
		expect(reply.status).toBe(404);
		expect(reply.headers["content-type"]).toContain("text/plain");
	});

	test("a path that leaves the build folder answers 404 and reads nothing", async () => {
		const { get } = await serve(PAGES);
		for (const path of [
			"/portdle/../secret",
			"/portdle/%2e%2e/secret",
			"/portdle/assets/%2E%2E/%2e%2e/secret",
		]) {
			const reply = await get(path);
			expect(reply.status).toBe(404);
			expect(reply.headers["content-type"]).toContain("text/plain");
		}
	});

	test("a NUL byte answers 404", async () => {
		const { get } = await serve(PAGES);
		expect((await get("/portdle/history%00")).status).toBe(404);
	});

	test("a malformed escape answers 404 and the server goes on", async () => {
		const { get } = await serve(PAGES);
		expect((await get("/portdle/%zz")).status).toBe(404);
		expect((await get("/portdle/history")).status).toBe(200);
	});

	test("a file that cannot be read answers 500 and the server goes on", async () => {
		const { get, dir } = await serve(PAGES);
		chmodSync(join(dir, "history.html"), 0o000);
		expect((await get("/portdle/history")).status).toBe(500);
		expect((await get("/portdle/history", "HEAD")).status).toBe(500);
		expect((await get("/portdle/mixed")).status).toBe(200);
	});

	test("a method other than GET and HEAD answers 405", async () => {
		const { get } = await serve(PAGES);
		expect((await get("/portdle/history", "POST")).status).toBe(405);
	});

	test("HEAD has the headers of GET and no body", async () => {
		const { get } = await serve(PAGES);
		const head = await get("/portdle/history", "HEAD");
		const full = await get("/portdle/history");
		expect(head.status).toBe(200);
		expect(head.body).toBe("");
		expect(head.headers["content-length"]).toBe(full.headers["content-length"]);
	});

	test("a file has the Content-Type of its extension", async () => {
		const { get } = await serve(PAGES);
		expect((await get("/portdle/assets/app.js")).headers["content-type"]).toBe(
			"text/javascript; charset=utf-8",
		);
		expect((await get("/portdle/assets/app.css")).headers["content-type"]).toBe(
			"text/css; charset=utf-8",
		);
	});
});
