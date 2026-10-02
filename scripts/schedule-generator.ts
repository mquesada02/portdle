// Runs the Schedule generator against Postgres as the generator role.
// SCHEDULE_DATABASE_URL: connection string of the generator role (the live
// pooler in session mode, port 5432). SCHEDULE_SEED: the secret seed.

import pg from "pg";
import { formatSummary, runGenerator } from "./schedule-store.ts";

const url = process.env.SCHEDULE_DATABASE_URL;
const seed = process.env.SCHEDULE_SEED;
if (!url || !seed) {
	console.error("Set SCHEDULE_DATABASE_URL and SCHEDULE_SEED.");
	process.exit(1);
}

const client = new pg.Client({ connectionString: url });
try {
	await client.connect();
	console.log(
		`Schedule updated: ${formatSummary(await runGenerator(client, seed))}`,
	);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	await client.end();
}
