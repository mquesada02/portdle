import { applyStreakGap, emptyStats } from "../engine/stats";
import type { DailyCategory } from "../engine/types";
import { yesterdayUtc } from "../engine/utc";
import type { Persist } from "../persist/storage";

const CATEGORIES: DailyCategory[] = ["mixed", "protocols", "applications"];

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
	for (const category of CATEGORIES) {
		const gapped = applyStreakGap({
			stats: persist.readStats(category) ?? emptyStats(),
			utcToday,
			lastPlayed: persist.readLastPlayed(category),
			yesterdayPersist: persist.readDaily(category, yesterdayUtc(utcToday)),
		});
		if (!persist.writeStats(category, gapped).ok) {
			ok = false;
		}
	}
	if (!persist.writeLastSeenUtc(utcToday).ok) {
		ok = false;
	}
	return { ok };
}
