import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type FrozenIdentity,
	generateSchedules,
	identityEqual,
	schedulesEqual,
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
const EPOCH = "2026-09-09";
const emptySchedule: ScheduleFile = { epoch: EPOCH, cycles: [] };

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
const next = generateSchedules({
	utcToday,
	protocols,
	applications,
	current,
	identity,
});
const scheduleIssues = validateSchedules({
	utcToday,
	protocols,
	applications,
	schedules: next.schedules,
});
const identityIssues = validateFrozenIdentity({
	utcToday,
	identity: next.identity,
	protocols,
	applications,
	schedules: next.schedules,
});
const check = process.argv.includes("--check");

if (check) {
	const currentIdentityIssues = validateFrozenIdentity({
		utcToday,
		identity,
		protocols,
		applications,
		schedules: current,
	});
	const wouldChange =
		!schedulesEqual(current, next.schedules) ||
		!identityEqual(identity, next.identity);
	const issues = [
		...scheduleIssues,
		...identityIssues,
		...currentIdentityIssues,
	];
	if (wouldChange || issues.length > 0) {
		process.exitCode = 1;
	}
} else if (scheduleIssues.length > 0 || identityIssues.length > 0) {
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
