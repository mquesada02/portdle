import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, test } from "vitest";
import {
	checkLive,
	formatLive,
	httpStatus,
	liveUrls,
	RETRIES,
	RETRY_DELAY_MS,
} from "./live-check.ts";

const BASE = "https://mquesada02.github.io/portdle/";

describe("liveUrls", () => {
	test("lists the 8 fixed routes, one board and privacy.html", () => {
		expect(liveUrls(BASE)).toEqual([
			`${BASE}`,
			`${BASE}protocols`,
			`${BASE}applications`,
			`${BASE}archive`,
			`${BASE}blitz`,
			`${BASE}history`,
			`${BASE}history/blitz`,
			`${BASE}codex`,
			`${BASE}archive/board?category=mixed&date=2026-11-01`,
			`${BASE}privacy.html`,
		]);
	});

	test("gives the same URLs for a base with no trailing slash", () => {
		expect(liveUrls(BASE.slice(0, -1))).toEqual(liveUrls(BASE));
	});
});

describe("checkLive", () => {
	const urls = ["https://x/a", "https://x/b"];

	test("passes when every URL answers 200 on the first try", async () => {
		const sleeps: number[] = [];
		const results = await checkLive(
			urls,
			async () => 200,
			async (ms) => void sleeps.push(ms),
		);
		expect(results.every((result) => result.ok)).toBe(true);
		expect(sleeps).toEqual([]);
	});

	test("passes after a retry when the first answer is 404", async () => {
		const seen: string[] = [];
		const sleeps: number[] = [];
		const results = await checkLive(
			["https://x/a"],
			async (url) => {
				seen.push(url);
				return seen.length === 1 ? 404 : 200;
			},
			async (ms) => void sleeps.push(ms),
		);
		expect(results).toEqual([{ url: "https://x/a", status: 200, ok: true }]);
		expect(sleeps).toEqual([RETRY_DELAY_MS]);
	});

	test.each([301, 404])(
		"fails and names the URL after every try answers %i",
		async (status) => {
			let calls = 0;
			const results = await checkLive(
				["https://x/a"],
				async () => {
					calls++;
					return status;
				},
				async () => {},
			);
			expect(calls).toBe(RETRIES + 1);
			expect(results).toEqual([{ url: "https://x/a", status, ok: false }]);
			expect(formatLive(results[0] as (typeof results)[number])).toBe(
				`FAIL ${status} https://x/a`,
			);
		},
	);

	test("fails when every try has no answer", async () => {
		const results = await checkLive(
			["https://x/a"],
			async () => {
				throw new Error("network");
			},
			async () => {},
		);
		expect(results).toEqual([
			{ url: "https://x/a", status: "error", ok: false },
		]);
		expect(formatLive(results[0] as (typeof results)[number])).toBe(
			"FAIL error https://x/a",
		);
	});

	test("keeps checking the other URLs after one fails", async () => {
		const results = await checkLive(
			urls,
			async (url) => (url.endsWith("/a") ? 404 : 200),
			async () => {},
		);
		expect(results.map((result) => result.ok)).toEqual([false, true]);
	});
});

describe("httpStatus", () => {
	test("does not follow a redirect", async () => {
		const server = createServer((request, response) => {
			if (request.url === "/folder") {
				response.writeHead(301, { location: "/folder/" });
			} else {
				response.writeHead(200);
			}
			response.end();
		});
		await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
		const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
		try {
			expect(await httpStatus(`${origin}/folder`)).toBe(301);
			expect(await httpStatus(`${origin}/page`)).toBe(200);
		} finally {
			await new Promise((done) => server.close(done));
		}
	});
});
