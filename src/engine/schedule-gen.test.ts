import { expect, test } from "vitest";
import {
	checkSchedules,
	generateSchedules,
	identityEqual,
	schedulesEqual,
	validateFrozenIdentity,
	validateSchedules,
} from "./schedule-gen";
import type { CatalogEntry, DailyCategory, ScheduleFile } from "./types";
import { addUtcDays, utcDayIndex } from "./utc";

function entry(
	id: string,
	port: number,
	extra: Partial<CatalogEntry> = {},
): CatalogEntry {
	return {
		id,
		name: id,
		port,
		transport: "tcp",
		description: id,
		answerEligible: true,
		...extra,
	};
}

const epoch = "2026-09-09";
const protocols = [entry("http", 80), entry("ssh", 22), entry("dns", 53)];
const applications = [
	entry("vite", 5173),
	entry("flask", 5000),
	entry("django", 8000),
];
const empty: ScheduleFile = { epoch, cycles: [] };
const emptyAll = {
	mixed: empty,
	protocols: empty,
	applications: empty,
} satisfies Record<DailyCategory, ScheduleFile>;

function lastDay(schedule: ScheduleFile): number {
	let max = -1;
	for (const cycle of schedule.cycles) {
		max = Math.max(max, cycle.startDay + cycle.order.length - 1);
	}
	return max;
}

function idOn(schedule: ScheduleFile, date: string): string | undefined {
	const index = utcDayIndex(date, epoch);
	const cycle = schedule.cycles.find(
		(candidate) =>
			candidate.startDay <= index &&
			index < candidate.startDay + candidate.order.length,
	);
	if (!cycle) {
		return undefined;
	}
	return cycle.order[index - cycle.startDay];
}

test("empty current covers today plus 7 days", () => {
	const out = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const today = utcDayIndex(epoch, epoch);
	expect(lastDay(out.schedules.mixed)).toBeGreaterThanOrEqual(today + 7);
	expect(lastDay(out.schedules.protocols)).toBeGreaterThanOrEqual(today + 7);
	expect(lastDay(out.schedules.applications)).toBeGreaterThanOrEqual(today + 7);
});

test("adding an id does not change frozen prefix including today", () => {
	const first = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const extra = [...applications, entry("angular", 4200)];
	const second = generateSchedules({
		utcToday: epoch,
		protocols,
		applications: extra,
		current: first.schedules,
		identity: first.identity,
	});
	expect(second.schedules.mixed.cycles[0]?.order.slice(0, 1)).toEqual(
		first.schedules.mixed.cycles[0]?.order.slice(0, 1),
	);
	expect(second.schedules.applications.cycles[0]?.order.slice(0, 1)).toEqual(
		first.schedules.applications.cycles[0]?.order.slice(0, 1),
	);
});

test("retiring a tail id drops it from the tail and leaves the prefix", () => {
	const first = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const prefix = first.schedules.protocols.cycles[0]?.order[0];
	expect(prefix).toBeDefined();
	const retiredId = first.schedules.protocols.cycles[0]?.order[1];
	expect(retiredId).toBeDefined();
	expect(retiredId).not.toBe(prefix);
	const retired = protocols.map((row) =>
		row.id === retiredId ? { ...row, retired: true } : row,
	);
	const second = generateSchedules({
		utcToday: epoch,
		protocols: retired,
		applications,
		current: first.schedules,
		identity: first.identity,
	});
	expect(second.schedules.protocols.cycles[0]?.order[0]).toBe(prefix);
	expect(second.schedules.protocols.cycles[0]?.order.slice(1)).not.toContain(
		retiredId,
	);
});

test("retiring a frozen-prefix id leaves that slot", () => {
	const first = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const frozenId = first.schedules.protocols.cycles[0]?.order[0];
	expect(frozenId).toBeDefined();
	const retired = protocols.map((row) =>
		row.id === frozenId ? { ...row, retired: true } : row,
	);
	const second = generateSchedules({
		utcToday: epoch,
		protocols: retired,
		applications,
		current: first.schedules,
		identity: first.identity,
	});
	expect(second.schedules.protocols.cycles[0]?.order[0]).toBe(frozenId);
});

test("same-day mixed differs from protocols and applications after today", () => {
	const out = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	for (let offset = 1; offset <= 7; offset += 1) {
		const date = `2026-09-${String(9 + offset).padStart(2, "0")}`;
		const mixed = idOn(out.schedules.mixed, date);
		const proto = idOn(out.schedules.protocols, date);
		const app = idOn(out.schedules.applications, date);
		expect(mixed).not.toBe(proto);
		expect(mixed).not.toBe(app);
	}
});

test("brand-new cycles are distinct from startDay", () => {
	const out = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const mixed = idOn(out.schedules.mixed, epoch);
	const proto = idOn(out.schedules.protocols, epoch);
	const app = idOn(out.schedules.applications, epoch);
	expect(mixed).not.toBe(proto);
	expect(mixed).not.toBe(app);
});

test("second generate with no eligibility change is a no-op", () => {
	const first = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const second = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: first.schedules,
		identity: first.identity,
	});
	expect(schedulesEqual(first.schedules, second.schedules)).toBe(true);
	expect(identityEqual(first.identity, second.identity)).toBe(true);
});

test("flavor-only description edit leaves schedules and identity equal", () => {
	const first = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const flavored = protocols.map((row) => ({
		...row,
		description: `${row.description} extra.`,
	}));
	const second = generateSchedules({
		utcToday: epoch,
		protocols: flavored,
		applications,
		current: first.schedules,
		identity: first.identity,
	});
	expect(schedulesEqual(first.schedules, second.schedules)).toBe(true);
	expect(identityEqual(first.identity, second.identity)).toBe(true);
});

test("changing frozen-prefix name fails frozen identity even if schedules would not change", () => {
	const first = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const frozenId = first.schedules.mixed.cycles[0]?.order[0];
	expect(frozenId).toBeDefined();
	const renamed = [...protocols, ...applications].map((row) =>
		row.id === frozenId ? { ...row, name: "Renamed" } : row,
	);
	const nextProtocols = renamed.filter((row) =>
		protocols.some((item) => item.id === row.id),
	);
	const nextApplications = renamed.filter((row) =>
		applications.some((item) => item.id === row.id),
	);
	expect(
		validateFrozenIdentity({
			utcToday: epoch,
			identity: first.identity,
			protocols: nextProtocols,
			applications: nextApplications,
			schedules: first.schedules,
		}).length,
	).toBeGreaterThan(0);
	const second = generateSchedules({
		utcToday: epoch,
		protocols: nextProtocols,
		applications: nextApplications,
		current: first.schedules,
		identity: first.identity,
	});
	expect(schedulesEqual(first.schedules, second.schedules)).toBe(true);
	expect(
		checkSchedules({
			utcToday: epoch,
			protocols: nextProtocols,
			applications: nextApplications,
			current: first.schedules,
			identity: first.identity,
		}).some((issue) => issue.includes("frozen identity")),
	).toBe(true);
});

test("changing frozen-prefix description does not fail frozen identity", () => {
	const first = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const flavored = protocols.map((row) => ({
		...row,
		description: "changed",
	}));
	expect(
		validateFrozenIdentity({
			utcToday: epoch,
			identity: first.identity,
			protocols: flavored,
			applications,
			schedules: first.schedules,
		}),
	).toEqual([]);
});

test("utcToday before all cycles with covering schedules is a no-op", () => {
	const first = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const second = generateSchedules({
		utcToday: "2026-09-08",
		protocols,
		applications,
		current: first.schedules,
		identity: first.identity,
	});
	expect(schedulesEqual(first.schedules, second.schedules)).toBe(true);
});

test("today as last slot of a containing cycle still adds new ids to that cycle", () => {
	const current = {
		mixed: {
			epoch,
			cycles: [{ startDay: 0, order: ["http", "ssh", "dns"] }],
		},
		protocols: {
			epoch,
			cycles: [{ startDay: 0, order: ["http", "ssh", "dns"] }],
		},
		applications: {
			epoch,
			cycles: [{ startDay: 0, order: ["vite", "flask", "django"] }],
		},
	};
	const out = generateSchedules({
		utcToday: "2026-09-11",
		protocols: [...protocols, entry("ntp", 123)],
		applications,
		current,
		identity: {},
	});
	expect(out.schedules.protocols.cycles[0]?.order.slice(0, 3)).toEqual([
		"http",
		"ssh",
		"dns",
	]);
	expect(out.schedules.protocols.cycles[0]?.order).toContain("ntp");
});

test("past-all coverage cycles are distinct from their startDay", () => {
	const short = {
		mixed: {
			epoch,
			cycles: [{ startDay: 0, order: ["http", "ssh", "dns"] }],
		},
		protocols: {
			epoch,
			cycles: [{ startDay: 0, order: ["http", "ssh", "dns"] }],
		},
		applications: {
			epoch,
			cycles: [{ startDay: 0, order: ["vite", "flask", "django"] }],
		},
	};
	const out = generateSchedules({
		utcToday: "2026-10-01",
		protocols,
		applications,
		current: short,
		identity: {},
	});
	expect(out.schedules.mixed.cycles[0]?.order).toEqual(["http", "ssh", "dns"]);
	for (let day = 3; day <= lastDay(out.schedules.mixed); day += 1) {
		const date = addUtcDays(epoch, day);
		const mixed = idOn(out.schedules.mixed, date);
		const proto = idOn(out.schedules.protocols, date);
		const app = idOn(out.schedules.applications, date);
		expect(mixed).not.toBe(proto);
		expect(mixed).not.toBe(app);
	}
});

test("today past all cycles freezes the last cycle entire order", () => {
	const first = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	const shortOrder = first.schedules.protocols.cycles[0]?.order.slice(0, 3);
	expect(shortOrder?.length).toBe(3);
	const short = {
		...emptyAll,
		mixed: first.schedules.mixed,
		applications: first.schedules.applications,
		protocols: {
			epoch,
			cycles: [{ startDay: 0, order: shortOrder ?? [] }],
		},
	};
	const second = generateSchedules({
		utcToday: "2026-10-01",
		protocols: [...protocols, entry("ntp", 123)],
		applications,
		current: short,
		identity: first.identity,
	});
	expect(second.schedules.protocols.cycles[0]?.order).toEqual(shortOrder);
	expect(
		second.schedules.protocols.cycles.some((cycle) =>
			cycle.order.includes("ntp"),
		),
	).toBe(true);
	expect(second.schedules.protocols.cycles[0]?.order).not.toContain("ntp");
});

test("does not rewrite a frozen mixed prefix when another schedule is empty", () => {
	const current = {
		mixed: {
			epoch,
			cycles: [{ startDay: 0, order: ["http", "vite", "ssh"] }],
		},
		protocols: {
			epoch,
			cycles: [{ startDay: 0, order: ["http", "ssh", "dns"] }],
		},
		applications: empty,
	};
	const out = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current,
		identity: {},
	});
	expect(out.schedules.mixed.cycles[0]?.order[0]).toBe("http");
});

test("validateSchedules flags a same-day collision after today", () => {
	const colliding = {
		mixed: {
			epoch,
			cycles: [{ startDay: 0, order: ["vite", "http", "ssh"] }],
		},
		protocols: {
			epoch,
			cycles: [{ startDay: 0, order: ["http", "http", "dns"] }],
		},
		applications: {
			epoch,
			cycles: [{ startDay: 0, order: ["vite", "flask", "django"] }],
		},
	};
	expect(
		validateSchedules({
			utcToday: epoch,
			protocols,
			applications,
			schedules: colliding,
		}).some((issue) => issue.includes("same-day collision")),
	).toBe(true);
});

test("never assigns a negative day index", () => {
	const out = generateSchedules({
		utcToday: epoch,
		protocols,
		applications,
		current: emptyAll,
		identity: {},
	});
	for (const schedule of Object.values(out.schedules)) {
		for (const cycle of schedule.cycles) {
			expect(cycle.startDay).toBeGreaterThanOrEqual(0);
		}
	}
});
