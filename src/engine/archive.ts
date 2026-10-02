import { PUZZLE_EPOCH } from "./puzzle-number";
import {
	DAILY_CATEGORIES,
	type DailyCategory,
	type DailyPersist,
	type ScheduleRow,
} from "./types";

// What a screen shows of a Daily the player has saved.
export type DailyResult = {
	status: DailyPersist["status"];
	tries: number;
};

// A day that can have a board: from the first Daily through server today.
export function isArchiveDay(date: string, serverToday: string): boolean {
	return date >= PUZZLE_EPOCH && date <= serverToday;
}

// Newest day first, then the category order.
export function newestFirst(
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

// The Archive list: every Schedule row from the first Daily to the day before
// server today.
export function archiveRows(
	schedule: ScheduleRow[],
	serverToday: string,
): ScheduleRow[] {
	return schedule
		.filter(({ date }) => isArchiveDay(date, serverToday) && date < serverToday)
		.sort(newestFirst);
}

// The entry id of a board's Daily, or null when that day has no board.
export function boardEntryId(
	schedule: ScheduleRow[],
	category: DailyCategory,
	date: string,
	serverToday: string,
): string | null {
	if (!isArchiveDay(date, serverToday)) {
		return null;
	}
	return (
		schedule.find((row) => row.category === category && row.date === date)
			?.entryId ?? null
	);
}

// How a Daily reads on the Archive and in History.
export function resultLabel(result: DailyResult | null): string {
	if (result?.status === "won") {
		return `Won ${result.tries}/6`;
	}
	if (result?.status === "lost") {
		return "Lost";
	}
	if (result?.status === "playing" && result.tries > 0) {
		return `In progress ${result.tries}/6`;
	}
	return "Not played";
}
