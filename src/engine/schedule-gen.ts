import { answerPool, catalogFor, validateCatalog } from "./catalog";
import { hashSeed, mulberry32 } from "./rng";
import {
	type CatalogEntry,
	type Cycle,
	DAILY_CATEGORIES,
	type DailyCategory,
	type ScheduleFile,
} from "./types";
import { utcDayIndex } from "./utc";

export type FrozenIdentity = Record<string, { name: string; port: number }>;

export const SCHEDULE_EPOCH = "2026-09-09";

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function shuffleSorted(ids: string[], seedKey: string): string[] {
	const shuffled = [...ids].sort();
	const random = mulberry32(hashSeed(seedKey));
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapWith = Math.floor(random() * (index + 1));
		const current = shuffled[index];
		const other = shuffled[swapWith];
		if (current === undefined || other === undefined) {
			continue;
		}
		shuffled[index] = other;
		shuffled[swapWith] = current;
	}
	return shuffled;
}

function lastAssignedDay(schedule: ScheduleFile): number {
	let max = -1;
	for (const cycle of schedule.cycles) {
		if (cycle.order.length === 0) {
			continue;
		}
		max = Math.max(max, cycle.startDay + cycle.order.length - 1);
	}
	return max;
}

export function cycleForDay(
	schedule: ScheduleFile,
	dayIndex: number,
): Cycle | undefined {
	return schedule.cycles.find(
		(cycle) =>
			cycle.startDay <= dayIndex &&
			dayIndex < cycle.startDay + cycle.order.length,
	);
}

function idOnDay(schedule: ScheduleFile, dayIndex: number): string | undefined {
	const cycle = cycleForDay(schedule, dayIndex);
	if (!cycle) {
		return undefined;
	}
	return cycle.order[dayIndex - cycle.startDay];
}

function setIdOnDay(
	schedule: ScheduleFile,
	dayIndex: number,
	id: string,
): boolean {
	const cycle = cycleForDay(schedule, dayIndex);
	if (!cycle) {
		return false;
	}
	cycle.order[dayIndex - cycle.startDay] = id;
	return true;
}

function poolIds(
	category: DailyCategory,
	protocols: CatalogEntry[],
	applications: CatalogEntry[],
): string[] {
	return answerPool(catalogFor(category, protocols, applications)).map(
		(entry) => entry.id,
	);
}

function appendCycle(
	schedule: ScheduleFile,
	category: DailyCategory,
	ids: string[],
): Cycle {
	const startDay = lastAssignedDay(schedule) + 1;
	const order = shuffleSorted(ids, `${category}:${startDay}`);
	const cycle: Cycle = { startDay, order };
	schedule.cycles.push(cycle);
	return cycle;
}

function applyA2(
	schedule: ScheduleFile,
	category: DailyCategory,
	utcToday: string,
	eligible: Set<string>,
): void {
	const epoch = schedule.epoch;
	const todayIndex = utcDayIndex(utcToday, epoch);
	const containing = cycleForDay(schedule, todayIndex);
	let cycle: Cycle | undefined = containing;
	let frozenLength = 0;

	if (containing) {
		frozenLength = todayIndex - containing.startDay + 1;
	} else if (schedule.cycles.length > 0) {
		const last = schedule.cycles[schedule.cycles.length - 1];
		if (!last) {
			return;
		}
		const lastEnd = last.startDay + last.order.length - 1;
		if (todayIndex > lastEnd) {
			cycle = last;
			frozenLength = last.order.length;
		} else {
			cycle = schedule.cycles[0];
			frozenLength = 0;
		}
	}

	if (!cycle) {
		return;
	}
	if (!containing && frozenLength >= cycle.order.length) {
		return;
	}

	const prefix = cycle.order.slice(0, frozenLength);
	const tail = cycle.order.slice(frozenLength);
	const stillEligibleTail = tail.filter((id) => eligible.has(id));
	const inCycle = new Set(cycle.order);
	const added: string[] = [];
	for (const id of eligible) {
		if (!inCycle.has(id)) {
			added.push(id);
		}
	}
	const dropped = tail.filter((id) => !eligible.has(id));
	if (added.length === 0 && dropped.length === 0) {
		return;
	}
	const nextTail = shuffleSorted(
		[...stillEligibleTail, ...added],
		`${category}:${cycle.startDay}:${[...stillEligibleTail, ...added].sort().join(",")}`,
	);
	cycle.order = [...prefix, ...nextTail];
}

function coverThrough(
	schedule: ScheduleFile,
	category: DailyCategory,
	utcToday: string,
	ids: string[],
): Cycle[] {
	const appended: Cycle[] = [];
	const todayIndex = utcDayIndex(utcToday, schedule.epoch);
	const needed = todayIndex + 7;
	while (lastAssignedDay(schedule) < needed) {
		if (ids.length === 0) {
			break;
		}
		appended.push(appendCycle(schedule, category, ids));
	}
	return appended;
}

function unusedMixedId(
	mixedCycle: Cycle,
	eligible: Set<string>,
): string | undefined {
	const used = new Set(mixedCycle.order);
	const unused = [...eligible].filter((id) => !used.has(id)).sort();
	return unused[0];
}

function laterMixedSwapIndex(
	schedules: Record<DailyCategory, ScheduleFile>,
	dayIndex: number,
	protocolsId: string | undefined,
	applicationsId: string | undefined,
): { cycle: Cycle; index: number } | undefined {
	const mixed = schedules.mixed;
	for (const cycle of mixed.cycles) {
		for (let offset = 0; offset < cycle.order.length; offset += 1) {
			const candidateDay = cycle.startDay + offset;
			if (candidateDay <= dayIndex) {
				continue;
			}
			const candidate = cycle.order[offset];
			if (candidate === undefined) {
				continue;
			}
			const otherP = idOnDay(schedules.protocols, candidateDay);
			const otherA = idOnDay(schedules.applications, candidateDay);
			if (candidate === protocolsId || candidate === applicationsId) {
				continue;
			}
			if (candidate === otherP || candidate === otherA) {
				continue;
			}
			return { cycle, index: offset };
		}
	}
	return undefined;
}

function resolveDistinctness(
	schedules: Record<DailyCategory, ScheduleFile>,
	fromDay: number,
	mixedEligible: Set<string>,
): void {
	let day = Math.max(fromDay, 0);
	const mixed = schedules.mixed;
	while (
		day <= lastAssignedDay(mixed) ||
		day <= lastAssignedDay(schedules.protocols) ||
		day <= lastAssignedDay(schedules.applications)
	) {
		if (!cycleForDay(mixed, day)) {
			appendCycle(mixed, "mixed", [...mixedEligible]);
		}
		const mixedId = idOnDay(mixed, day);
		const protocolsId = idOnDay(schedules.protocols, day);
		const applicationsId = idOnDay(schedules.applications, day);
		if (
			mixedId !== undefined &&
			(mixedId === protocolsId || mixedId === applicationsId)
		) {
			const swap = laterMixedSwapIndex(
				schedules,
				day,
				protocolsId,
				applicationsId,
			);
			if (swap) {
				const currentCycle = cycleForDay(mixed, day);
				const currentOffset = currentCycle ? day - currentCycle.startDay : -1;
				const laterId = swap.cycle.order[swap.index];
				if (
					currentCycle &&
					currentOffset >= 0 &&
					laterId !== undefined &&
					mixedId !== undefined
				) {
					swap.cycle.order[swap.index] = mixedId;
					currentCycle.order[currentOffset] = laterId;
				}
			} else {
				const currentCycle = cycleForDay(mixed, day);
				if (currentCycle) {
					const unused = unusedMixedId(currentCycle, mixedEligible);
					if (unused) {
						setIdOnDay(mixed, day, unused);
					} else {
						appendCycle(mixed, "mixed", [...mixedEligible]);
						continue;
					}
				}
			}
		}
		day += 1;
	}
}

function frozenPrefixIds(
	schedules: Record<DailyCategory, ScheduleFile>,
	utcToday: string,
): string[] {
	const ids: string[] = [];
	for (const category of DAILY_CATEGORIES) {
		const schedule = schedules[category];
		const todayIndex = utcDayIndex(utcToday, schedule.epoch);
		for (const cycle of schedule.cycles) {
			for (let offset = 0; offset < cycle.order.length; offset += 1) {
				const day = cycle.startDay + offset;
				if (day >= 0 && day <= todayIndex) {
					const id = cycle.order[offset];
					if (id !== undefined) {
						ids.push(id);
					}
				}
			}
		}
	}
	return ids;
}

function recordIdentity(
	identity: FrozenIdentity,
	ids: string[],
	protocols: CatalogEntry[],
	applications: CatalogEntry[],
): FrozenIdentity {
	const next = { ...identity };
	const catalog = catalogFor("mixed", protocols, applications);
	for (const id of ids) {
		if (next[id] !== undefined) {
			continue;
		}
		const found = catalog.find((entry) => entry.id === id);
		if (found) {
			next[id] = { name: found.name, port: found.port };
		}
	}
	return next;
}

export function schedulesEqual(
	left: Record<DailyCategory, ScheduleFile>,
	right: Record<DailyCategory, ScheduleFile>,
): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

export function identityEqual(
	left: FrozenIdentity,
	right: FrozenIdentity,
): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

export function generateSchedules(input: {
	utcToday: string;
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
	current: Record<DailyCategory, ScheduleFile>;
	identity: FrozenIdentity;
}): {
	schedules: Record<DailyCategory, ScheduleFile>;
	identity: FrozenIdentity;
} {
	const schedules = clone(input.current);
	for (const category of DAILY_CATEGORIES) {
		const current = schedules[category];
		if (!current.epoch) {
			current.epoch = SCHEDULE_EPOCH;
		}
		if (!current.cycles) {
			current.cycles = [];
		}
		const ids = poolIds(category, input.protocols, input.applications);
		const eligible = new Set(
			poolIds(category, input.protocols, input.applications),
		);
		applyA2(schedules[category], category, input.utcToday, eligible);
		coverThrough(schedules[category], category, input.utcToday, ids);
	}
	const todayIndex = utcDayIndex(input.utcToday, schedules.mixed.epoch);
	const mixedWasEmpty = input.current.mixed.cycles.length === 0;
	const originalLast = lastAssignedDay(input.current.mixed);
	let fromDay = mixedWasEmpty || todayIndex < 0 ? 0 : todayIndex + 1;
	for (const cycle of schedules.mixed.cycles) {
		if (cycle.startDay > originalLast) {
			fromDay = Math.min(fromDay, Math.max(cycle.startDay, 0));
		}
	}
	resolveDistinctness(
		schedules,
		fromDay,
		new Set(poolIds("mixed", input.protocols, input.applications)),
	);
	const identity = recordIdentity(
		input.identity,
		frozenPrefixIds(schedules, input.utcToday),
		input.protocols,
		input.applications,
	);
	return { schedules, identity };
}

export function validateSchedules(input: {
	utcToday: string;
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
	schedules: Record<DailyCategory, ScheduleFile>;
}): string[] {
	const issues: string[] = [];
	const protocolIssues = validateCatalog(input.protocols);
	const applicationIssues = validateCatalog(input.applications);
	const unionIssues = validateCatalog(
		catalogFor("mixed", input.protocols, input.applications),
	);
	for (const issue of [
		...protocolIssues,
		...applicationIssues,
		...unionIssues,
	]) {
		issues.push(
			`${issue.kind}:${issue.kind === "duplicate-name" ? issue.name : issue.id}`,
		);
	}
	if (answerPool(input.protocols).length < 40) {
		issues.push("protocol answer pool below 40");
	}
	if (answerPool(input.applications).length < 25) {
		issues.push("application answer pool below 25");
	}
	if (!input.protocols.some((entry) => !entry.answerEligible)) {
		issues.push("protocols missing miss-only");
	}
	if (!input.applications.some((entry) => !entry.answerEligible)) {
		issues.push("applications missing miss-only");
	}
	for (const category of DAILY_CATEGORIES) {
		const schedule = input.schedules[category];
		const catalog = catalogFor(category, input.protocols, input.applications);
		const ids = new Set(catalog.map((entry) => entry.id));
		for (const cycle of schedule.cycles) {
			if (cycle.startDay < 0) {
				issues.push(`${category} assigns a negative day`);
			}
			for (const id of cycle.order) {
				if (!ids.has(id)) {
					issues.push(`${category} unknown id ${id}`);
				}
			}
		}
		const todayIndex = utcDayIndex(input.utcToday, schedule.epoch);
		if (lastAssignedDay(schedule) < todayIndex + 7) {
			issues.push(`${category} does not cover today+7`);
		}
	}
	const todayIndex = utcDayIndex(input.utcToday, input.schedules.mixed.epoch);
	const last = Math.max(
		lastAssignedDay(input.schedules.mixed),
		lastAssignedDay(input.schedules.protocols),
		lastAssignedDay(input.schedules.applications),
	);
	for (let day = Math.max(0, todayIndex + 1); day <= last; day += 1) {
		const mixed = idOnDay(input.schedules.mixed, day);
		const protocolsId = idOnDay(input.schedules.protocols, day);
		const applicationsId = idOnDay(input.schedules.applications, day);
		if (
			mixed !== undefined &&
			(mixed === protocolsId || mixed === applicationsId)
		) {
			issues.push(`same-day collision on day ${day}`);
		}
	}
	return issues;
}

export function validateFrozenIdentity(input: {
	utcToday: string;
	identity: FrozenIdentity;
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
	schedules: Record<DailyCategory, ScheduleFile>;
}): string[] {
	const issues: string[] = [];
	const catalog = catalogFor("mixed", input.protocols, input.applications);
	const byId = new Map(catalog.map((entry) => [entry.id, entry]));
	for (const id of frozenPrefixIds(input.schedules, input.utcToday)) {
		const entry = byId.get(id);
		if (!entry) {
			issues.push(`frozen id missing ${id}`);
			continue;
		}
		const frozen = input.identity[id];
		if (!frozen) {
			issues.push(`frozen identity missing ${id}`);
			continue;
		}
		if (frozen.name !== entry.name || frozen.port !== entry.port) {
			issues.push(`frozen identity mismatch ${id}`);
		}
	}
	return issues;
}

export function checkSchedules(input: {
	utcToday: string;
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
	current: Record<DailyCategory, ScheduleFile>;
	identity: FrozenIdentity;
}): string[] {
	const next = generateSchedules(input);
	const issues: string[] = [];
	if (!schedulesEqual(input.current, next.schedules)) {
		issues.push("schedules would change");
	}
	if (!identityEqual(input.identity, next.identity)) {
		issues.push("identity would change");
	}
	issues.push(
		...validateSchedules({
			utcToday: input.utcToday,
			protocols: input.protocols,
			applications: input.applications,
			schedules: next.schedules,
		}),
		...validateFrozenIdentity({
			utcToday: input.utcToday,
			identity: input.identity,
			protocols: input.protocols,
			applications: input.applications,
			schedules: input.current,
		}),
		...validateFrozenIdentity({
			utcToday: input.utcToday,
			identity: next.identity,
			protocols: input.protocols,
			applications: input.applications,
			schedules: next.schedules,
		}),
	);
	return issues;
}
