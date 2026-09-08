import applicationsJson from "../catalogs/applications.json";
import protocolsJson from "../catalogs/protocols.json";
import applicationsScheduleJson from "../catalogs/schedules/applications.json";
import mixedScheduleJson from "../catalogs/schedules/mixed.json";
import protocolsScheduleJson from "../catalogs/schedules/protocols.json";
import { getDaily } from "../engine/daily";
import { digitLength } from "../engine/guess";
import type {
	CatalogEntry,
	DailyCategory,
	ScheduleFile,
} from "../engine/types";

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

export function padToAnswer(port: number, answer: CatalogEntry): string {
	return String(port).padStart(digitLength(answer.port), "0");
}
