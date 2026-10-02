import type {
	BlitzRun,
	CatalogEntry,
	DailyCategory,
	DailyPersist,
	ScheduleRow,
} from "./types";
import { DAILY_CATEGORIES } from "./types";

export type HistoryRow = {
	date: string;
	category: DailyCategory;
	name: string;
	port: number;
};

export function historyRows(input: {
	utcToday: string;
	schedule: ScheduleRow[];
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
	finishedToday: Record<DailyCategory, boolean>;
}): HistoryRow[] {
	const rows: HistoryRow[] = [];
	const entries = new Map(
		[...input.protocols, ...input.applications].map((entry) => [
			entry.id,
			entry,
		]),
	);
	for (const { category, date, entryId } of input.schedule) {
		if (date > input.utcToday) {
			continue;
		}
		if (date === input.utcToday && !input.finishedToday[category]) {
			continue;
		}
		const entry = entries.get(entryId);
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
	rows.sort(newestFirst);
	return rows;
}

// Newest date first, then the category order.
function newestFirst(
	a: { date: string; category: DailyCategory },
	b: { date: string; category: DailyCategory },
): number {
	if (a.date !== b.date) {
		return a.date < b.date ? 1 : -1;
	}
	return (
		DAILY_CATEGORIES.indexOf(a.category) - DAILY_CATEGORIES.indexOf(b.category)
	);
}

export type SavedDaily = {
	date: string;
	category: DailyCategory;
	status: DailyPersist["status"];
};

// The player's finished Dailies as saved on the device, for History while the
// server reads that name them have not succeeded.
export function savedFinishedRows(
	saved: SavedDaily[],
): Pick<HistoryRow, "date" | "category">[] {
	return saved
		.filter(({ status }) => status === "won" || status === "lost")
		.map(({ date, category }) => ({ date, category }))
		.sort(newestFirst);
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
