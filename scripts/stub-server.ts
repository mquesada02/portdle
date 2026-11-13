// A stub HTTP server for the Lighthouse guard: it answers the signed-out
// Supabase REST reads from the screenshot gate's fixtures, through the same
// `answer` as the gate stub (gate/answers.ts). The guard builds the site with
// its address as VITE_SUPABASE_URL. A request with no answer gets 404: the
// audited pages send only the stubbed reads.
//
// `tsx scripts/stub-server.ts [--port <port>]` runs it alone.

import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { answer, CORS } from "../gate/answers.ts";
import { acceptsGzip } from "./pages-server.ts";

export const STUB_PORT = 4175;
const HOST = "127.0.0.1";

export function createStubServer(): Server {
	return createServer((request, response) => {
		// Drain a request body (the `rpc/current_dailies` call is a POST).
		request.resume();
		if (request.method === "OPTIONS") {
			response.writeHead(204, CORS).end();
			return;
		}
		const url = new URL(request.url ?? "/", `http://${HOST}`);
		const reply = answer(url, request.method ?? "GET", undefined);
		if (!reply) {
			response
				.writeHead(404, {
					...CORS,
					"Content-Type": "text/plain; charset=utf-8",
				})
				.end("No stub for this request");
			return;
		}
		const body =
			reply.body === undefined ? undefined : JSON.stringify(reply.body);
		// Supabase sends gzip to a client that accepts it, so the audited pages
		// transfer the size that players' browsers do.
		const packed =
			body !== undefined && acceptsGzip(request.headers["accept-encoding"]);
		response.writeHead(reply.status, {
			...CORS,
			"Content-Type": "application/json",
			Vary: "Accept-Encoding",
			...(packed ? { "Content-Encoding": "gzip" } : {}),
		});
		response.end(packed ? gzipSync(body) : body);
	});
}

const entry = process.argv[1];
if (
	entry !== undefined &&
	import.meta.url === pathToFileURL(resolve(entry)).href
) {
	const at = process.argv.indexOf("--port");
	const port = at === -1 ? STUB_PORT : Number(process.argv[at + 1]);
	if (!Number.isInteger(port)) {
		console.error("Usage: stub-server.ts [--port <port>]");
		process.exit(1);
	}
	createStubServer()
		.on("error", (error) => {
			console.error(error.message);
			process.exit(1);
		})
		.listen(port, HOST);
}
