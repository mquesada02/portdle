import { catalogFor } from "./catalog";
import type { CatalogEntry, DailyCategory, ScheduleFile } from "./types";
import { utcDayIndex } from "./utc";

export function getDaily(
	category: DailyCategory,
	date: string,
	schedule: ScheduleFile,
	protocols: CatalogEntry[],
	applications: CatalogEntry[],
): CatalogEntry | null {
	const index = utcDayIndex(date, schedule.epoch);
	const cycle = schedule.cycles.find(
		(candidate) =>
			candidate.startDay <= index &&
			index < candidate.startDay + candidate.order.length,
	);
	if (!cycle) {
		return null;
	}
	const id = cycle.order[index - cycle.startDay];
	if (id === undefined) {
		return null;
	}
	const catalog = catalogFor(category, protocols, applications);
	return catalog.find((entry) => entry.id === id) ?? null;
}
