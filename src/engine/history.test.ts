import { expect, test } from "vitest";
import { groupBlitzRunsByDate, historyRows } from "./history";
import { http, vite } from "./test-fixtures";
import type { BlitzRun, ScheduleFile } from "./types";

const unfinishedToday = {
	mixed: false,
	protocols: false,
	applications: false,
};

const schedules: Record<"mixed" | "protocols" | "applications", ScheduleFile> =
	{
		mixed: {
			epoch: "2026-09-09",
			cycles: [{ startDay: 0, order: ["http", "vite"] }],
		},
		protocols: {
			epoch: "2026-09-09",
			cycles: [{ startDay: 0, order: ["http", "http"] }],
		},
		applications: {
			epoch: "2026-09-09",
			cycles: [{ startDay: 0, order: ["vite", "vite"] }],
		},
	};

function rows(options: {
	utcToday: string;
	schedules?: typeof schedules;
	finishedToday?: typeof unfinishedToday;
}) {
	return historyRows({
		utcToday: options.utcToday,
		schedules: options.schedules ?? schedules,
		protocols: [http],
		applications: [vite],
		finishedToday: options.finishedToday ?? unfinishedToday,
	});
}

test("yesterday listed; today absent when unfinished", () => {
	expect(rows({ utcToday: "2026-09-10" })).toEqual([
		{
			date: "2026-09-09",
			category: "mixed",
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-09",
			category: "protocols",
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-09",
			category: "applications",
			name: "Vite",
			port: 5173,
		},
	]);
});

test("today Mixed listed only when finishedToday.mixed", () => {
	expect(
		rows({
			utcToday: "2026-09-10",
			finishedToday: {
				mixed: true,
				protocols: false,
				applications: false,
			},
		}),
	).toEqual([
		{
			date: "2026-09-10",
			category: "mixed",
			name: "Vite",
			port: 5173,
		},
		{
			date: "2026-09-09",
			category: "mixed",
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-09",
			category: "protocols",
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-09",
			category: "applications",
			name: "Vite",
			port: 5173,
		},
	]);
});

test("no row has date after utcToday", () => {
	expect(
		rows({ utcToday: "2026-09-10" }).some((row) => row.date > "2026-09-10"),
	).toBe(false);
});

test("unknown id is skipped", () => {
	expect(
		rows({
			utcToday: "2026-09-11",
			schedules: {
				mixed: {
					epoch: "2026-09-09",
					cycles: [{ startDay: 0, order: ["missing", "http"] }],
				},
				protocols: {
					epoch: "2026-09-09",
					cycles: [{ startDay: 0, order: ["http", "http"] }],
				},
				applications: {
					epoch: "2026-09-09",
					cycles: [{ startDay: 0, order: ["vite", "vite"] }],
				},
			},
		}),
	).toEqual([
		{
			date: "2026-09-10",
			category: "mixed",
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-10",
			category: "protocols",
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-10",
			category: "applications",
			name: "Vite",
			port: 5173,
		},
		{
			date: "2026-09-09",
			category: "protocols",
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-09",
			category: "applications",
			name: "Vite",
			port: 5173,
		},
	]);
});

test("day before epoch is not listed", () => {
	expect(
		rows({ utcToday: "2026-09-10" }).some((row) => row.date === "2026-09-08"),
	).toBe(false);
});

test("later date's rows come before earlier date's rows", () => {
	expect(rows({ utcToday: "2026-09-11" }).map((row) => row.date)).toEqual([
		"2026-09-10",
		"2026-09-10",
		"2026-09-10",
		"2026-09-09",
		"2026-09-09",
		"2026-09-09",
	]);
});

test("two cycles both contribute past days", () => {
	expect(
		rows({
			utcToday: "2026-09-11",
			schedules: {
				mixed: {
					epoch: "2026-09-09",
					cycles: [
						{ startDay: 0, order: ["http"] },
						{ startDay: 1, order: ["vite"] },
					],
				},
				protocols: {
					epoch: "2026-09-09",
					cycles: [
						{ startDay: 0, order: ["http"] },
						{ startDay: 1, order: ["http"] },
					],
				},
				applications: {
					epoch: "2026-09-09",
					cycles: [
						{ startDay: 0, order: ["vite"] },
						{ startDay: 1, order: ["vite"] },
					],
				},
			},
		}),
	).toEqual([
		{
			date: "2026-09-10",
			category: "mixed",
			name: "Vite",
			port: 5173,
		},
		{
			date: "2026-09-10",
			category: "protocols",
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-10",
			category: "applications",
			name: "Vite",
			port: 5173,
		},
		{
			date: "2026-09-09",
			category: "mixed",
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-09",
			category: "protocols",
			name: "HTTP",
			port: 80,
		},
		{
			date: "2026-09-09",
			category: "applications",
			name: "Vite",
			port: 5173,
		},
	]);
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
