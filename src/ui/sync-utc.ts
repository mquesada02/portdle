import { applyStreakGap, emptyStats } from "../engine/stats";
import type { DailyCategory } from "../engine/types";
import { yesterdayUtc } from "../engine/utc";
import type { Persist } from "../persist/storage";

export function categoryStreakGap(
	persist: Persist,
	category: DailyCategory,
	utcToday: string,
) {
	return applyStreakGap({
		stats: persist.readStats(category) ?? emptyStats(),
		utcToday,
		lastPlayed: persist.readLastPlayed(category),
		yesterdayPersist: persist.readDaily(category, yesterdayUtc(utcToday)),
	});
}
