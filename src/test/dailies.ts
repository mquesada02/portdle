import applicationsJson from "../catalogs/applications.json";
import protocolsJson from "../catalogs/protocols.json";
import applicationsScheduleJson from "../catalogs/schedules/applications.json";
import mixedScheduleJson from "../catalogs/schedules/mixed.json";
import protocolsScheduleJson from "../catalogs/schedules/protocols.json";
import { getDaily } from "../engine/daily";
import { digitLength } from "../engine/guess";
import {
	type CatalogEntry,
	DAILY_CATEGORIES,
	type DailyCategory,
	type ScheduleFile,
	type ScheduleRow,
} from "../engine/types";
import { addUtcDays } from "../engine/utc";
import type { Catalog } from "../remote/remote";

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

// What the fake `Remote` serves by default, taken from the committed files.
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
