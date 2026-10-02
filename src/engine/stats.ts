import type { CategoryStats, DailyPersist } from "./types";
import { addUtcDays, yesterdayUtc } from "./utc";

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

// Folds one category's saved Dailies into its stats at the server's today.
// A finished record counts in the totals, late or not. Only on-day records
// count for streaks: any other day (no record, unfinished, lost, or late
// only) ends a run. Today's unfinished Daily does not break the current
// streak. Records after the server's today are ignored.
export function foldStats(input: {
	dailies: Record<string, DailyPersist>;
	serverToday: string;
}): CategoryStats {
	const { dailies, serverToday } = input;
	const stats = emptyStats();
	const winDays = new Set<string>();
	for (const date of Object.keys(dailies).sort()) {
		const daily = dailies[date];
		if (!daily || date > serverToday || daily.status === "playing") {
			continue;
		}
		stats.played += 1;
		if (daily.status === "won") {
			stats.wins += 1;
			const bucket = daily.guesses.length - 1;
			if (bucket >= 0 && bucket < stats.histogram.length) {
				stats.histogram[bucket] = (stats.histogram[bucket] ?? 0) + 1;
			}
			if (daily.late !== true) {
				winDays.add(date);
			}
		}
	}
	let run = 0;
	let previous: string | null = null;
	for (const date of [...winDays].sort()) {
		run = previous !== null && addUtcDays(previous, 1) === date ? run + 1 : 1;
		stats.bestStreak = Math.max(stats.bestStreak, run);
		previous = date;
	}
	const today = dailies[serverToday];
	const lostToday = today?.status === "lost" && today.late !== true;
	if (!lostToday) {
		let day = winDays.has(serverToday)
			? serverToday
			: yesterdayUtc(serverToday);
		while (winDays.has(day)) {
			stats.currentStreak += 1;
			day = yesterdayUtc(day);
		}
	}
	return stats;
}
