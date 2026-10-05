// `pnpm check:fixtures`: reads each endpoint that the screenshot gate stubs
// (gate/stub.ts) from the running local stack and compares its keys and value
// types, never its values, with the committed fixture (gate/fixtures/). It
// exits with code 1 on any difference. It only sends reads and never starts or
// stops the stack, which other worktrees share. CI runs it in the `sql-tests`
// job, after the Schedule is filled.
// pnpm puts the supabase binary on PATH for package scripts.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	compareShapes,
	type Shape,
	shapeOfDefinition,
	shapeOfRows,
} from "./fixture-shapes.ts";
import { parseStackEnv } from "./stack-env.ts";

const STACK_MESSAGE =
	"The local stack does not answer the reads of the shape check. Run `pnpm dev` (it starts the stack) and `pnpm dev:schedule` (it fills the Schedule), then run `pnpm check:fixtures` again.";

// The requests that src/remote/supabase.ts sends, without the paging
// parameters. The Global stats view is empty on a fresh stack, so its shape
// comes from the OpenAPI document instead of rows.
const ROW_ENDPOINTS = [
	{
		name: "rpc/current_dailies",
		fixture: "current-dailies.json",
		path: "rpc/current_dailies",
		init: {
			method: "POST",
			body: "{}",
			headers: { "Content-Type": "application/json" },
		},
	},
	{
		name: "catalog_entries",
		fixture: "catalog.json",
		path: "catalog_entries?select=*&order=id",
		init: {},
	},
	{
		name: "schedule",
		fixture: "schedule.json",
		path: "schedule?select=category,day,entry_id&order=day,category",
		init: {},
	},
];

function readFixture(file: string): Record<string, unknown>[] {
	const rows: unknown = JSON.parse(
		readFileSync(
			join(import.meta.dirname, "..", "gate", "fixtures", file),
			"utf8",
		),
	);
	if (!Array.isArray(rows)) {
		throw new Error(`The fixture ${file} is not a JSON array of rows.`);
	}
	return rows;
}

async function main(): Promise<string[]> {
	let env: ReturnType<typeof parseStackEnv>;
	try {
		env = parseStackEnv(
			execFileSync("supabase", ["status", "-o", "env"], {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}),
		);
	} catch {
		throw new Error(STACK_MESSAGE);
	}

	async function read(path: string, init: RequestInit = {}): Promise<unknown> {
		let response: Response;
		try {
			response = await fetch(`${env.apiUrl}/rest/v1/${path}`, {
				...init,
				headers: {
					apikey: env.publishableKey,
					Authorization: `Bearer ${env.publishableKey}`,
					...init.headers,
				},
				signal: AbortSignal.timeout(10_000),
			});
		} catch {
			throw new Error(STACK_MESSAGE);
		}
		if (!response.ok) {
			throw new Error(`${STACK_MESSAGE} (${path} answered ${response.status})`);
		}
		return response.json();
	}

	const differences: string[] = [];
	function report(name: string, fixture: Shape, backend: Shape): void {
		const lines = compareShapes(name, fixture, backend);
		differences.push(...lines);
		if (lines.length === 0) {
			console.log(`ok ${name}`);
		}
	}

	for (const endpoint of ROW_ENDPOINTS) {
		const rows = await read(endpoint.path, endpoint.init);
		if (!Array.isArray(rows) || rows.length === 0) {
			throw new Error(
				`${endpoint.name} returned no rows, so it cannot prove a shape. ${STACK_MESSAGE}`,
			);
		}
		report(
			endpoint.name,
			shapeOfRows(readFixture(endpoint.fixture)),
			shapeOfRows(rows),
		);
	}

	const document = (await read("")) as {
		definitions?: Record<string, Parameters<typeof shapeOfDefinition>[0]>;
	};
	const definition = document.definitions?.daily_global_stats;
	if (!definition) {
		throw new Error(
			"The OpenAPI document of the stack has no definition for daily_global_stats.",
		);
	}
	report(
		"daily_global_stats",
		shapeOfRows(readFixture("daily-global-stats.json")),
		shapeOfDefinition(definition),
	);
	return differences;
}

try {
	const differences = await main();
	if (differences.length > 0) {
		console.error(differences.join("\n"));
		process.exit(1);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
