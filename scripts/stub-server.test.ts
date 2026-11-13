import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { answer } from "../gate/answers.ts";
import { createStubServer } from "./stub-server.ts";

const servers: Server[] = [];

afterEach(async () => {
	for (const server of servers.splice(0)) {
		await new Promise((done) => server.close(done));
	}
});

async function start(): Promise<string> {
	const server = createStubServer();
	servers.push(server);
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function fixture(file: string): unknown {
	return JSON.parse(
		readFileSync(
			join(import.meta.dirname, "..", "gate", "fixtures", file),
			"utf8",
		),
	);
}

// The reads that src/remote/supabase.ts sends and the gate stub answers.
const READS = [
	{
		name: "current dailies",
		method: "POST",
		path: "/rest/v1/rpc/current_dailies",
		fixture: "current-dailies.json",
	},
	{
		name: "catalog page 0",
		method: "GET",
		path: "/rest/v1/catalog_entries?select=*&order=id&limit=1000&offset=0",
		fixture: "catalog.json",
	},
	{
		name: "catalog page 1",
		method: "GET",
		path: "/rest/v1/catalog_entries?select=*&order=id&limit=1000&offset=1000",
		fixture: null,
	},
	{
		name: "schedule page 0",
		method: "GET",
		path: "/rest/v1/schedule?select=category,day,entry_id&order=day,category&limit=1000&offset=0",
		fixture: "schedule.json",
	},
	{
		name: "schedule page 1",
		method: "GET",
		path: "/rest/v1/schedule?select=category,day,entry_id&order=day,category&limit=1000&offset=1000",
		fixture: null,
	},
	{
		name: "global stats with a row",
		method: "GET",
		path: "/rest/v1/daily_global_stats?select=*&category=eq.mixed&day=eq.2026-10-10",
		fixture: "daily-global-stats.json",
	},
	{
		name: "global stats with no row",
		method: "GET",
		path: "/rest/v1/daily_global_stats?select=*&category=eq.mixed&day=eq.2026-10-09",
		fixture: null,
	},
];

describe("stub server", () => {
	test.each(READS)(
		"answers the read $name as the gate stub does",
		async (read) => {
			const origin = await start();
			const response = await fetch(`${origin}${read.path}`, {
				method: read.method,
				body: read.method === "POST" ? "{}" : undefined,
			});
			const expected = answer(
				new URL(read.path, origin),
				read.method,
				undefined,
			);
			expect(response.status).toBe(expected?.status);
			const body: unknown = await response.json();
			expect(body).toEqual(expected?.body);
			expect(response.headers.get("access-control-allow-origin")).toBe("*");
			if (read.fixture !== null && !read.name.startsWith("global stats")) {
				expect(body).toEqual(fixture(read.fixture));
			}
		},
	);

	test("the global stats read answers the fixture rows of its day", async () => {
		const origin = await start();
		const rows = (await (
			await fetch(
				`${origin}/rest/v1/daily_global_stats?select=*&category=eq.mixed&day=eq.2026-10-10`,
			)
		).json()) as { category: string; day: string }[];
		expect(rows.length).toBeGreaterThan(0);
		expect(
			rows.every((r) => r.category === "mixed" && r.day === "2026-10-10"),
		).toBe(true);
	});

	test("answers the CORS preflight with 204", async () => {
		const origin = await start();
		const response = await fetch(`${origin}/rest/v1/schedule`, {
			method: "OPTIONS",
		});
		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-headers")).toContain(
			"apikey",
		);
	});

	test("answers 404 to a read it has no stub for", async () => {
		const origin = await start();
		const response = await fetch(`${origin}/rest/v1/accounts?id=eq.x`);
		expect(response.status).toBe(404);
	});

	test("pins today to 2026-10-10", async () => {
		const origin = await start();
		const rows = (await (
			await fetch(`${origin}/rest/v1/rpc/current_dailies`, {
				method: "POST",
				body: "{}",
			})
		).json()) as { utc_date: string; server_time: string }[];
		expect(rows.length).toBe(3);
		for (const row of rows) {
			expect(row.utc_date).toBe("2026-10-10");
			expect(Date.parse(row.server_time)).toBe(
				Date.parse("2026-10-10T12:00:00Z"),
			);
		}
	});
});
