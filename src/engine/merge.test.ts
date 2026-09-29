import { expect, test } from "vitest";
import { replacesBest } from "./blitz";
import {
	foldStats,
	mergeBest,
	mergeBests,
	mergeCodex,
	mergeDaily,
	mergePreference,
	mergeRuns,
} from "./merge";
import { applyDailyFinish, applyStreakGap, emptyStats } from "./stats";
import type {
	BlitzBest,
	BlitzRun,
	CategoryStats,
	CodexMap,
	CodexState,
	DailyPersist,
} from "./types";
import { addUtcDays, yesterdayUtc } from "./utc";

function states(map: CodexMap): Record<string, CodexState> {
	return Object.fromEntries(
		Object.entries(map).map(([id, record]) => [id, record.state]),
	);
}

test("codex: higher state wins per entry", () => {
	const local: CodexMap = {
		a: { state: "identified", fresh: false },
		b: { state: "correct", fresh: false },
		c: { state: "missed", fresh: false },
	};
	const merged = mergeCodex(local, {
		a: "missed",
		b: "identified",
		c: "missed",
	});
	expect(states(merged)).toEqual({ a: "missed", b: "correct", c: "missed" });
});

test("codex: local fresh flag is kept whichever state wins", () => {
	const local: CodexMap = {
		a: { state: "identified", fresh: true },
		b: { state: "correct", fresh: false },
	};
	const merged = mergeCodex(local, { a: "correct", b: "identified" });
	expect(merged.a).toEqual({ state: "correct", fresh: true });
	expect(merged.b).toEqual({ state: "correct", fresh: false });
});

test("codex: an account-only entry arrives not fresh; a local-only entry stays", () => {
	const local: CodexMap = { a: { state: "missed", fresh: true } };
	const merged = mergeCodex(local, { z: "identified" });
	expect(merged).toEqual({
		a: { state: "missed", fresh: true },
		z: { state: "identified", fresh: false },
	});
});

test("codex: commutative on states and idempotent", () => {
	const a: CodexMap = {
		x: { state: "identified", fresh: true },
		y: { state: "correct", fresh: false },
	};
	const b: CodexMap = {
		x: { state: "missed", fresh: false },
		w: { state: "identified", fresh: true },
	};
	const ab = mergeCodex(a, states(b));
	const ba = mergeCodex(b, states(a));
	expect(states(ab)).toEqual(states(ba));
	expect(mergeCodex(ab, states(b))).toEqual(ab);
	expect(mergeCodex(ab, states(ab))).toEqual(ab);
});

test("best: higher score wins", () => {
	expect(mergeBest({ score: 5 }, { score: 7 })).toEqual({ score: 7 });
	expect(mergeBest({ score: 9, timeToScoreMs: 900 }, { score: 7 })).toEqual({
		score: 9,
		timeToScoreMs: 900,
	});
});

test("best: at an equal score the faster time wins", () => {
	expect(
		mergeBest(
			{ score: 5, timeToScoreMs: 2000 },
			{ score: 5, timeToScoreMs: 1500 },
		),
	).toEqual({ score: 5, timeToScoreMs: 1500 });
});

test("best: a timed Best beats an untimed Best at an equal score", () => {
	expect(mergeBest({ score: 5 }, { score: 5, timeToScoreMs: 4000 })).toEqual({
		score: 5,
		timeToScoreMs: 4000,
	});
});

test("best: two untimed or two equally timed Bests are equal", () => {
	expect(mergeBest({ score: 5 }, { score: 5 })).toEqual({ score: 5 });
	expect(
		mergeBest({ score: 5, timeToScoreMs: 10 }, { score: 5, timeToScoreMs: 10 }),
	).toEqual({ score: 5, timeToScoreMs: 10 });
});

test("best: a missing side gives the other side", () => {
	expect(mergeBest(undefined, { score: 3 })).toEqual({ score: 3 });
	expect(mergeBest({ score: 3 }, undefined)).toEqual({ score: 3 });
	expect(mergeBest(undefined, undefined)).toBeUndefined();
});

const BEST_CASES: Array<BlitzBest | undefined> = [
	undefined,
	{ score: 4 },
	{ score: 5 },
	{ score: 5, timeToScoreMs: 100 },
	{ score: 5, timeToScoreMs: 200 },
	{ score: 6, timeToScoreMs: 900 },
];

test("best: commutative and idempotent over the cases", () => {
	for (const a of BEST_CASES) {
		for (const b of BEST_CASES) {
			const ab = mergeBest(a, b);
			expect(ab).toEqual(mergeBest(b, a));
			expect(mergeBest(ab, b)).toEqual(ab);
			expect(mergeBest(ab, a)).toEqual(ab);
		}
	}
});

test("best: agrees with replacesBest for a new timed run", () => {
	for (const best of BEST_CASES) {
		for (const run of [
			{ score: 5, timeToScoreMs: 100 },
			{ score: 5, timeToScoreMs: 150 },
			{ score: 6, timeToScoreMs: 50 },
			{ score: 3, timeToScoreMs: 10 },
		]) {
			const replaced = replacesBest({
				best,
				score: run.score,
				timeToScoreMs: run.timeToScoreMs,
			});
			expect(mergeBest(best, run)).toEqual(replaced ? run : best);
		}
	}
});

test("bests: merged over the union of keys", () => {
	const a = {
		"mixed|default|sprint": { score: 3 },
		"protocols|default|sprint": { score: 8, timeToScoreMs: 100 },
	};
	const b = {
		"mixed|default|sprint": { score: 4 },
		"applications|inverted|survival": { score: 2 },
	};
	const merged = mergeBests(a, b);
	expect(merged).toEqual({
		"mixed|default|sprint": { score: 4 },
		"protocols|default|sprint": { score: 8, timeToScoreMs: 100 },
		"applications|inverted|survival": { score: 2 },
	});
	expect(mergeBests(b, a)).toEqual(merged);
	expect(mergeBests(merged, a)).toEqual(merged);
});

function run(endedAt: string, score = 1): BlitzRun {
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

test("runs: union by endedAt, newest first", () => {
	const a = [run("2026-09-03T00:00:00.000Z"), run("2026-09-01T00:00:00.000Z")];
	const b = [run("2026-09-04T00:00:00.000Z"), run("2026-09-01T00:00:00.000Z")];
	expect(mergeRuns(a, b).map((r) => r.endedAt)).toEqual([
		"2026-09-04T00:00:00.000Z",
		"2026-09-03T00:00:00.000Z",
		"2026-09-01T00:00:00.000Z",
	]);
});

test("runs: keeps the newest 50", () => {
	const day = (n: number) =>
		`2026-08-${String(n).padStart(2, "0")}T00:00:00.000Z`;
	const a = Array.from({ length: 30 }, (_, i) => run(day(30 - i)));
	const b = Array.from({ length: 30 }, (_, i) =>
		run(`2026-09-${String(30 - i).padStart(2, "0")}T00:00:00.000Z`),
	);
	const merged = mergeRuns(a, b);
	expect(merged).toHaveLength(50);
	expect(merged[0]?.endedAt).toBe("2026-09-30T00:00:00.000Z");
	expect(merged[49]?.endedAt).toBe(day(11));
});

test("runs: a shared endedAt with different copies resolves the same either way", () => {
	const a = [run("2026-09-01T00:00:00.000Z", 3)];
	const b = [run("2026-09-01T00:00:00.000Z", 9)];
	expect(mergeRuns(a, b)).toEqual(mergeRuns(b, a));
	expect(mergeRuns(a, b)).toHaveLength(1);
});

test("runs: commutative and idempotent", () => {
	const a = [run("2026-09-03T00:00:00.000Z"), run("2026-09-01T00:00:00.000Z")];
	const b = [run("2026-09-04T00:00:00.000Z"), run("2026-09-02T00:00:00.000Z")];
	const ab = mergeRuns(a, b);
	expect(ab).toEqual(mergeRuns(b, a));
	expect(mergeRuns(ab, b)).toEqual(ab);
	expect(mergeRuns(ab, ab)).toEqual(ab);
});

function guess(port: number, result: "correct" | "miss") {
	return { port, result, identified: null };
}

function daily(status: DailyPersist["status"], ports: number[]): DailyPersist {
	return {
		status,
		guesses: ports.map((port, i) =>
			guess(
				port,
				status === "won" && i === ports.length - 1 ? "correct" : "miss",
			),
		),
	};
}

test("daily: finished beats unfinished", () => {
	const playing = daily("playing", [1, 2, 3, 4, 5]);
	const lost = daily("lost", [1, 2, 3, 4, 5, 6]);
	expect(mergeDaily(playing, lost)).toEqual(lost);
});

test("daily: won beats lost", () => {
	const won = daily("won", [1, 2, 3, 4, 5, 6]);
	const lost = daily("lost", [7, 8, 9, 10, 11, 12]);
	expect(mergeDaily(lost, won)).toEqual(won);
});

test("daily: between two wins, fewer tries wins", () => {
	const quick = daily("won", [1, 2]);
	const slow = daily("won", [3, 4, 5, 6]);
	expect(mergeDaily(slow, quick)).toEqual(quick);
});

test("daily: between two unfinished, more tries wins", () => {
	const few = daily("playing", [1]);
	const many = daily("playing", [2, 3, 4]);
	expect(mergeDaily(few, many)).toEqual(many);
});

test("daily: exact ties, two losses included, break by guess text", () => {
	const cases: Array<[DailyPersist, DailyPersist]> = [
		[daily("lost", [1, 2, 3, 4, 5, 6]), daily("lost", [6, 5, 4, 3, 2, 1])],
		[daily("won", [1, 2]), daily("won", [3, 4])],
		[daily("playing", [1, 2]), daily("playing", [3, 4])],
	];
	for (const [a, b] of cases) {
		expect(mergeDaily(a, b)).toEqual(mergeDaily(b, a));
	}
});

test("daily: two losses tie on tries whatever the guess count", () => {
	const a = daily("lost", [1, 2, 3, 4, 5, 6]);
	const b = daily("lost", [9, 8]);
	expect(mergeDaily(a, b)).toEqual(mergeDaily(b, a));
	expect(mergeDaily(a, b)).toEqual(a);
});

test("daily: two wins with equal tries break by guess text", () => {
	const a = daily("won", [5, 6]);
	const b = daily("won", [1, 2]);
	expect(mergeDaily(a, b)).toEqual(b);
	expect(mergeDaily(b, a)).toEqual(b);
});

test("daily: commutative and idempotent over the cases", () => {
	const cases = [
		daily("playing", [1]),
		daily("playing", [1, 2]),
		daily("playing", [3, 4]),
		daily("won", [1, 2]),
		daily("won", [3, 4]),
		daily("won", [1, 2, 3]),
		daily("lost", [1, 2, 3, 4, 5, 6]),
		daily("lost", [6, 5, 4, 3, 2, 1]),
	];
	for (const a of cases) {
		for (const b of cases) {
			const ab = mergeDaily(a, b);
			expect(ab).toEqual(mergeDaily(b, a));
			expect(mergeDaily(ab, a)).toEqual(ab);
			expect(mergeDaily(ab, b)).toEqual(ab);
		}
	}
});

test("preference: the later stamp wins", () => {
	const older = { value: "dark", at: "2026-09-29T10:00:00.000000+00:00" };
	const newer = { value: "light", at: "2026-09-29T11:00:00.000000+00:00" };
	expect(mergePreference(older, newer)).toEqual(newer);
	expect(mergePreference(newer, older)).toEqual(newer);
});

test("preference: stamps compare as instants, not text", () => {
	const a = { value: true, at: "2026-09-29T10:00:00Z" };
	const b = { value: false, at: "2026-09-29T09:30:00+00:00" };
	expect(mergePreference(a, b)).toEqual(a);
	expect(mergePreference(b, a)).toEqual(a);
});

test("preference: an equal stamp breaks deterministically", () => {
	const at = "2026-09-29T10:00:00.000Z";
	const a = { value: "name", at };
	const b = { value: "port", at };
	expect(mergePreference(a, b)).toEqual(mergePreference(b, a));
	const z = { value: "port", at: "2026-09-29T10:00:00Z" };
	const p = { value: "port", at: "2026-09-29T10:00:00.000Z" };
	expect(mergePreference(z, p)).toEqual(mergePreference(p, z));
});

test("preference: idempotent", () => {
	const a = { value: "dark", at: "2026-09-29T10:00:00.000Z" };
	const b = { value: "light", at: "2026-09-29T11:00:00.000Z" };
	const ab = mergePreference(a, b);
	expect(mergePreference(ab, a)).toEqual(ab);
	expect(mergePreference(ab, b)).toEqual(ab);
});

// The incremental path, as the Daily screen and the UTC-day change run it.
// It deliberately mirrors the fold's steps with the same stats functions, day by day.
function incremental(
	days: Array<[string, DailyPersist]>,
	utcToday: string,
): { stats: CategoryStats; lastPlayed: string | null } {
	const stored = new Map<string, DailyPersist>(days);
	let stats = emptyStats();
	let lastPlayed: string | null = null;
	for (const [date, value] of [...days].sort(([a], [b]) => (a < b ? -1 : 1))) {
		if (value.status === "playing") {
			continue;
		}
		stats = applyStreakGap({
			stats,
			utcToday: date,
			lastPlayed,
			yesterdayPersist: stored.get(yesterdayUtc(date)) ?? null,
		});
		stats = applyDailyFinish({
			stats,
			result: value.status,
			tries: value.guesses.length,
		});
		lastPlayed = date;
	}
	if (lastPlayed !== utcToday) {
		stats = applyStreakGap({
			stats,
			utcToday,
			lastPlayed,
			yesterdayPersist: stored.get(yesterdayUtc(utcToday)) ?? null,
		});
	}
	return { stats, lastPlayed };
}

const D1 = "2026-09-10";
const won = (tries: number) =>
	daily(
		"won",
		Array.from({ length: tries }, (_, i) => 100 + i),
	);
const lost = () => daily("lost", [1, 2, 3, 4, 5, 6]);
const playing = () => daily("playing", [1, 2]);

function expectFold(days: Array<[string, DailyPersist]>, utcToday: string) {
	const folded = foldStats({ dailies: Object.fromEntries(days), utcToday });
	expect(folded).toEqual(incremental(days, utcToday));
	return folded;
}

test("fold: no finished Daily gives empty stats and no last played", () => {
	expect(foldStats({ dailies: {}, utcToday: D1 })).toEqual({
		stats: emptyStats(),
		lastPlayed: null,
	});
	expect(foldStats({ dailies: { [D1]: playing() }, utcToday: D1 })).toEqual({
		stats: emptyStats(),
		lastPlayed: null,
	});
});

test("fold: consecutive wins build a streak and histogram", () => {
	const folded = expectFold(
		[
			[D1, won(3)],
			[addUtcDays(D1, 1), won(1)],
			[addUtcDays(D1, 2), won(3)],
		],
		addUtcDays(D1, 2),
	);
	expect(folded.stats.currentStreak).toBe(3);
	expect(folded.stats.histogram).toEqual([1, 0, 2, 0, 0, 0]);
	expect(folded.lastPlayed).toBe(addUtcDays(D1, 2));
});

test("fold: a skipped day resets the streak before the next win", () => {
	const folded = expectFold(
		[
			[D1, won(2)],
			[addUtcDays(D1, 2), won(2)],
		],
		addUtcDays(D1, 2),
	);
	expect(folded.stats.currentStreak).toBe(1);
	expect(folded.stats.bestStreak).toBe(1);
});

test("fold: a loss resets the streak", () => {
	const folded = expectFold(
		[
			[D1, won(2)],
			[addUtcDays(D1, 1), lost()],
		],
		addUtcDays(D1, 1),
	);
	expect(folded.stats.currentStreak).toBe(0);
	expect(folded.stats.played).toBe(2);
});

test("fold: a win after an unfinished yesterday restarts at 1", () => {
	const folded = expectFold(
		[
			[D1, won(2)],
			[addUtcDays(D1, 1), playing()],
			[addUtcDays(D1, 2), won(2)],
		],
		addUtcDays(D1, 2),
	);
	expect(folded.stats.currentStreak).toBe(1);
});

test("fold: a win today with yesterday unfinished gives a streak of 1", () => {
	const today = addUtcDays(D1, 1);
	const folded = expectFold(
		[
			[D1, playing()],
			[today, won(4)],
		],
		today,
	);
	expect(folded.stats.currentStreak).toBe(1);
});

test("fold: a later current day keeps the streak when yesterday was won", () => {
	const folded = expectFold([[D1, won(2)]], addUtcDays(D1, 1));
	expect(folded.stats.currentStreak).toBe(1);
});

test("fold: a later current day resets when last played is older than yesterday", () => {
	const folded = expectFold([[D1, won(2)]], addUtcDays(D1, 2));
	expect(folded.stats.currentStreak).toBe(0);
	expect(folded.stats.bestStreak).toBe(1);
});

test("fold: an unfinished yesterday resets at the day change", () => {
	const yesterday = addUtcDays(D1, 1);
	const folded = expectFold(
		[
			[D1, won(2)],
			[yesterday, playing()],
		],
		addUtcDays(D1, 2),
	);
	expect(folded.stats.currentStreak).toBe(0);
});

test("fold: an unfinished Daily today changes nothing", () => {
	const today = addUtcDays(D1, 1);
	const folded = expectFold(
		[
			[D1, won(2)],
			[today, playing()],
		],
		today,
	);
	expect(folded.stats.currentStreak).toBe(1);
});

test("fold: gives the same result whatever order the Dailies are supplied in", () => {
	const days: Array<[string, DailyPersist]> = [
		[D1, won(2)],
		[addUtcDays(D1, 1), lost()],
		[addUtcDays(D1, 2), won(5)],
	];
	const utcToday = addUtcDays(D1, 3);
	const forward = foldStats({ dailies: Object.fromEntries(days), utcToday });
	const backward = foldStats({
		dailies: Object.fromEntries([...days].reverse()),
		utcToday,
	});
	expect(backward).toEqual(forward);
});
