import type { CategoryStats, DailyPersist } from "./types";
import { yesterdayUtc } from "./utc";

export function emptyStats(): CategoryStats {
	return {
		currentStreak: 0,
		bestStreak: 0,
		played: 0,
		wins: 0,
		histogram: [0, 0, 0, 0, 0, 0],
	};
}

export function winPercent(stats: CategoryStats): number {
	return stats.played === 0 ? 0 : stats.wins / stats.played;
}

export function applyStreakGap(input: {
	stats: CategoryStats;
	utcToday: string;
	lastPlayed: string | null;
	yesterdayPersist: DailyPersist | null;
}): CategoryStats {
	const { stats, utcToday, lastPlayed, yesterdayPersist } = input;
	if (yesterdayPersist?.status === "playing") {
		return { ...stats, currentStreak: 0 };
	}
	if (lastPlayed === null) {
		return stats;
	}
	if (lastPlayed < yesterdayUtc(utcToday)) {
		return { ...stats, currentStreak: 0 };
	}
	return stats;
}

export function applyDailyFinish(input: {
	stats: CategoryStats;
	result: "won" | "lost";
	tries: number;
}): CategoryStats {
	const histogram: CategoryStats["histogram"] = [...input.stats.histogram];
	if (input.result === "won") {
		const bucket = input.tries - 1;
		if (bucket >= 0 && bucket < histogram.length) {
			histogram[bucket] = (histogram[bucket] ?? 0) + 1;
		}
		const currentStreak = input.stats.currentStreak + 1;
		return {
			played: input.stats.played + 1,
			wins: input.stats.wins + 1,
			currentStreak,
			bestStreak: Math.max(input.stats.bestStreak, currentStreak),
			histogram,
		};
	}
	return {
		played: input.stats.played + 1,
		wins: input.stats.wins,
		currentStreak: 0,
		bestStreak: input.stats.bestStreak,
		histogram,
	};
}
