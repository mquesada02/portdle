import { getDaily } from "./daily";
import type {
	BlitzRun,
	CatalogEntry,
	DailyCategory,
	ScheduleFile,
} from "./types";
import { DAILY_CATEGORIES } from "./types";
import { addUtcDays } from "./utc";

export type HistoryRow = {
	date: string;
	category: DailyCategory;
	name: string;
	port: number;
};

export function historyRows(input: {
	utcToday: string;
	schedules: Record<DailyCategory, ScheduleFile>;
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
	finishedToday: Record<DailyCategory, boolean>;
}): HistoryRow[] {
	const rows: HistoryRow[] = [];
	for (const category of DAILY_CATEGORIES) {
		const schedule = input.schedules[category];
		for (const cycle of schedule.cycles) {
			for (let offset = 0; offset < cycle.order.length; offset++) {
				const date = addUtcDays(schedule.epoch, cycle.startDay + offset);
				if (date > input.utcToday) {
					continue;
				}
				if (date === input.utcToday && !input.finishedToday[category]) {
					continue;
				}
				const entry = getDaily(
					category,
					date,
					schedule,
					input.protocols,
					input.applications,
				);
				if (!entry) {
					continue;
				}
				rows.push({
					date,
					category,
					name: entry.name,
					port: entry.port,
				});
			}
		}
	}
	rows.sort((a, b) => {
		if (a.date !== b.date) {
			return a.date < b.date ? 1 : -1;
		}
		return (
			DAILY_CATEGORIES.indexOf(a.category) -
			DAILY_CATEGORIES.indexOf(b.category)
		);
	});
	return rows;
}

export type BlitzRunGroup = { date: string; runs: BlitzRun[] };

export function groupBlitzRunsByDate(
	runs: BlitzRun[],
	localDate: (endedAt: string) => string,
): BlitzRunGroup[] {
	const groups: BlitzRunGroup[] = [];
	for (const run of runs) {
		const date = localDate(run.endedAt);
		const current = groups.at(-1);
		if (current && current.date === date) {
			current.runs.push(run);
		} else {
			groups.push({ date, runs: [run] });
		}
	}
	return groups;
}
