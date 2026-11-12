// A static server that answers a build the way GitHub Pages does (#274). The
// e2e suite and the screenshot gate use it in place of `vite preview`, whose
// fallback to index.html with 200 would hide the per-route files and the
// 404.html redirect.
//
// `tsx scripts/pages-server.ts --dir <build folder> --port <port>` serves the
// folder under /portdle/ (the Vite `base`). A build that holds MANIFEST_FILE
// (written by the prerender step) is served the Pages way. A build without it,
// such as a merge-base that predates the prerender, is served the way
// `vite preview` does: every path that names no file answers index.html with 200.
// The manifest is looked up on every request; the server does not read it.

import { createReadStream, fstatSync, statSync } from "node:fs";
import { createServer, type Server, type ServerResponse } from "node:http";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const MANIFEST_FILE = "prerender-manifest.json";

const BASE = "/portdle/";
const HOST = "127.0.0.1";

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".txt": "text/plain; charset=utf-8",
	".xml": "application/xml; charset=utf-8",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".map": "application/json; charset=utf-8",
	".webmanifest": "application/manifest+json; charset=utf-8",
};

// What the server answers: a file with a status, a redirect, or a plain text.
type Answer =
	| { kind: "file"; status: number; file: string }
	| { kind: "redirect"; location: string }
	| { kind: "text"; status: number; text: string };

function isFile(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

function plain(status: number, text: string): Answer {
	return { kind: "text", status, text };
}

// `base` has a leading and a trailing slash, as "/portdle/".
function answer(dir: string, base: string, rawUrl: string): Answer {
	const queryAt = rawUrl.indexOf("?");
	const search = queryAt === -1 ? "" : rawUrl.slice(queryAt);
	const rawPath = queryAt === -1 ? rawUrl : rawUrl.slice(0, queryAt);
	let path: string;
	try {
		path = decodeURIComponent(rawPath);
	} catch {
		return plain(404, "Not found");
	}
	if (path.includes("\0") || path.split("/").includes("..")) {
		return plain(404, "Not found");
	}
	if (path === base.slice(0, -1)) {
		return { kind: "redirect", location: base + search };
	}
	if (!path.startsWith(base)) {
		return plain(404, "Not found");
	}

	const relative = path.slice(base.length);
	const segments = relative.split("/");
	// An empty segment ("a//b") names no file. The last one is the trailing slash.
	const names = segments.slice(0, -1).every((segment) => segment !== "");
	const existing = (name: string): string | undefined => {
		const file = join(dir, name);
		return isFile(file) ? file : undefined;
	};
	const fileAt = (name: string): string | undefined =>
		names ? existing(name) : undefined;
	const slashed = relative === "" || relative.endsWith("/");

	if (!isFile(join(dir, MANIFEST_FILE))) {
		const file = slashed ? undefined : fileAt(relative);
		const found = file ?? existing("index.html");
		return found
			? { kind: "file", status: 200, file: found }
			: plain(404, "Not found");
	}

	const notFound = (): Answer => {
		const file = existing("404.html");
		return file ? { kind: "file", status: 404, file } : plain(404, "Not found");
	};
	if (slashed) {
		const index = fileAt(`${relative}index.html`);
		return index ? { kind: "file", status: 200, file: index } : notFound();
	}
	const direct = fileAt(relative) ?? fileAt(`${relative}.html`);
	if (direct) {
		return { kind: "file", status: 200, file: direct };
	}
	if (fileAt(`${relative}/index.html`)) {
		const encoded = segments.map(encodeURIComponent).join("/");
		return { kind: "redirect", location: `${base}${encoded}/${search}` };
	}
	return notFound();
}

// A file that passed `isFile` can still fail to open (permissions, or a rebuild
// between the check and the open). That answers 500; it must not crash the server.
function sendFile(
	response: ServerResponse,
	file: string,
	status: number,
	head: boolean,
): void {
	const stream = createReadStream(file);
	response.on("close", () => stream.destroy());
	stream.on("error", () => {
		if (response.headersSent) {
			response.destroy();
			return;
		}
		response
			.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
			.end(head ? undefined : "Server error");
	});
	stream.on("open", (fd) => {
		response.writeHead(status, {
			"Content-Type":
				CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
			"Content-Length": fstatSync(fd).size,
		});
		if (head) {
			response.end();
		} else {
			stream.pipe(response);
		}
	});
}

export function createPagesServer(dir: string, base: string): Server {
	const root = resolve(dir);
	return createServer((request, response) => {
		if (request.method !== "GET" && request.method !== "HEAD") {
			response.writeHead(405, { Allow: "GET, HEAD" }).end();
			return;
		}
		const result = answer(root, base, request.url ?? "/");
		const head = request.method === "HEAD";
		if (result.kind === "redirect") {
			response.writeHead(301, { Location: result.location }).end();
		} else if (result.kind === "text") {
			response.writeHead(result.status, {
				"Content-Type": "text/plain; charset=utf-8",
			});
			response.end(head ? undefined : result.text);
		} else {
			sendFile(response, result.file, result.status, head);
		}
	});
}

function option(name: string): string | undefined {
	const at = process.argv.indexOf(name);
	return at === -1 ? undefined : process.argv[at + 1];
}

const entry = process.argv[1];
if (
	entry !== undefined &&
	import.meta.url === pathToFileURL(resolve(entry)).href
) {
	const dir = option("--dir");
	const port = Number(option("--port"));
	if (dir === undefined || !Number.isInteger(port)) {
		console.error("Usage: pages-server.ts --dir <folder> --port <port>");
		process.exit(1);
	}
	const server = createPagesServer(dir, BASE);
	server.on("error", (error) => {
		console.error(error.message);
		process.exit(1);
	});
	server.listen(port, HOST);
}
