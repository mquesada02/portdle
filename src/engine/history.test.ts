import { expect, test } from "vitest";
import { groupBlitzRunsByDate, historyRows } from "./history";
import { http, vite } from "./test-fixtures";
import type { BlitzRun, CatalogEntry, ScheduleRow } from "./types";

const unfinishedToday = {
	mixed: false,
	protocols: false,
	applications: false,
};

function day(
	date: string,
	ids: [string, string, string] = ["http", "http", "vite"],
): ScheduleRow[] {
	return [
		{ category: "mixed", date, entryId: ids[0] },
		{ category: "protocols", date, entryId: ids[1] },
		{ category: "applications", date, entryId: ids[2] },
	];
}

function rows(options: {
	utcToday: string;
	schedule: ScheduleRow[];
	finishedToday?: typeof unfinishedToday;
	protocols?: CatalogEntry[];
	applications?: CatalogEntry[];
}) {
	return historyRows({
		utcToday: options.utcToday,
		schedule: options.schedule,
		protocols: options.protocols ?? [http],
		applications: options.applications ?? [vite],
		finishedToday: options.finishedToday ?? unfinishedToday,
	});
}

test("yesterday listed; today absent when unfinished", () => {
	expect(
		rows({
			utcToday: "2026-09-10",
			schedule: [...day("2026-09-09"), ...day("2026-09-10")],
		}),
	).toEqual([
		{ date: "2026-09-09", category: "mixed", name: "HTTP", port: 80 },
		{ date: "2026-09-09", category: "protocols", name: "HTTP", port: 80 },
		{ date: "2026-09-09", category: "applications", name: "Vite", port: 5173 },
	]);
});

test("today's row of a category is listed only when that category is finished", () => {
	expect(
		rows({
			utcToday: "2026-09-10",
			schedule: day("2026-09-10", ["vite", "http", "vite"]),
			finishedToday: { mixed: true, protocols: false, applications: false },
		}),
	).toEqual([
		{ date: "2026-09-10", category: "mixed", name: "Vite", port: 5173 },
	]);
});

test("a row dated after utcToday is not listed", () => {
	expect(rows({ utcToday: "2026-09-10", schedule: day("2026-09-11") })).toEqual(
		[],
	);
});

test("a row whose entry is unknown is skipped", () => {
	expect(
		rows({
			utcToday: "2026-09-11",
			schedule: day("2026-09-10", ["missing", "http", "vite"]),
		}).map((row) => row.category),
	).toEqual(["protocols", "applications"]);
});

test("later dates come first, categories in Daily order within a date", () => {
	expect(
		rows({
			utcToday: "2026-09-11",
			schedule: [...day("2026-09-09"), ...[...day("2026-09-10")].reverse()],
		}).map((row) => `${row.date} ${row.category}`),
	).toEqual([
		"2026-09-10 mixed",
		"2026-09-10 protocols",
		"2026-09-10 applications",
		"2026-09-09 mixed",
		"2026-09-09 protocols",
		"2026-09-09 applications",
	]);
});

test("a retired entry and an entry of another catalog kind still resolve", () => {
	const retired: CatalogEntry = {
		...http,
		id: "old",
		name: "Old",
		retired: true,
	};
	expect(
		rows({
			utcToday: "2026-09-10",
			schedule: day("2026-09-09", ["old", "vite", "http"]),
			protocols: [http, retired],
			applications: [vite],
		}).map((row) => row.name),
	).toEqual(["Old", "Vite", "HTTP"]);
});

function fakeRun(endedAt: string, score: number): BlitzRun {
	return {
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		ended: "timeout",
		endedAt,
		score,
		rounds: [],
	};
}

test("groupBlitzRunsByDate groups three runs across two local dates newest first", () => {
	const localDate = (endedAt: string) => endedAt.slice(0, 10);
	const newest = fakeRun("2026-09-10T12:00:00.000Z", 3);
	const middle = fakeRun("2026-09-10T08:00:00.000Z", 2);
	const oldest = fakeRun("2026-09-09T12:00:00.000Z", 1);
	expect(groupBlitzRunsByDate([newest, middle, oldest], localDate)).toEqual([
		{ date: "2026-09-10", runs: [newest, middle] },
		{ date: "2026-09-09", runs: [oldest] },
	]);
});
