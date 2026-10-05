// The stub host: Playwright answers every request to it from the committed
// fixtures. A request with no stub is aborted and recorded, and the fixture in
// fixtures.ts fails the test on it. Requests to the preview server's own origin
// (the page, scripts, and styles of the stub build) go through.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext } from "@playwright/test";

// The host that scripts/gate.ts builds into the site.
export const STUB_URL = "http://stub.test";
export const STUB_KEY = "stub-anon-key";

type Row = Record<string, unknown>;

function fixture(file: string): Row[] {
	return JSON.parse(
		readFileSync(join(import.meta.dirname, "fixtures", file), "utf8"),
	) as Row[];
}

const CORS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers":
		"apikey, authorization, content-type, x-client-info, prefer",
	"access-control-allow-methods": "GET, POST, OPTIONS",
};

// The rows of one paged read: the whole table on the first page, none after.
function firstPage(rows: Row[], url: URL): Row[] {
	return url.searchParams.get("offset") === "0" ? rows : [];
}

// PostgREST filter `column=eq.value`, as the app sends it.
function eq(url: URL, column: string): string | null {
	return url.searchParams.get(column)?.replace(/^eq\./, "") ?? null;
}

function answer(url: URL): Row[] | null {
	switch (url.pathname) {
		case "/rest/v1/rpc/current_dailies":
			return fixture("current-dailies.json");
		case "/rest/v1/catalog_entries":
			return firstPage(fixture("catalog.json"), url);
		case "/rest/v1/schedule":
			return firstPage(fixture("schedule.json"), url);
		case "/rest/v1/daily_global_stats":
			return fixture("daily-global-stats.json").filter(
				(row) =>
					row.category === eq(url, "category") && row.day === eq(url, "day"),
			);
		default:
			return null;
	}
}

// Installs the stub on a context. Returns the list that collects every
// request that had no stub.
export async function stubBackend(
	context: BrowserContext,
	previewOrigin: string,
): Promise<string[]> {
	const unstubbed: string[] = [];
	await context.route("**/*", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (url.origin === previewOrigin) {
			return route.continue();
		}
		if (url.origin === STUB_URL) {
			if (request.method() === "OPTIONS") {
				return route.fulfill({ status: 204, headers: CORS });
			}
			const rows = answer(url);
			if (rows) {
				return route.fulfill({
					status: 200,
					contentType: "application/json",
					headers: CORS,
					body: JSON.stringify(rows),
				});
			}
		}
		unstubbed.push(`${request.method()} ${request.url()}`);
		return route.abort();
	});
	return unstubbed;
}
