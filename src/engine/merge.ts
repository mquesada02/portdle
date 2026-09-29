import { MAX_BLITZ_RUNS } from "./blitz";
import { RANK } from "./codex";
import { applyDailyFinish, applyStreakGap, emptyStats } from "./stats";
import type {
	BlitzBest,
	BlitzBests,
	BlitzBestsKey,
	BlitzRun,
	CategoryStats,
	CodexMap,
	CodexState,
	DailyPersist,
} from "./types";
import { yesterdayUtc } from "./utc";

export function mergeCodex(
	local: CodexMap,
	account: Record<string, CodexState>,
): CodexMap {
	const merged: CodexMap = { ...local };
	for (const [id, state] of Object.entries(account)) {
		const current = merged[id];
		if (!current) {
			merged[id] = { state, fresh: false };
		} else if (RANK[state] > RANK[current.state]) {
			merged[id] = { state, fresh: current.fresh };
		}
	}
	return merged;
}

export function mergeBest(
	a: BlitzBest | undefined,
	b: BlitzBest | undefined,
): BlitzBest | undefined {
	if (a === undefined || b === undefined) {
		return a ?? b;
	}
	if (a.score !== b.score) {
		return a.score > b.score ? a : b;
	}
	if (a.timeToScoreMs === undefined) {
		return b;
	}
	if (b.timeToScoreMs === undefined) {
		return a;
	}
	return b.timeToScoreMs < a.timeToScoreMs ? b : a;
}

export function mergeBests(a: BlitzBests, b: BlitzBests): BlitzBests {
	const merged: BlitzBests = {};
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const key of keys as Set<BlitzBestsKey>) {
		const best = mergeBest(a[key], b[key]);
		if (best) {
			merged[key] = best;
		}
	}
	return merged;
}

export function mergeRuns(a: BlitzRun[], b: BlitzRun[]): BlitzRun[] {
	const byEndedAt = new Map<string, BlitzRun>();
	for (const run of [...a, ...b]) {
		const seen = byEndedAt.get(run.endedAt);
		if (!seen || JSON.stringify(run) < JSON.stringify(seen)) {
			byEndedAt.set(run.endedAt, run);
		}
	}
	return [...byEndedAt.values()]
		.sort((x, y) =>
			x.endedAt < y.endedAt ? 1 : x.endedAt > y.endedAt ? -1 : 0,
		)
		.slice(0, MAX_BLITZ_RUNS);
}

function dailyBeats(a: DailyPersist, b: DailyPersist): boolean {
	const aDone = a.status !== "playing";
	const bDone = b.status !== "playing";
	if (aDone !== bDone) {
		return aDone;
	}
	if (aDone && a.status !== b.status) {
		return a.status === "won";
	}
	if (a.guesses.length !== b.guesses.length && a.status !== "lost") {
		return a.status === "won"
			? a.guesses.length < b.guesses.length
			: a.guesses.length > b.guesses.length;
	}
	return JSON.stringify(a.guesses) < JSON.stringify(b.guesses);
}

export function mergeDaily(a: DailyPersist, b: DailyPersist): DailyPersist {
	return dailyBeats(b, a) ? b : a;
}

export type Stamped<T> = { value: T; at: string };

export function mergePreference<T>(a: Stamped<T>, b: Stamped<T>): Stamped<T> {
	const aMs = Date.parse(a.at);
	const bMs = Date.parse(b.at);
	if (aMs !== bMs) {
		return aMs > bMs ? a : b;
	}
	const aText = JSON.stringify(a.value);
	const bText = JSON.stringify(b.value);
	if (aText !== bText) {
		return aText < bText ? a : b;
	}
	return a.at <= b.at ? a : b;
}

export function foldStats(input: {
	dailies: Record<string, DailyPersist>;
	utcToday: string;
}): { stats: CategoryStats; lastPlayed: string | null } {
	const { dailies, utcToday } = input;
	let stats = emptyStats();
	let lastPlayed: string | null = null;
	for (const date of Object.keys(dailies).sort()) {
		const daily = dailies[date];
		if (!daily || daily.status === "playing") {
			continue;
		}
		stats = applyDailyFinish({
			stats: applyStreakGap({
				stats,
				utcToday: date,
				lastPlayed,
				yesterdayPersist: dailies[yesterdayUtc(date)] ?? null,
			}),
			result: daily.status,
			tries: daily.guesses.length,
		});
		lastPlayed = date;
	}
	if (lastPlayed !== utcToday) {
		stats = applyStreakGap({
			stats,
			utcToday,
			lastPlayed,
			yesterdayPersist: dailies[yesterdayUtc(utcToday)] ?? null,
		});
	}
	return { stats, lastPlayed };
}
