import { expect, test } from "vitest";
import {
	formatSummary,
	type Queryable,
	runGenerator,
	toEntry,
} from "./schedule-store.ts";

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
	for (const category of ["mixed", "protocols", "applications"] as const) {
		expect(result[category].inserted).toBeGreaterThan(0);
		expect(result[category].removed).toBe(0);
	}
	expect(formatSummary(result)).toMatch(
		/^mixed \+\d+ -0, protocols \+\d+ -0, applications \+\d+ -0$/,
	);
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
	// The second run with the same secret and the stored rows plans nothing.
	const second = fakeClient({
		frozen: "2026-10-01",
		entries: catalog,
		rows: stored,
	});
	const result = await runGenerator(second.client, "secret");
	expect(formatSummary(result)).toBe(
		"mixed +0 -0, protocols +0 -0, applications +0 -0",
	);

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

test("a database row maps to every CatalogEntry field", () => {
	expect(
		toEntry({
			id: "http",
			kind: "protocol",
			name: "HTTP",
			aliases: ["web"],
			port: 80,
			transport: "tcp",
			description: "d",
			blurb: "b",
			answer_eligible: true,
			retired: true,
			sources: [{ label: "l", url: "u" }],
		}),
	).toEqual({
		id: "http",
		name: "HTTP",
		aliases: ["web"],
		port: 80,
		transport: "tcp",
		description: "d",
		blurb: "b",
		answerEligible: true,
		retired: true,
		sources: [{ label: "l", url: "u" }],
	});
	expect(
		toEntry({
			id: "x",
			name: "X",
			aliases: [],
			port: 1,
			transport: "udp",
			description: "d",
			blurb: null,
			answer_eligible: false,
			retired: false,
			sources: [],
		}).blurb,
	).toBeUndefined();
});

async function insertedColumns(
	secret: string,
	frozen = "2026-10-01",
): Promise<unknown[]> {
	const base = fakeClient({ frozen, entries: catalog, rows: [] });
	let written: unknown[] = [];
	await runGenerator(
		{
			async query(text, values) {
				if (text.startsWith("insert into")) {
					written = values ?? [];
				}
				return base.client.query(text, values);
			},
		},
		secret,
	);
	return written;
}

test("the planned rows do not depend on the machine time zone", async () => {
	const original = process.env.TZ;
	try {
		process.env.TZ = "UTC";
		const utc = await insertedColumns("secret");
		process.env.TZ = "America/Los_Angeles";
		expect(await insertedColumns("secret")).toEqual(utc);
	} finally {
		if (original === undefined) {
			delete process.env.TZ;
		} else {
			process.env.TZ = original;
		}
	}
});

test("the thrown issue text names no future entry id", async () => {
	const written = await insertedColumns("secret", "2026-12-10");
	const [categories, days, ids, starts] = written as string[][];
	const stored = (categories ?? []).map((category, index) => ({
		category,
		day: days?.[index],
		entry_id:
			category === "protocols" && days?.[index] === "2026-12-18"
				? "zz-secret"
				: ids?.[index],
		cycle_start: starts?.[index],
	}));
	const { client } = fakeClient({
		frozen: "2026-10-01",
		entries: catalog,
		rows: stored,
	});
	const failure = await runGenerator(client, "secret").then(
		() => "",
		(error: Error) => error.message,
	);
	expect(failure).toContain("issues");
	expect(failure).not.toContain("zz-secret");
});
