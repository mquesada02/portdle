import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	checkSchedules,
	type FrozenIdentity,
	generateSchedules,
	SCHEDULE_EPOCH,
	validateFrozenIdentity,
	validateSchedules,
} from "../src/engine/schedule-gen.ts";
import type {
	CatalogEntry,
	DailyCategory,
	ScheduleFile,
} from "../src/engine/types.ts";
import { utcDateString } from "../src/engine/utc.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogsDir = join(root, "src/catalogs");
const schedulesDir = join(catalogsDir, "schedules");
const emptySchedule: ScheduleFile = { epoch: SCHEDULE_EPOCH, cycles: [] };

function readJson<T>(path: string, fallback: T): T {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return fallback;
	}
}

function writePretty(path: string, value: unknown): void {
	writeFileSync(path, `${JSON.stringify(value, null, "\t")}\n`);
}

const protocols = readJson<CatalogEntry[]>(
	join(catalogsDir, "protocols.json"),
	[],
);
const applications = readJson<CatalogEntry[]>(
	join(catalogsDir, "applications.json"),
	[],
);
const current: Record<DailyCategory, ScheduleFile> = {
	mixed: readJson(join(schedulesDir, "mixed.json"), emptySchedule),
	protocols: readJson(join(schedulesDir, "protocols.json"), emptySchedule),
	applications: readJson(
		join(schedulesDir, "applications.json"),
		emptySchedule,
	),
};
const identity = readJson<FrozenIdentity>(
	join(schedulesDir, "identity.json"),
	{},
);
const utcToday = process.env.PORTDLE_UTC_TODAY ?? utcDateString(new Date());
const input = { utcToday, protocols, applications, current, identity };

if (process.argv.includes("--check")) {
	if (checkSchedules(input).length > 0) {
		process.exitCode = 1;
	}
} else {
	const next = generateSchedules(input);
	const issues = [
		...validateSchedules({
			utcToday,
			protocols,
			applications,
			schedules: next.schedules,
		}),
		...validateFrozenIdentity({
			utcToday,
			identity: next.identity,
			protocols,
			applications,
			schedules: next.schedules,
		}),
	];
	if (issues.length > 0) {
		process.exitCode = 1;
	} else {
		writePretty(join(schedulesDir, "mixed.json"), next.schedules.mixed);
		writePretty(join(schedulesDir, "protocols.json"), next.schedules.protocols);
		writePretty(
			join(schedulesDir, "applications.json"),
			next.schedules.applications,
		);
		writePretty(join(schedulesDir, "identity.json"), next.identity);
	}
}
