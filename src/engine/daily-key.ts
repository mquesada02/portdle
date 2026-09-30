import type { DailyCategory } from "./types";

// The key of a Daily among a device's or an account's records.
export function dailyKey(category: DailyCategory, date: string): string {
	return `${category}|${date}`;
}

export function parseDailyKey(key: string): [DailyCategory, string] {
	const [category, date] = key.split("|") as [DailyCategory, string];
	return [category, date ?? ""];
}
