// `SITE_URL=<site base url> pnpm live:check`: the post-deploy check of the CI
// workflow. It requests the 10 URLs of the live site and exits 1 unless each
// one answers 200: the 8 fixed routes, one board and privacy.html. A redirect
// is not 200 (the request does not follow it). An answer other than 200, or no
// answer, is tried again up to 2 more times, 5 seconds apart, because Pages
// may need a moment after a deploy.

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { HEAD } from "../src/ui/head.ts";

const BOARD_KEY = "/archive/board";
const BOARD_QUERY = "archive/board?category=mixed&date=2026-11-01";
export const RETRIES = 2;
export const RETRY_DELAY_MS = 5000;

// The 10 URLs under the site base: every route of the head table except the
// board, then one board, then privacy.html. `/` gives the base itself.
export function liveUrls(base: string): string[] {
	const root = base.endsWith("/") ? base : `${base}/`;
	const fixed = Object.keys(HEAD)
		.filter((key) => key !== BOARD_KEY)
		.map((key) => `${root}${key.slice(1)}`);
	return [...fixed, `${root}${BOARD_QUERY}`, `${root}privacy.html`];
}

export type LiveResult = {
	url: string;
	// The last status, or "error" when the last try got no answer.
	status: number | "error";
	ok: boolean;
};

// Checks each URL one at a time. `fetchStatus` throws when there is no answer.
export async function checkLive(
	urls: string[],
	fetchStatus: (url: string) => Promise<number>,
	sleep: (ms: number) => Promise<void>,
): Promise<LiveResult[]> {
	const results: LiveResult[] = [];
	for (const url of urls) {
		let status: number | "error" = "error";
		for (let attempt = 0; attempt <= RETRIES; attempt++) {
			if (attempt > 0) {
				await sleep(RETRY_DELAY_MS);
			}
			try {
				status = await fetchStatus(url);
			} catch {
				status = "error";
			}
			if (status === 200) {
				break;
			}
		}
		results.push({ url, status, ok: status === 200 });
	}
	return results;
}

export function formatLive(result: LiveResult): string {
	return `${result.ok ? "OK" : "FAIL"} ${result.status} ${result.url}`;
}

// The status of a GET. It does not follow a redirect, so a 301 is a 301.
export async function httpStatus(url: string): Promise<number> {
	return (await fetch(url, { redirect: "manual" })).status;
}

async function main(): Promise<number> {
	const site = process.env.SITE_URL;
	if (site === undefined || !/^https?:\/\//.test(site)) {
		console.error("Set SITE_URL to the http(s) base URL of the live site.");
		return 1;
	}
	const results = await checkLive(
		liveUrls(site),
		httpStatus,
		(ms) => new Promise((done) => setTimeout(done, ms)),
	);
	for (const result of results) {
		console.log(formatLive(result));
	}
	return results.every((result) => result.ok) ? 0 : 1;
}

const entry = process.argv[1];
if (
	entry !== undefined &&
	import.meta.url === pathToFileURL(resolve(entry)).href
) {
	process.exit(await main());
}
