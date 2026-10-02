import { expect, test } from "vitest";
import { groupBlitzRunsByDate, historyRows, type SavedDaily } from "./history";
import { http, vite } from "./test-fixtures";
import type {
	BlitzRun,
	CatalogEntry,
	DailyCategory,
	ScheduleRow,
} from "./types";

function saved(
	date: string,
	category: DailyCategory,
	status: SavedDaily["status"] = "won",
	tries = 3,
): SavedDaily {
	return { date, category, status, tries };
}

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
	saved: SavedDaily[];
	schedule?: ScheduleRow[];
	protocols?: CatalogEntry[];
	applications?: CatalogEntry[];
}) {
	return historyRows({
		saved: options.saved,
		schedule: options.schedule ?? [],
		protocols: options.protocols ?? [http],
		applications: options.applications ?? [vite],
	});
}

test("only finished Dailies are listed, with their result", () => {
	expect(
		rows({
			saved: [
				saved("2026-09-09", "mixed", "won", 4),
				saved("2026-09-09", "protocols", "playing", 2),
				saved("2026-09-09", "applications", "lost", 6),
			],
			schedule: day("2026-09-09"),
		}),
	).toEqual([
		{
			date: "2026-09-09",
			category: "mixed",
			status: "won",
			tries: 4,
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-09",
			category: "applications",
			status: "lost",
			tries: 6,
			name: "Vite",
			port: 5173,
		},
	]);
});

test("later dates come first, categories in Daily order within a date", () => {
	expect(
		rows({
			saved: [
				saved("2026-09-09", "applications"),
				saved("2026-09-10", "protocols"),
				saved("2026-09-09", "mixed"),
				saved("2026-09-10", "mixed"),
			],
		}).map((row) => `${row.date} ${row.category}`),
	).toEqual([
		"2026-09-10 mixed",
		"2026-09-10 protocols",
		"2026-09-09 mixed",
		"2026-09-09 applications",
	]);
});

test("a finished Daily with no Schedule row or no catalog entry stays listed without a name", () => {
	expect(
		rows({
			saved: [saved("2026-09-09", "mixed"), saved("2026-09-10", "mixed")],
			schedule: [{ category: "mixed", date: "2026-09-10", entryId: "missing" }],
		}).map((row) => [row.date, row.name, row.port]),
	).toEqual([
		["2026-09-10", undefined, undefined],
		["2026-09-09", undefined, undefined],
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
			saved: [
				saved("2026-09-09", "mixed"),
				saved("2026-09-09", "protocols"),
				saved("2026-09-09", "applications"),
			],
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
