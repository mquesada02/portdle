import {
	generateFromRows,
	type StoredRow,
} from "../src/engine/schedule-gen.ts";
import type {
	CatalogEntry,
	DailyCategory,
	Source,
} from "../src/engine/types.ts";
import { hmacRandom } from "./hmac-random.ts";

export type Queryable = {
	query(
		text: string,
		values?: unknown[],
	): Promise<{ rows: Record<string, unknown>[] }>;
};

// Held for the length of the transaction, so two runs queue.
const LOCK_KEY = 1850001;

function toEntry(row: Record<string, unknown>): CatalogEntry {
	return {
		id: row.id as string,
		name: row.name as string,
		aliases: row.aliases as string[],
		port: row.port as number,
		transport: row.transport as CatalogEntry["transport"],
		description: row.description as string,
		blurb: (row.blurb as string | null) ?? undefined,
		answerEligible: row.answer_eligible as boolean,
		retired: row.retired as boolean,
		sources: row.sources as Source[],
	};
}

function toStoredRow(row: Record<string, unknown>): StoredRow {
	return {
		category: row.category as DailyCategory,
		day: row.day as string,
		entryId: row.entry_id as string,
		cycleStart: row.cycle_start as string,
	};
}

function columns(rows: StoredRow[]) {
	return [
		rows.map((row) => row.category),
		rows.map((row) => row.day),
		rows.map((row) => row.entryId),
		rows.map((row) => row.cycleStart),
	];
}

// Reads the catalog and the stored Schedule rows, plans, and writes in one
// transaction. Any issue or error rolls back and throws, with no writes.
export async function runGenerator(
	client: Queryable,
	secret: string,
): Promise<{ inserted: number; removed: number }> {
	const random = hmacRandom(secret);
	await client.query("begin");
	try {
		await client.query("select pg_advisory_xact_lock($1)", [LOCK_KEY]);
		const frozen = await client.query(
			"select public.schedule_frozen_through()::text as day",
		);
		const entries = (
			await client.query(
				"select id, kind, name, aliases, port, transport, description, blurb, answer_eligible, retired, sources from public.catalog_entries order by id",
			)
		).rows;
		const stored = (
			await client.query(
				"select category, day::text as day, entry_id, cycle_start::text as cycle_start from public.schedule order by category, day",
			)
		).rows.map(toStoredRow);
		const plan = generateFromRows({
			frozenThrough: (frozen.rows[0] as { day: string }).day,
			protocols: entries.filter((row) => row.kind === "protocol").map(toEntry),
			applications: entries
				.filter((row) => row.kind === "application")
				.map(toEntry),
			rows: stored,
			random,
		});
		if (plan.issues.length > 0) {
			throw new Error(
				`The Schedule generator found issues:\n${plan.issues.join("\n")}`,
			);
		}
		if (plan.remove.length > 0) {
			const [category, day] = columns(plan.remove);
			await client.query(
				"delete from public.schedule as s using unnest($1::text[], $2::date[]) as r(category, day) where s.category = r.category and s.day = r.day",
				[category, day],
			);
		}
		if (plan.insert.length > 0) {
			await client.query(
				"insert into public.schedule (category, day, entry_id, cycle_start) select * from unnest($1::text[], $2::date[], $3::text[], $4::date[])",
				columns(plan.insert),
			);
		}
		await client.query("commit");
		return { inserted: plan.insert.length, removed: plan.remove.length };
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
}
