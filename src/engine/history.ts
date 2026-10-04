import { newestFirst } from "./archive";
import type {
	BlitzRun,
	CatalogEntry,
	DailyCategory,
	DailyPersist,
	ScheduleRow,
} from "./types";

export type HistoryRow = {
	date: string;
	category: DailyCategory;
	status: DailyPersist["status"];
	tries: number;
	// Absent until the Schedule row and the catalog entry are known.
	name?: string;
	port?: number;
};

export type SavedDaily = Pick<
	HistoryRow,
	"date" | "category" | "status" | "tries"
>;

// The player's finished Dailies, newest first, each with the answer's name and
// port when the Schedule has its row and the whole catalog has the entry.
export function historyRows(input: {
	saved: SavedDaily[];
	schedule: ScheduleRow[];
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
}): HistoryRow[] {
	const entries = new Map(
		[...input.protocols, ...input.applications].map((entry) => [
			entry.id,
			entry,
		]),
	);
	const entryIds = new Map(
		input.schedule.map((row) => [`${row.category}|${row.date}`, row.entryId]),
	);
	return input.saved
		.filter(({ status }) => status === "won" || status === "lost")
		.sort(newestFirst)
		.map((row) => {
			const id = entryIds.get(`${row.category}|${row.date}`);
			const entry = id === undefined ? undefined : entries.get(id);
			return entry ? { ...row, name: entry.name, port: entry.port } : row;
		});
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
