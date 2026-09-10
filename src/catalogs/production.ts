import type {
	CatalogEntry,
	DailyCategory,
	ScheduleFile,
} from "../engine/types";
import applicationsJson from "./applications.json";
import protocolsJson from "./protocols.json";
import applicationsScheduleJson from "./schedules/applications.json";
import mixedScheduleJson from "./schedules/mixed.json";
import protocolsScheduleJson from "./schedules/protocols.json";

export const protocols = protocolsJson as CatalogEntry[];
export const applications = applicationsJson as CatalogEntry[];
export const schedules: Record<DailyCategory, ScheduleFile> = {
	mixed: mixedScheduleJson as ScheduleFile,
	protocols: protocolsScheduleJson as ScheduleFile,
	applications: applicationsScheduleJson as ScheduleFile,
};
