import { expect, test } from "vitest";
import {
	applyDailyFinish,
	applyStreakGap,
	emptyStats,
	winPercent,
} from "./stats";

test("win increments streak and histogram", () => {
	const stats = applyDailyFinish({
		stats: emptyStats(),
		result: "won",
		tries: 3,
	});
	expect(stats).toEqual({
		played: 1,
		wins: 1,
		currentStreak: 1,
		bestStreak: 1,
		histogram: [0, 0, 1, 0, 0, 0],
	});
	expect(winPercent(stats)).toBe(1);
});

test("loss resets streak and does not increment histogram", () => {
	const started = applyDailyFinish({
		stats: emptyStats(),
		result: "won",
		tries: 1,
	});
	const stats = applyDailyFinish({
		stats: started,
		result: "lost",
		tries: 6,
	});
	expect(stats.played).toBe(2);
	expect(stats.wins).toBe(1);
	expect(stats.currentStreak).toBe(0);
	expect(stats.bestStreak).toBe(1);
	expect(stats.histogram).toEqual([1, 0, 0, 0, 0, 0]);
	expect(winPercent(stats)).toBe(0.5);
});

test("win percent is 0 when unplayed", () => {
	expect(winPercent(emptyStats())).toBe(0);
});

test("utc skip resets current streak", () => {
	const started = applyDailyFinish({
		stats: emptyStats(),
		result: "won",
		tries: 1,
	});
	const gapped = applyStreakGap({
		stats: started,
		utcToday: "2026-09-12",
		lastPlayed: "2026-09-09",
		yesterdayPersist: null,
	});
	expect(gapped.currentStreak).toBe(0);
	expect(gapped.bestStreak).toBe(1);
});

test("unfinished yesterday resets current streak", () => {
	const started = applyDailyFinish({
		stats: emptyStats(),
		result: "won",
		tries: 1,
	});
	const gapped = applyStreakGap({
		stats: started,
		utcToday: "2026-09-11",
		lastPlayed: "2026-09-09",
		yesterdayPersist: {
			status: "playing",
			guesses: [{ port: 80, result: "miss", identified: null }],
		},
	});
	expect(gapped.currentStreak).toBe(0);
});

test("missing lastPlayed leaves streak stored", () => {
	const started = applyDailyFinish({
		stats: emptyStats(),
		result: "won",
		tries: 1,
	});
	const gapped = applyStreakGap({
		stats: started,
		utcToday: "2026-09-12",
		lastPlayed: null,
		yesterdayPersist: null,
	});
	expect(gapped.currentStreak).toBe(1);
});

test("yesterday already finished leaves streak stored", () => {
	const started = applyDailyFinish({
		stats: emptyStats(),
		result: "won",
		tries: 1,
	});
	const gapped = applyStreakGap({
		stats: started,
		utcToday: "2026-09-10",
		lastPlayed: "2026-09-09",
		yesterdayPersist: {
			status: "won",
			guesses: [{ port: 5173, result: "correct", identified: null }],
		},
	});
	expect(gapped.currentStreak).toBe(1);
});
