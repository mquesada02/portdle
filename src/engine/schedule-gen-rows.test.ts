import { expect, test } from "vitest";
import applicationsJson from "../catalogs/applications.json";
import protocolsJson from "../catalogs/protocols.json";
import applicationsSchedule from "../catalogs/schedules/applications.json";
import mixedSchedule from "../catalogs/schedules/mixed.json";
import protocolsSchedule from "../catalogs/schedules/protocols.json";
import { answerPool, catalogFor } from "./catalog";
import { dailyKey } from "./daily-key";
import { hashSeed, mulberry32 } from "./rng";
import {
	generateFromRows,
	type RandomFactory,
	SCHEDULE_EPOCH,
	type StoredRow,
	sameCycleSwapIndex,
} from "./schedule-gen";
import { SWITCH_OVER_DAY } from "./switch-over";
import {
	type CatalogEntry,
	DAILY_CATEGORIES,
	type DailyCategory,
	type ScheduleFile,
} from "./types";
import { addUtcDays, utcDayIndex } from "./utc";

function entry(id: string, port: number, extra: Partial<CatalogEntry> = {}) {
	return {
		id,
		name: id,
		port,
		transport: "tcp",
		description: id,
		answerEligible: true,
		...extra,
	} satisfies CatalogEntry;
}

function makeCatalog(prefix: string, count: number, firstPort: number) {
	return Array.from({ length: count }, (_, index) =>
		entry(
			`${prefix}${String(index).padStart(2, "0")}`,
			firstPort + index,
			index === count - 1 ? { answerEligible: false } : {},
		),
	);
}

const protocols = makeCatalog("p", 46, 1000);
const applications = makeCatalog("a", 31, 2000);

function randomWith(tag: string): RandomFactory {
	return (key) => mulberry32(hashSeed(`${tag}|${key}`));
}
const randomA = randomWith("A");

function day(index: number): string {
	return addUtcDays(SCHEDULE_EPOCH, index);
}

function key(row: StoredRow): string {
	return dailyKey(row.category, row.day);
}

function run(
	rows: StoredRow[],
	frozenIndex: number,
	extra: {
		protocols?: CatalogEntry[];
		applications?: CatalogEntry[];
		random?: RandomFactory;
	} = {},
) {
	return generateFromRows({
		frozenThrough: day(frozenIndex),
		protocols: extra.protocols ?? protocols,
		applications: extra.applications ?? applications,
		rows,
		random: extra.random ?? randomA,
	});
}

function apply(
	rows: StoredRow[],
	out: { insert: StoredRow[]; remove: StoredRow[] },
): StoredRow[] {
	const removed = new Set(out.remove.map(key));
	return [...rows.filter((row) => !removed.has(key(row))), ...out.insert];
}

function fresh(frozenIndex: number, random = randomA): StoredRow[] {
	const out = run([], frozenIndex, { random });
	expect(out.issues).toEqual([]);
	return apply([], out);
}

function upTo(rows: StoredRow[], lastDay: string): StoredRow[] {
	return rows.filter((row) => row.day <= lastDay);
}

function cycles(rows: StoredRow[], category: DailyCategory) {
	const byStart = new Map<string, string[]>();
	for (const row of rows.filter(
		(candidate) => candidate.category === category,
	)) {
		byStart.set(row.cycleStart, [
			...(byStart.get(row.cycleStart) ?? []),
			row.entryId,
		]);
	}
	return byStart;
}

function lastDay(rows: StoredRow[], category: DailyCategory): string {
	return rows
		.filter((row) => row.category === category)
		.map((row) => row.day)
		.sort()
		.at(-1) as string;
}

function expectOneRange(rows: StoredRow[]) {
	for (const category of DAILY_CATEGORIES) {
		const mine = rows
			.filter((row) => row.category === category)
			.map((row) => row.day)
			.sort();
		expect(mine).toEqual(mine.map((_, index) => day(index)));
	}
}

function expectEachEntryOncePerCycle(rows: StoredRow[]) {
	for (const category of DAILY_CATEGORIES) {
		const pool = answerPool(catalogFor(category, protocols, applications))
			.map((candidate) => candidate.id)
			.sort();
		for (const ids of cycles(rows, category).values()) {
			expect([...ids].sort()).toEqual(pool);
		}
	}
}

function expectDistinctEachDay(rows: StoredRow[]) {
	const byDay = new Map<string, string[]>();
	for (const row of rows) {
		byDay.set(row.day, [...(byDay.get(row.day) ?? []), row.entryId]);
	}
	for (const ids of byDay.values()) {
		expect(new Set(ids).size).toBe(ids.length);
	}
}

test("an empty table is a fresh start covering frozen-through plus 7", () => {
	const rows = fresh(10);
	expectOneRange(rows);
	for (const category of DAILY_CATEGORIES) {
		expect(lastDay(rows, category) >= day(17)).toBe(true);
	}
	expectDistinctEachDay(rows);
});

test("cycles rebuild from rows, so a re-run on its own output plans nothing", () => {
	const rows = fresh(60);
	const again = run(rows, 60);
	expect(again.issues).toEqual([]);
	expect(again.insert).toEqual([]);
	expect(again.remove).toEqual([]);
});

test("a different secret gives a different order, the same secret the same", () => {
	const first = fresh(10, randomWith("one"));
	const same = fresh(10, randomWith("one"));
	const other = fresh(10, randomWith("two"));
	const order = (rows: StoredRow[]) => rows.map((row) => row.entryId).join(",");
	expect(order(same)).toBe(order(first));
	expect(order(other)).not.toBe(order(first));
});

test("the first run after an import completes the cut cycles with each entry once", () => {
	const imported = upTo(fresh(60), day(22));
	for (const frozenIndex of [22, 23]) {
		const out = run(imported, frozenIndex);
		expect(out.issues).toEqual([]);
		expect(out.remove).toEqual([]);
		const rows = apply(imported, out);
		expectOneRange(rows);
		expectEachEntryOncePerCycle(rows);
		expectDistinctEachDay(rows);
		for (const category of DAILY_CATEGORIES) {
			expect(lastDay(rows, category) >= day(frozenIndex + 7)).toBe(true);
		}
		for (const row of imported) {
			expect(rows).toContainEqual(row);
		}
	}
});

test("missing past days are inserted and no stored row changes", () => {
	const imported = upTo(fresh(60), day(20));
	const out = run(imported, 25);
	expect(out.issues).toEqual([]);
	expect(out.remove).toEqual([]);
	const inserted = out.insert.map((row) => row.day);
	for (let index = 21; index <= 25; index += 1) {
		expect(inserted).toContain(day(index));
	}
});

test("a retired entry in the future tail is replaced after the frozen day only", () => {
	const rows = fresh(60);
	const frozenIndex = 40;
	const tail = rows.find(
		(row) => row.category === "protocols" && row.day === day(43),
	) as StoredRow;
	const retired = protocols.map((candidate) =>
		candidate.id === tail.entryId ? { ...candidate, retired: true } : candidate,
	);
	const out = run(rows, frozenIndex, { protocols: retired });
	expect(out.issues).toEqual([]);
	expect(out.remove.length).toBeGreaterThan(0);
	for (const row of [...out.remove, ...out.insert]) {
		expect(row.day > day(frozenIndex)).toBe(true);
	}
	const next = apply(rows, out);
	expectOneRange(next);
	expect(
		next.some(
			(row) =>
				row.category === "protocols" &&
				row.entryId === tail.entryId &&
				row.day > day(frozenIndex),
		),
	).toBe(false);
	expect(run(next, frozenIndex, { protocols: retired }).insert).toEqual([]);
});

test("a cycle that shrinks or grows re-appends the later cycles with no gap or overlap", () => {
	const rows = fresh(60);
	const frozenIndex = 40;
	const tail = rows.find(
		(row) => row.category === "applications" && row.day === day(42),
	) as StoredRow;
	const retired = applications.map((candidate) =>
		candidate.id === tail.entryId ? { ...candidate, retired: true } : candidate,
	);
	const added = [...applications, entry("a99", 2099)];
	for (const changed of [retired, added]) {
		const out = run(rows, frozenIndex, { applications: changed });
		expect(out.issues).toEqual([]);
		const next = apply(rows, out);
		expectOneRange(next);
		for (const row of upTo(rows, day(frozenIndex))) {
			expect(next).toContainEqual(row);
		}
		expect(run(next, frozenIndex, { applications: changed }).insert).toEqual(
			[],
		);
	}
});

test("a new entry joins a complete last cycle as a past missing day", () => {
	const protocolPool = answerPool(protocols).length;
	const imported = upTo(fresh(80), day(protocolPool - 1));
	const added = [...protocols, entry("p99", 1099)];
	const out = run(imported, protocolPool + 2, { protocols: added });
	expect(out.issues).toEqual([]);
	expect(out.remove).toEqual([]);
	const joined = out.insert.find(
		(row) => row.category === "protocols" && row.day === day(protocolPool),
	);
	expect(joined?.entryId).toBe("p99");
	expect(joined?.cycleStart).toBe(SCHEDULE_EPOCH);
});

test("an empty category starts from the epoch", () => {
	const rows = fresh(10).filter((row) => row.category !== "applications");
	const out = run(rows, 10);
	expect(out.issues).toEqual([]);
	expect(
		out.insert.filter((row) => row.category === "applications")[0]?.day,
	).toBe(SCHEDULE_EPOCH);
});

test("a broken row set writes nothing", () => {
	const rows = fresh(10);
	const gap = rows.filter(
		(row) => !(row.category === "protocols" && row.day === day(3)),
	);
	const wrongStart = rows.map((row) =>
		row.category === "mixed" && row.day === day(0)
			? { ...row, cycleStart: day(1) }
			: row,
	);
	for (const broken of [gap, wrongStart]) {
		const out = run(broken, 10);
		expect(out.issues.length).toBeGreaterThan(0);
		expect(out.insert).toEqual([]);
		expect(out.remove).toEqual([]);
	}
});

test("an invalid catalog writes nothing", () => {
	const duplicate = [...protocols, entry("pdup", 3000, { name: "p00" })];
	const out = run(fresh(10), 10, { protocols: duplicate });
	expect(out.issues.length).toBeGreaterThan(0);
	expect(out.insert).toEqual([]);
	expect(out.remove).toEqual([]);
});

test("the plan never changes a stored row on or before the frozen day", () => {
	const rows = fresh(30);
	const protocolsOnly = protocols.filter((candidate) => candidate.id !== "p05");
	const out = run(rows, 30, { protocols: protocolsOnly });
	for (const row of out.remove) {
		expect(row.day > day(30)).toBe(true);
	}
});

test("Mixed swaps stay inside one cycle over many seeds", () => {
	for (let seed = 0; seed < 12; seed += 1) {
		const rows = fresh(150, randomWith(`seed${seed}`));
		expectEachEntryOncePerCycle(rows);
		expectDistinctEachDay(rows);
		expect(
			run(rows, 150, { random: randomWith(`seed${seed}`) }).insert,
		).toEqual([]);
	}
});

test("a collision with no same-cycle swap writes nothing", () => {
	const mixedPool = answerPool(
		catalogFor("mixed", protocols, applications),
	).length;
	const lastIndex = mixedPool - 1;
	let checked = false;
	for (let seed = 0; seed < 60 && !checked; seed += 1) {
		const rows = fresh(mixedPool + 10, randomWith(`collide${seed}`));
		const lastMixed = rows.find(
			(row) => row.category === "mixed" && row.day === day(lastIndex),
		) as StoredRow;
		const onDay = rows.find(
			(row) => row.category === "protocols" && row.day === day(lastIndex),
		) as StoredRow;
		const holder = rows.find(
			(row) =>
				row.category === "protocols" &&
				row.cycleStart === onDay.cycleStart &&
				row.entryId === lastMixed.entryId,
		);
		if (!holder) {
			continue;
		}
		const forced = rows.map((row) => {
			if (row === onDay) {
				return { ...row, entryId: lastMixed.entryId };
			}
			return row === holder ? { ...row, entryId: onDay.entryId } : row;
		});
		const out = run(forced, lastIndex - 1);
		expect(out.issues.length).toBeGreaterThan(0);
		expect(out.insert).toEqual([]);
		expect(out.remove).toEqual([]);
		checked = true;
	}
	expect(checked).toBe(true);
});

test("a new past row that collides with a frozen stored row writes nothing", () => {
	const rows = fresh(10);
	const onlyMixed = rows.filter(
		(row) => row.category === "mixed" || row.day <= day(10),
	);
	const probe = run(
		onlyMixed.filter(
			(row) => !(row.category === "protocols" && row.day === day(10)),
		),
		10,
	);
	const inserted = probe.insert.find(
		(row) => row.category === "protocols" && row.day === day(10),
	) as StoredRow;
	const forced = onlyMixed
		.filter((row) => !(row.category === "protocols" && row.day === day(10)))
		.map((row) =>
			row.category === "mixed" && row.day === day(10)
				? { ...row, entryId: inserted.entryId }
				: row,
		);
	const out = run(forced, 10);
	expect(
		out.issues.some((issue) => issue.startsWith("same-day collision")),
	).toBe(true);
	expect(out.insert).toEqual([]);
});

test("a collision between two stored historic rows does not fail the run", () => {
	const rows = fresh(10);
	const protocolsDay3 = rows.find(
		(row) => row.category === "protocols" && row.day === day(3),
	) as StoredRow;
	const forced = rows.map((row) =>
		row.category === "mixed" && row.day === day(3)
			? { ...row, entryId: protocolsDay3.entryId }
			: row,
	);
	expect(run(forced, 10).issues).toEqual([]);
});

test("a frozen answer missing from its catalog kind does not fail the run", () => {
	const rows = fresh(10).map((row) =>
		row.category === "protocols" && row.day === day(2)
			? { ...row, entryId: "a00" }
			: row,
	);
	expect(run(rows, 10).issues).toEqual([]);
});

test("issue text never names a future entry id", () => {
	const rows = fresh(60);
	const future = rows.find(
		(row) => row.category === "protocols" && row.day === day(50),
	) as StoredRow;
	const strange = rows.map((row) =>
		row === future ? { ...row, entryId: "zz-secret" } : row,
	);
	const out = run(strange, 10);
	expect(out.issues.length).toBeGreaterThan(0);
	expect(out.issues.join(" ")).not.toContain("zz-secret");
});

test("a retired entry that changes a cycle can re-append a later cycle with the same entry on a day but another start", () => {
	let found = false;
	for (let seed = 0; seed < 40 && !found; seed += 1) {
		const rows = fresh(60, randomWith(`start${seed}`));
		const tail = rows.find(
			(row) => row.category === "protocols" && row.day === day(43),
		) as StoredRow;
		const retired = protocols.map((candidate) =>
			candidate.id === tail.entryId
				? { ...candidate, retired: true }
				: candidate,
		);
		const out = run(rows, 40, {
			protocols: retired,
			random: randomWith(`start${seed}`),
		});
		expect(out.issues).toEqual([]);
		const removed = new Map(out.remove.map((row) => [key(row), row]));
		for (const row of out.insert) {
			const old = removed.get(key(row));
			if (
				old &&
				old.entryId === row.entryId &&
				old.cycleStart !== row.cycleStart
			) {
				found = true;
			}
		}
		const next = apply(rows, out);
		expectOneRange(next);
		expect(
			run(next, 40, { protocols: retired, random: randomWith(`start${seed}`) })
				.insert,
		).toEqual([]);
	}
	expect(found).toBe(true);
});

test("Mixed covers a day that another category's cycle reaches by appending a whole cycle", () => {
	const rows = fresh(40);
	const mixedPool = answerPool(
		catalogFor("mixed", protocols, applications),
	).length;
	expect(lastDay(rows, "protocols") > day(mixedPool - 1)).toBe(true);
	expect(lastDay(rows, "mixed") >= lastDay(rows, "protocols")).toBe(true);
	expectEachEntryOncePerCycle(rows);
	expectDistinctEachDay(rows);
});

test("a collision with an earlier movable day in the same cycle is fixed by a swap there", () => {
	const mixedPool = answerPool(
		catalogFor("mixed", protocols, applications),
	).length;
	const lastIndex = mixedPool - 1;
	let checked = false;
	for (let seed = 0; seed < 60 && !checked; seed += 1) {
		const rows = fresh(mixedPool + 10, randomWith(`earlier${seed}`));
		const lastMixed = rows.find(
			(row) => row.category === "mixed" && row.day === day(lastIndex),
		) as StoredRow;
		const onDay = rows.find(
			(row) => row.category === "protocols" && row.day === day(lastIndex),
		) as StoredRow;
		const holder = rows.find(
			(row) =>
				row.category === "protocols" &&
				row.cycleStart === onDay.cycleStart &&
				row.entryId === lastMixed.entryId,
		);
		if (!holder) {
			continue;
		}
		const forced = rows.map((row) => {
			if (row === onDay) {
				return { ...row, entryId: lastMixed.entryId };
			}
			return row === holder ? { ...row, entryId: onDay.entryId } : row;
		});
		const out = run(forced, lastIndex - 5, {
			random: randomWith(`earlier${seed}`),
		});
		if (out.issues.length > 0) {
			continue;
		}
		checked = true;
		const next = apply(forced, out);
		expect(
			next.find((row) => row.category === "mixed" && row.day === day(lastIndex))
				?.entryId,
		).not.toBe(lastMixed.entryId);
		const mixedCycle = next.filter(
			(row) => row.category === "mixed" && row.cycleStart === SCHEDULE_EPOCH,
		);
		expect(new Set(mixedCycle.map((row) => row.entryId)).size).toBe(
			mixedCycle.length,
		);
		for (const row of [...out.remove, ...out.insert]) {
			expect(row.day > day(lastIndex - 5)).toBe(true);
		}
	}
	expect(checked).toBe(true);
});

test("Mixed resolution never moves a frozen stored row, whatever the seed", () => {
	for (let seed = 0; seed < 10; seed += 1) {
		const random = randomWith(`frozen${seed}`);
		const rows = fresh(30, random);
		const smaller = protocols.filter((candidate) => candidate.id !== "p05");
		const out = run(rows, 30, { protocols: smaller, random });
		expect(out.issues).toEqual([]);
		for (const row of out.remove) {
			expect(row.day > day(30)).toBe(true);
		}
		const next = apply(rows, out);
		for (const row of upTo(rows, day(30))) {
			expect(next).toContainEqual(row);
		}
	}
});

test("missing past days come with distinctness and coverage through frozen-through plus 7", () => {
	const imported = upTo(fresh(60), day(20));
	const rows = apply(imported, run(imported, 25));
	expectDistinctEachDay(rows);
	for (const category of DAILY_CATEGORIES) {
		expect(lastDay(rows, category) >= day(32)).toBe(true);
	}
});

function committedRows(): StoredRow[] {
	const schedules: Record<DailyCategory, ScheduleFile> = {
		mixed: mixedSchedule as ScheduleFile,
		protocols: protocolsSchedule as ScheduleFile,
		applications: applicationsSchedule as ScheduleFile,
	};
	const last = utcDayIndex(SWITCH_OVER_DAY, SCHEDULE_EPOCH);
	return DAILY_CATEGORIES.flatMap((category) =>
		Array.from({ length: last + 1 }, (_, index) => {
			const cycle = schedules[category].cycles.find(
				(candidate) =>
					candidate.startDay <= index &&
					index < candidate.startDay + candidate.order.length,
			) as ScheduleFile["cycles"][number];
			return {
				category,
				day: day(index),
				entryId: cycle.order[index - cycle.startDay] as string,
				cycleStart: day(cycle.startDay),
			};
		}),
	);
}

test("the first run after the real import fills the cut cycles, each entry once", () => {
	const imported = committedRows();
	const real = {
		protocols: protocolsJson as CatalogEntry[],
		applications: applicationsJson as CatalogEntry[],
	};
	for (const frozen of [SWITCH_OVER_DAY, addUtcDays(SWITCH_OVER_DAY, 1)]) {
		const out = generateFromRows({
			frozenThrough: frozen,
			...real,
			rows: imported,
			random: randomA,
		});
		expect(out.issues).toEqual([]);
		expect(out.remove).toEqual([]);
		const rows = [...imported, ...out.insert];
		for (const category of DAILY_CATEGORIES) {
			const pool = answerPool(
				catalogFor(category, real.protocols, real.applications),
			)
				.map((candidate) => candidate.id)
				.sort();
			for (const ids of cycles(rows, category).values()) {
				expect([...ids].sort()).toEqual(pool);
			}
		}
		for (const row of out.insert) {
			const start = rows.find(
				(candidate) =>
					candidate.category === row.category &&
					candidate.cycleStart === row.cycleStart &&
					candidate.day < row.day,
			);
			expect(start === undefined ? row.cycleStart === row.day : true).toBe(
				true,
			);
		}
	}
});

test("a same-cycle swap is rejected when the displaced entry would collide on the partner day", () => {
	const schedule = (order: string[]): ScheduleFile => ({
		epoch: SCHEDULE_EPOCH,
		cycles: [{ startDay: 0, order }],
	});
	// Day 2 collides: Mixed and Protocols both hold "x".
	const schedules = {
		mixed: schedule(["m0", "m1", "x"]),
		protocols: schedule(["p0", "x", "x"]),
		applications: schedule(["a0", "a1", "a2"]),
	};
	// Day 1: Protocols holds "x" there, so moving "x" to day 1 would collide.
	// Day 0 is clear, so the swap goes to day 0.
	expect(sameCycleSwapIndex(schedules, 0, 2, "x", "x", "a2")?.index).toBe(0);
	// With only day 1 movable the swap is rejected.
	expect(sameCycleSwapIndex(schedules, 1, 2, "x", "x", "a2")).toBeUndefined();
	// A later day is used before an earlier one.
	const withLater = {
		mixed: schedule(["m0", "x", "m2", "m3"]),
		protocols: schedule(["p0", "x", "p2", "p3"]),
		applications: schedule(["a0", "a1", "a2", "a3"]),
	};
	expect(sameCycleSwapIndex(withLater, 0, 1, "x", "x", "a1")?.index).toBe(2);
});

test("an A2 change that keeps the cycle length leaves later cycles alone", () => {
	const rows = fresh(60);
	const tail = rows.find(
		(row) => row.category === "protocols" && row.day === day(43),
	) as StoredRow;
	const swapped = [
		...protocols.map((candidate) =>
			candidate.id === tail.entryId
				? { ...candidate, retired: true }
				: candidate,
		),
		entry("p98", 1098),
	];
	const out = run(rows, 40, { protocols: swapped });
	expect(out.issues).toEqual([]);
	expect(out.insert.length).toBeGreaterThan(0);
	for (const row of [...out.remove, ...out.insert]) {
		if (row.category === "protocols") {
			expect(row.day < day(45)).toBe(true);
		}
	}
});
