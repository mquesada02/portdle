import { expect, test } from "vitest";
import {
	archiveRows,
	boardEntryId,
	isArchiveDay,
	resultLabel,
} from "./archive";
import type { DailyCategory, ScheduleRow } from "./types";

function day(
	date: string,
	categories: DailyCategory[] = ["mixed", "protocols", "applications"],
): ScheduleRow[] {
	return categories.map((category) => ({
		category,
		date,
		entryId: `${category}-${date}`,
	}));
}

test("isArchiveDay spans the first Daily through server today", () => {
	expect(isArchiveDay("2026-09-08", "2026-09-11")).toBe(false);
	expect(isArchiveDay("2026-09-09", "2026-09-11")).toBe(true);
	expect(isArchiveDay("2026-09-11", "2026-09-11")).toBe(true);
	expect(isArchiveDay("2026-09-12", "2026-09-11")).toBe(false);
});

test("archiveRows lists past days newest first in category order, never today or later", () => {
	const rows = archiveRows(
		[
			...day("2026-09-09"),
			...day("2026-09-11"),
			...day("2026-09-10").reverse(),
			...day("2026-09-12"),
		],
		"2026-09-11",
	);
	expect(rows.map((row) => `${row.date} ${row.category}`)).toEqual([
		"2026-09-10 mixed",
		"2026-09-10 protocols",
		"2026-09-10 applications",
		"2026-09-09 mixed",
		"2026-09-09 protocols",
		"2026-09-09 applications",
	]);
});

test("archiveRows lists only the categories a day has, and nothing before the first Daily", () => {
	const rows = archiveRows(
		[...day("2026-09-10", ["protocols"]), ...day("2026-09-08")],
		"2026-09-11",
	);
	expect(rows.map((row) => `${row.date} ${row.category}`)).toEqual([
		"2026-09-10 protocols",
	]);
});

test("boardEntryId finds the row inside the range, today included", () => {
	const schedule = [...day("2026-09-10"), ...day("2026-09-11")];
	expect(boardEntryId(schedule, "mixed", "2026-09-10", "2026-09-11")).toBe(
		"mixed-2026-09-10",
	);
	expect(
		boardEntryId(schedule, "applications", "2026-09-11", "2026-09-11"),
	).toBe("applications-2026-09-11");
});

test("boardEntryId is null before the first Daily, after today, and with no row", () => {
	const schedule = [
		...day("2026-09-08"),
		...day("2026-09-12"),
		...day("2026-09-10", ["mixed"]),
	];
	expect(
		boardEntryId(schedule, "mixed", "2026-09-08", "2026-09-11"),
	).toBeNull();
	expect(
		boardEntryId(schedule, "mixed", "2026-09-12", "2026-09-11"),
	).toBeNull();
	expect(
		boardEntryId(schedule, "protocols", "2026-09-10", "2026-09-11"),
	).toBeNull();
});

test("resultLabel names the four states", () => {
	expect(resultLabel({ status: "won", tries: 3 })).toBe("Won 3/6");
	expect(resultLabel({ status: "lost", tries: 6 })).toBe("Lost");
	expect(resultLabel({ status: "playing", tries: 2 })).toBe("In progress 2/6");
	expect(resultLabel({ status: "playing", tries: 0 })).toBe("Not played");
	expect(resultLabel(null)).toBe("Not played");
});
