import { expect, test } from "vitest";
import { type Queryable, runGenerator } from "./schedule-store.ts";

type Reply = Record<string, unknown>[];

function fakeClient(replies: { frozen: string; entries: Reply; rows: Reply }) {
	const statements: string[] = [];
	const client: Queryable = {
		async query(text) {
			statements.push(text);
			if (text.includes("schedule_frozen_through")) {
				return { rows: [{ day: replies.frozen }] };
			}
			if (text.includes("from public.catalog_entries")) {
				return { rows: replies.entries };
			}
			if (text.includes("from public.schedule order")) {
				return { rows: replies.rows };
			}
			return { rows: [] };
		},
	};
	return { client, statements };
}

function entries(
	prefix: string,
	kind: string,
	count: number,
	firstPort: number,
) {
	return Array.from({ length: count }, (_, index) => ({
		id: `${prefix}${String(index).padStart(2, "0")}`,
		kind,
		name: `${prefix}${index}`,
		aliases: [],
		port: firstPort + index,
		transport: "tcp",
		description: "d",
		blurb: null,
		answer_eligible: index !== count - 1,
		retired: false,
		sources: [],
	}));
}

const catalog = [
	...entries("p", "protocol", 46, 1000),
	...entries("a", "application", 31, 2000),
];

test("writes inside one transaction: lock first, then reads, then insert, then commit", async () => {
	const { client, statements } = fakeClient({
		frozen: "2026-10-01",
		entries: catalog,
		rows: [],
	});
	const result = await runGenerator(client, "secret");
	expect(result.inserted).toBeGreaterThan(0);
	expect(statements[0]).toBe("begin");
	expect(statements[1]).toContain("pg_advisory_xact_lock");
	expect(statements.at(-1)).toBe("commit");
	expect(statements.some((text) => text.startsWith("insert into"))).toBe(true);
});

test("an invalid catalog rolls back with no write", async () => {
	const broken = [...catalog, { ...catalog[0], id: "dup", port: 3000 }];
	const { client, statements } = fakeClient({
		frozen: "2026-10-01",
		entries: broken,
		rows: [],
	});
	await expect(runGenerator(client, "secret")).rejects.toThrow("issues");
	expect(statements.at(-1)).toBe("rollback");
	expect(statements.some((text) => /^(insert|delete)/.test(text))).toBe(false);
});

test("a missing or blank secret throws before any query", async () => {
	for (const secret of ["", "   "]) {
		const { client, statements } = fakeClient({
			frozen: "2026-10-01",
			entries: catalog,
			rows: [],
		});
		await expect(runGenerator(client, secret)).rejects.toThrow();
		expect(statements).toEqual([]);
	}
});

test("rows after the frozen day are deleted before the new rows are inserted", async () => {
	const first = fakeClient({
		frozen: "2026-10-01",
		entries: catalog,
		rows: [],
	});
	let written: unknown[] = [];
	const capture: Queryable = {
		async query(text, values) {
			if (text.startsWith("insert into")) {
				written = values ?? [];
			}
			return first.client.query(text, values);
		},
	};
	await runGenerator(capture, "secret");
	const [categories, days, ids, starts] = written as string[][];
	const stored = (categories ?? []).map((category, index) => ({
		category,
		day: days?.[index],
		entry_id: ids?.[index],
		cycle_start: starts?.[index],
	}));
	// Same rows, the frozen day moved back: every row after it is replaced
	// only if the plan differs; the second run with the same secret plans nothing.
	const second = fakeClient({
		frozen: "2026-10-01",
		entries: catalog,
		rows: stored,
	});
	const result = await runGenerator(second.client, "secret");
	expect(result).toEqual({ inserted: 0, removed: 0 });

	// A retired entry in a stored future row forces a delete, sent before the insert.
	const futureId = stored.find((row) => row.day === "2026-10-20")?.entry_id;
	const changed = catalog.map((row) =>
		row.id === futureId ? { ...row, retired: true } : row,
	);
	const third = fakeClient({
		frozen: "2026-10-01",
		entries: changed,
		rows: stored,
	});
	await runGenerator(third.client, "secret");
	const deleteAt = third.statements.findIndex((text) =>
		text.startsWith("delete from"),
	);
	const insertAt = third.statements.findIndex((text) =>
		text.startsWith("insert into"),
	);
	expect(deleteAt).toBeGreaterThan(0);
	expect(insertAt).toBeGreaterThan(deleteAt);
});

test("dates are read as text, never as Date objects", async () => {
	const { client, statements } = fakeClient({
		frozen: "2026-10-01",
		entries: catalog,
		rows: [],
	});
	await runGenerator(client, "secret");
	const read = statements.find((text) =>
		text.includes("from public.schedule order"),
	);
	expect(read).toContain("day::text");
	expect(read).toContain("cycle_start::text");
});
