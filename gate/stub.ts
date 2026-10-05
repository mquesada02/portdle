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

// A signed-in account: the row of the `accounts` table that the stub serves.
type AccountRow = {
	id: string;
	display_name: string;
	name_confirmed: boolean;
};
export type AccountOption = "confirmed" | "unconfirmed";

function fixture(file: string): Row[] {
	return JSON.parse(
		readFileSync(join(import.meta.dirname, "fixtures", file), "utf8"),
	) as Row[];
}

const CURRENT_DAILIES = fixture("current-dailies.json");
const CATALOG = fixture("catalog.json");
const SCHEDULE = fixture("schedule.json");
const GLOBAL_STATS = fixture("daily-global-stats.json");
const ACCOUNTS = fixture("accounts.json") as AccountRow[];
const LEADERBOARD = fixture("leaderboard.json");

// The account row of an option: the one whose name is (not) confirmed.
export function accountFor(option: AccountOption): AccountRow {
	const row = ACCOUNTS.find(
		(account) => account.name_confirmed === (option === "confirmed"),
	);
	if (!row) {
		throw new Error(`No ${option} account in accounts.json.`);
	}
	return row;
}

// The tables that Sync reads for a signed-in account (all empty). A new Sync
// table has no answer, so the unstubbed-request check fails the test.
const SYNC_TABLES = [
	"codex_entries",
	"blitz_bests",
	"dailies",
	"preferences",
	"blitz_runs",
];

// What the stub answers: a status, and a JSON body unless it is empty.
type Reply = { status: number; body?: unknown };

function ok(body: unknown): Reply {
	return { status: 200, body };
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

// The answers for a signed-in test. The one write answered is the preferences
// push that Sync sends on the first sync of a device.
function answerSignedIn(
	route: string,
	url: URL,
	method: string,
	account: AccountRow,
): Reply | null {
	if (method === "POST") {
		return route === "preferences" ? { status: 201 } : null;
	}
	if (method !== "GET") {
		return null;
	}
	if (route === "accounts") {
		return eq(url, "id") === account.id ? ok(account) : null;
	}
	if (SYNC_TABLES.includes(route)) {
		return ok([]);
	}
	if (route === "leaderboard_all_time") {
		// No top-N cut and no viewer row: the fixture holds only the rows a frame
		// shows, for the default picker (mixed, default, sprint).
		const wanted = {
			category: eq(url, "category"),
			orientation: eq(url, "orientation"),
			mode: eq(url, "mode"),
		};
		return ok(
			LEADERBOARD.filter((row) =>
				Object.entries(wanted).every(
					([column, value]) => row[column] === value,
				),
			),
		);
	}
	return null;
}

function answer(
	url: URL,
	method: string,
	account: AccountRow | undefined,
): Reply | null {
	const route = url.pathname.replace("/rest/v1/", "");
	switch (route) {
		case "rpc/current_dailies":
			return ok(CURRENT_DAILIES);
		case "catalog_entries":
			return ok(firstPage(CATALOG, url));
		case "schedule":
			return ok(firstPage(SCHEDULE, url));
		case "daily_global_stats":
			return ok(
				GLOBAL_STATS.filter(
					(row) =>
						row.category === eq(url, "category") && row.day === eq(url, "day"),
				),
			);
		default:
			return account ? answerSignedIn(route, url, method, account) : null;
	}
}

// Installs the stub on a context. A signed-in test also passes its account.
// Returns the list that collects every request that had no stub.
export async function stubBackend(
	context: BrowserContext,
	previewOrigin: string,
	account?: AccountRow,
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
			const reply = answer(url, request.method(), account);
			if (reply) {
				return route.fulfill({
					status: reply.status,
					contentType: "application/json",
					headers: CORS,
					body:
						reply.body === undefined ? undefined : JSON.stringify(reply.body),
				});
			}
		}
		unstubbed.push(`${request.method()} ${request.url()}`);
		return route.abort();
	});
	return unstubbed;
}
