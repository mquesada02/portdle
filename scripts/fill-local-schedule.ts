// Fills the local stack's Schedule through the frozen-through day + 7 by
// running the generator as the generator role. It sets a fixed local password
// on that role first (nothing secret) and uses a dev secret seed. It refuses
// any database that is not on this machine, so a mistaken DATABASE_URL can
// never put a known password on a live role.

import { pathToFileURL } from "node:url";
import pg from "pg";
import { runGenerator } from "./schedule-store.ts";

const GENERATOR_PASSWORD = "schedule-generator-local";
const DEV_SEED = "portdle-dev-seed";
const DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export type Connection = {
	user: string;
	password: string;
	host: string;
	port: number;
	database: string;
};

export function localConnection(databaseUrl: string): Connection {
	const url = new URL(databaseUrl);
	if (!LOCAL_HOSTS.has(url.hostname)) {
		throw new Error("Refusing to run: the database is not on this machine.");
	}
	if (url.search !== "" || url.hash !== "") {
		throw new Error("Refusing to run: the database URL has a query string.");
	}
	return {
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		host: url.hostname.replace(/^\[|\]$/g, ""),
		port: url.port === "" ? 5432 : Number(url.port),
		database: decodeURIComponent(url.pathname.slice(1)),
	};
}

export async function fillLocalSchedule(
	databaseUrl: string,
): Promise<{ inserted: number; removed: number }> {
	const admin = localConnection(databaseUrl);
	const owner = new pg.Client(admin);
	await owner.connect();
	try {
		await owner.query(
			`alter role schedule_generator with password '${GENERATOR_PASSWORD}'`,
		);
	} finally {
		await owner.end();
	}
	const generator = new pg.Client({
		...admin,
		user: "schedule_generator",
		password: GENERATOR_PASSWORD,
	});
	await generator.connect();
	try {
		return await runGenerator(generator, DEV_SEED);
	} finally {
		await generator.end();
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	try {
		const { inserted, removed } = await fillLocalSchedule(
			process.env.DATABASE_URL ?? DEFAULT_URL,
		);
		console.log(
			`Local Schedule updated: ${inserted} rows inserted, ${removed} removed.`,
		);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
