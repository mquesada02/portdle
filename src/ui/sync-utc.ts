import { applyStreakGap, emptyStats } from "../engine/stats";
import { DAILY_CATEGORIES, type DailyCategory } from "../engine/types";
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

export function syncUtcDay(
	persist: Persist,
	utcToday: string,
): { ok: boolean } {
	const lastSeen = persist.readLastSeenUtc();
	if (lastSeen === null) {
		return persist.writeLastSeenUtc(utcToday);
	}
	if (lastSeen >= utcToday) {
		return { ok: true };
	}
	let ok = true;
	for (const category of DAILY_CATEGORIES) {
		if (
			persist.readStats(category) === null &&
			persist.readLastPlayed(category) === null
		) {
			continue;
		}
		if (
			!persist.writeStats(
				category,
				categoryStreakGap(persist, category, utcToday),
			).ok
		) {
			ok = false;
		}
	}
	if (!persist.writeLastSeenUtc(utcToday).ok) {
		ok = false;
	}
	return { ok };
}
