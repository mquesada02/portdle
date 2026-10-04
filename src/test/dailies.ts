import { getDaily } from "../engine/daily";
import { digitLength } from "../engine/guess";
import {
	type CatalogEntry,
	DAILY_CATEGORIES,
	type DailyCategory,
	type DailyPersist,
	type ScheduleFile,
	type ScheduleRow,
} from "../engine/types";
import { addUtcDays } from "../engine/utc";
import type { Persist } from "../persist/storage";
import type { Catalog } from "../remote/remote";
import applicationsJson from "./fixtures/applications.json";
import protocolsJson from "./fixtures/protocols.json";
import applicationsScheduleJson from "./fixtures/schedules/applications.json";
import mixedScheduleJson from "./fixtures/schedules/mixed.json";
import protocolsScheduleJson from "./fixtures/schedules/protocols.json";

export const UTC_TODAY = "2026-09-09";

const protocols = protocolsJson as CatalogEntry[];
const applications = applicationsJson as CatalogEntry[];
const schedules: Record<DailyCategory, ScheduleFile> = {
	mixed: mixedScheduleJson as ScheduleFile,
	protocols: protocolsScheduleJson as ScheduleFile,
	applications: applicationsScheduleJson as ScheduleFile,
};

export function dailyOn(category: DailyCategory, date = UTC_TODAY) {
	const entry = getDaily(
		category,
		date,
		schedules[category],
		protocols,
		applications,
	);
	if (!entry) {
		throw new Error(`missing ${category} daily for ${date}`);
	}
	return entry;
}

// What the fake `Remote` serves by default, taken from the frozen fixture files.
export function fixtureCatalog(): Catalog {
	return { protocols, applications };
}

export function fixtureEntryIds(date: string): Record<DailyCategory, string> {
	return Object.fromEntries(
		DAILY_CATEGORIES.map((category) => [category, dailyOn(category, date).id]),
	) as Record<DailyCategory, string>;
}

// Every Schedule row from the epoch through `upTo`.
export function fixtureScheduleRows(upTo: string): ScheduleRow[] {
	const rows: ScheduleRow[] = [];
	for (let date = "2026-09-09"; date <= upTo; date = addUtcDays(date, 1)) {
		for (const category of DAILY_CATEGORIES) {
			rows.push({ category, date, entryId: dailyOn(category, date).id });
		}
	}
	return rows;
}

export function padToAnswer(port: number, answer: CatalogEntry): string {
	return String(port).padStart(digitLength(answer.port), "0");
}

// Every Daily category served by one entry.
export function sameEntry(id: string): Record<DailyCategory, string> {
	return { mixed: id, protocols: id, applications: id };
}

// Saves a Daily record of `tries` missed guesses; `extra` adds or overrides
// record fields such as `late` or the guesses themselves.
export function saveDaily(
	persist: Persist,
	category: DailyCategory,
	date: string,
	status: DailyPersist["status"],
	tries: number,
	extra: Partial<DailyPersist> = {},
) {
	persist.writeDaily(category, date, {
		status,
		guesses: Array.from({ length: tries }, (_, index) => ({
			port: index + 1,
			result: "miss" as const,
			identified: null,
		})),
		...extra,
	});
}
