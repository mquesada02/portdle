import { expect, test } from "vitest";
import applicationsJson from "../catalogs/applications.json";
import protocolsJson from "../catalogs/protocols.json";
import applicationsScheduleJson from "../catalogs/schedules/applications.json";
import identityJson from "../catalogs/schedules/identity.json";
import mixedScheduleJson from "../catalogs/schedules/mixed.json";
import protocolsScheduleJson from "../catalogs/schedules/protocols.json";
import { answerPool, catalogFor, validateCatalog } from "./catalog";
import { getDaily } from "./daily";
import {
	type FrozenIdentity,
	validateFrozenIdentity,
	validateSchedules,
} from "./schedule-gen";
import type { CatalogEntry, ScheduleFile } from "./types";

const protocols = protocolsJson as CatalogEntry[];
const applications = applicationsJson as CatalogEntry[];
const schedules = {
	mixed: mixedScheduleJson as ScheduleFile,
	protocols: protocolsScheduleJson as ScheduleFile,
	applications: applicationsScheduleJson as ScheduleFile,
};
const identity = identityJson as FrozenIdentity;

test("production catalogs meet floors and validation", () => {
	expect(validateCatalog(protocols)).toEqual([]);
	expect(validateCatalog(applications)).toEqual([]);
	expect(validateCatalog(catalogFor("mixed", protocols, applications))).toEqual(
		[],
	);
	expect(answerPool(protocols).length).toBeGreaterThanOrEqual(40);
	expect(answerPool(applications).length).toBeGreaterThanOrEqual(25);
	expect(protocols.some((entry) => !entry.answerEligible)).toBe(true);
	expect(applications.some((entry) => !entry.answerEligible)).toBe(true);
});

test("continuity literals keep Mixed fixture identity", () => {
	expect(protocols.find((entry) => entry.id === "http")).toMatchObject({
		name: "HTTP",
		port: 80,
		answerEligible: true,
	});
	expect(protocols.find((entry) => entry.id === "chargen")).toMatchObject({
		name: "chargen",
		port: 19,
		answerEligible: false,
	});
	expect(protocols.find((entry) => entry.id === "telnet")).toMatchObject({
		name: "Telnet",
		port: 23,
		answerEligible: true,
	});
	expect(
		protocols.find((entry) => entry.id === "telnet")?.retired,
	).toBeUndefined();
	expect(applications.find((entry) => entry.id === "vite")).toMatchObject({
		name: "Vite",
		port: 5173,
		answerEligible: true,
	});
});

test("committed schedules cover epoch week and stay distinct", () => {
	expect(
		validateSchedules({
			utcToday: "2026-09-09",
			protocols,
			applications,
			schedules,
		}),
	).toEqual([]);
	expect(
		validateFrozenIdentity({
			utcToday: "2026-09-09",
			identity,
			protocols,
			applications,
			schedules,
		}),
	).toEqual([]);
	const mixed = getDaily(
		"mixed",
		"2026-09-09",
		schedules.mixed,
		protocols,
		applications,
	);
	const proto = getDaily(
		"protocols",
		"2026-09-09",
		schedules.protocols,
		protocols,
		applications,
	);
	const app = getDaily(
		"applications",
		"2026-09-09",
		schedules.applications,
		protocols,
		applications,
	);
	expect(mixed?.id).toBeDefined();
	expect(proto?.id).toBeDefined();
	expect(app?.id).toBeDefined();
	expect(mixed?.id).not.toBe(proto?.id);
	expect(mixed?.id).not.toBe(app?.id);
});
