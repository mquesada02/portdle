import { expect, test } from "vitest";
import { emptyStats, foldStats, winPercent } from "./stats";
import type { DailyPersist } from "./types";
import { addUtcDays } from "./utc";

const D1 = "2026-09-10";
const day = (offset: number) => addUtcDays(D1, offset);

function won(tries: number, late?: boolean): DailyPersist {
	const guesses = Array.from({ length: tries }, (_, i) => ({
		port: 100 + i,
		result: i === tries - 1 ? ("correct" as const) : ("miss" as const),
		identified: null,
	}));
	return late === undefined
		? { status: "won", guesses }
		: { status: "won", guesses, late };
}

function lost(late?: boolean): DailyPersist {
	const guesses = [1, 2, 3, 4, 5, 6].map((port) => ({
		port,
		result: "miss" as const,
		identified: null,
	}));
	return late === undefined
		? { status: "lost", guesses }
		: { status: "lost", guesses, late };
}

function playing(late?: boolean): DailyPersist {
	const guesses = [{ port: 1, result: "miss" as const, identified: null }];
	return late === undefined
		? { status: "playing", guesses }
		: { status: "playing", guesses, late };
}

function fold(days: Array<[string, DailyPersist]>, serverToday: string) {
	return foldStats({ dailies: Object.fromEntries(days), serverToday });
}

test("win percent is 0 when unplayed", () => {
	expect(winPercent(emptyStats())).toBe(0);
});

test("fold: no record and an unfinished record give empty stats", () => {
	expect(fold([], D1)).toEqual(emptyStats());
	expect(fold([[D1, playing()]], D1)).toEqual(emptyStats());
});

test("fold: consecutive wins build a streak, a best streak, and the histogram", () => {
	const stats = fold(
		[
			[D1, won(3)],
			[day(1), won(1)],
			[day(2), won(3)],
		],
		day(2),
	);
	expect(stats).toEqual({
		played: 3,
		wins: 3,
		currentStreak: 3,
		bestStreak: 3,
		histogram: [1, 0, 2, 0, 0, 0],
	});
	expect(winPercent(stats)).toBe(1);
});

test("fold: a loss counts as played and does not enter the histogram", () => {
	const stats = fold(
		[
			[D1, won(1)],
			[day(1), lost()],
		],
		day(1),
	);
	expect(stats.played).toBe(2);
	expect(stats.wins).toBe(1);
	expect(stats.histogram).toEqual([1, 0, 0, 0, 0, 0]);
	expect(winPercent(stats)).toBe(0.5);
});

test("fold: a finished loss today ends the current streak, not the best", () => {
	const stats = fold(
		[
			[D1, won(2)],
			[day(1), lost()],
		],
		day(1),
	);
	expect(stats.currentStreak).toBe(0);
	expect(stats.bestStreak).toBe(1);
});

test("fold: a skipped day ends a run", () => {
	const stats = fold(
		[
			[D1, won(2)],
			[day(2), won(2)],
		],
		day(2),
	);
	expect(stats.currentStreak).toBe(1);
	expect(stats.bestStreak).toBe(1);
});

test("fold: a streak not extended by yesterday is broken at server today", () => {
	expect(fold([[D1, won(2)]], day(1)).currentStreak).toBe(1);
	const stale = fold([[D1, won(2)]], day(2));
	expect(stale.currentStreak).toBe(0);
	expect(stale.bestStreak).toBe(1);
});

test("fold: today's unfinished Daily does not break the streak", () => {
	const stats = fold(
		[
			[D1, won(2)],
			[day(1), playing()],
		],
		day(1),
	);
	expect(stats.currentStreak).toBe(1);
});

test("fold: an unfinished on-day record before today breaks the streak until won", () => {
	const wins = [
		[D1, won(2)],
		[day(1), won(2)],
		[day(3), won(2)],
	] satisfies Array<[string, DailyPersist]>;
	const open = fold([...wins, [day(2), playing(false)]], day(3));
	expect(open.currentStreak).toBe(1);
	expect(open.bestStreak).toBe(2);
	expect(fold([...wins, [day(2), playing(false)]], day(2)).currentStreak).toBe(
		2,
	);
	const closed = fold([...wins, [day(2), won(4, false)]], day(3));
	expect(closed.currentStreak).toBe(4);
	expect(closed.bestStreak).toBe(4);
});

test("fold: a record with no late reads as on-day", () => {
	const stats = fold(
		[
			[D1, won(2)],
			[day(1), won(2)],
		],
		day(1),
	);
	expect(stats.currentStreak).toBe(2);
});

test("fold: a late record counts in the totals, never in a streak", () => {
	const stats = fold(
		[
			[D1, won(2, true)],
			[day(1), won(3, true)],
		],
		day(1),
	);
	expect(stats).toEqual({
		played: 2,
		wins: 2,
		currentStreak: 0,
		bestStreak: 0,
		histogram: [0, 1, 1, 0, 0, 0],
	});
});

test("fold: a late record neither extends, repairs, nor breaks a streak", () => {
	const stats = fold(
		[
			[D1, won(2, false)],
			[day(1), won(2, true)],
			[day(2), won(2, false)],
			[day(3), lost(true)],
			[day(4), won(2, false)],
		],
		day(4),
	);
	expect(stats.currentStreak).toBe(1);
	expect(stats.bestStreak).toBe(1);
	expect(stats.played).toBe(5);
	expect(stats.wins).toBe(4);
});

test("fold: a late loss today does not end the current streak", () => {
	const stats = fold(
		[
			[D1, won(2, false)],
			[day(1), lost(true)],
		],
		day(1),
	);
	expect(stats.currentStreak).toBe(1);
});

test("fold: a win in a bad try count stays out of the histogram", () => {
	const odd: DailyPersist = {
		status: "won",
		guesses: Array.from({ length: 7 }, (_, i) => ({
			port: i,
			result: "correct" as const,
			identified: null,
		})),
	};
	const stats = fold([[D1, odd]], D1);
	expect(stats.wins).toBe(1);
	expect(stats.histogram).toEqual([0, 0, 0, 0, 0, 0]);
});

test("fold: records after server today are ignored", () => {
	const stats = fold(
		[
			[D1, won(2)],
			[day(1), won(2)],
		],
		D1,
	);
	expect(stats.played).toBe(1);
	expect(stats.currentStreak).toBe(1);
});

test("fold: gives the same result whatever order the Dailies are supplied in", () => {
	const days: Array<[string, DailyPersist]> = [
		[D1, won(2)],
		[day(1), lost()],
		[day(2), won(5)],
	];
	const forward = fold(days, day(3));
	const backward = fold([...days].reverse(), day(3));
	expect(backward).toEqual(forward);
});
