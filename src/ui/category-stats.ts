import { foldStats } from "../engine/stats";
import type {
	CategoryStats,
	DailyCategory,
	DailyPersist,
} from "../engine/types";
import type { Persist } from "../persist/storage";

// One category's stats, folded from its saved Dailies at the server's today.
export function categoryStats(
	persist: Persist,
	category: DailyCategory,
	serverToday: string,
): CategoryStats {
	const dailies: Record<string, DailyPersist> = {};
	for (const date of persist.listDailyDates(category)) {
		const daily = persist.readDaily(category, date);
		if (daily) {
			dailies[date] = daily;
		}
	}
	return foldStats({ dailies, serverToday });
}
