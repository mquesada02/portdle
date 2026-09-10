import { expect, test } from "vitest";
import { reduceBlitz, startBlitz } from "./blitz";
import { digitLength } from "./guess";
import type { CatalogEntry, ScheduleFile } from "./types";

const entries: CatalogEntry[] = ["a", "b", "c", "d"].map((id, index) => ({
	id,
	name: id.toUpperCase(),
	port: 4000 + index,
	transport: "tcp",
	description: id,
	answerEligible: true,
}));
const proto: CatalogEntry = {
	id: "http",
	name: "HTTP",
	port: 80,
	transport: "tcp",
	description: "web",
	answerEligible: true,
};
const missOnly: CatalogEntry = {
	id: "chargen",
	name: "chargen",
	port: 19,
	transport: "tcp",
	description: "chargen",
	answerEligible: false,
};
const retired: CatalogEntry = {
	id: "telnet",
	name: "Telnet",
	port: 23,
	transport: "tcp",
	description: "telnet",
	answerEligible: true,
	retired: true,
};

const schedules: Record<"mixed" | "protocols" | "applications", ScheduleFile> =
	{
		mixed: { epoch: "2026-09-09", cycles: [{ startDay: 0, order: ["a"] }] },
		protocols: {
			epoch: "2026-09-09",
			cycles: [{ startDay: 0, order: ["http"] }],
		},
		applications: {
			epoch: "2026-09-09",
			cycles: [{ startDay: 0, order: ["b"] }],
		},
	};

const rng = () => 0;

function startMixed() {
	return startBlitz({
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		utcToday: "2026-09-09",
		protocols: [proto, missOnly, retired],
		applications: entries,
		schedules,
		rng,
	});
}

test("excludes today's three daily ids", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const ids = [started.currentId, ...started.remainingIds];
	expect(ids.sort()).toEqual(["c", "d"]);
	expect(ids).not.toContain("a");
	expect(ids).not.toContain("b");
	expect(ids).not.toContain("http");
});

test("miss-only and retired ids are not in the start pool", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const ids = [started.currentId, ...started.remainingIds];
	expect(ids).not.toContain("chargen");
	expect(ids).not.toContain("telnet");
});

test("empty filtered pool returns empty-pool", () => {
	expect(
		startBlitz({
			category: "protocols",
			orientation: "default",
			mode: "sprint",
			utcToday: "2026-09-09",
			protocols: [proto],
			applications: entries,
			schedules,
			rng,
		}),
	).toEqual({ error: "empty-pool" });
});

test("lives start at 3 and score at 0", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	expect(started.lives).toBe(3);
	expect(started.score).toBe(0);
	expect(started.ended).toBeNull();
});

function padFor(state: { currentId: string }, port: number): string {
	const answer = [...entries, proto, missOnly, retired].find(
		(entry) => entry.id === state.currentId,
	);
	if (!answer) {
		throw new Error("missing");
	}
	return String(port).padStart(digitLength(answer.port), "0");
}

function reduceDefault(
	state: Exclude<ReturnType<typeof startMixed>, { error: "empty-pool" }>,
	portOrDigits: number | string,
) {
	const digits =
		typeof portOrDigits === "number"
			? padFor(state, portOrDigits)
			: portOrDigits;
	return reduceBlitz({
		state,
		event: { type: "default-guess", digits },
		protocols: [proto, missOnly, retired],
		applications: entries,
		rng,
	});
}

test("correct default-guess increments score and changes currentId", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const answer = [...entries, proto].find(
		(entry) => entry.id === started.currentId,
	);
	if (!answer) {
		throw new Error("missing");
	}
	const next = reduceDefault(started, answer.port);
	expect(next.guess).toEqual({ status: "correct", port: answer.port });
	expect(next.state.score).toBe(1);
	expect(next.state.lives).toBe(3);
	expect(next.state.currentId).not.toBe(started.currentId);
	expect(next.state.ended).toBeNull();
});

test("miss decrements lives and changes currentId while lives remain", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const next = reduceDefault(started, 80);
	expect(next.state.lives).toBe(2);
	expect(next.state.score).toBe(0);
	expect(next.state.currentId).not.toBe(started.currentId);
	expect(next.state.ended).toBeNull();
	expect(next.guess).toMatchObject({
		status: "miss",
		port: 80,
		identified: { id: "http", name: "HTTP", port: 80 },
	});
});

test("three misses set ended lives and keep the last item", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	let state = started;
	state = reduceDefault(state, 80).state;
	state = reduceDefault(state, 80).state;
	const last = reduceDefault(state, 80);
	expect(last.state.lives).toBe(0);
	expect(last.state.ended).toBe("lives");
	expect(last.state.currentId).toBe(state.currentId);
});

test("invalid digits do not change lives score or currentId", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const next = reduceDefault(started, "12");
	expect(next.guess).toEqual({ status: "invalid" });
	expect(next.state).toEqual(started);
});

test("timeout sets ended timeout and leaves score", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const firstAnswer = [...entries, proto].find(
		(entry) => entry.id === started.currentId,
	);
	if (!firstAnswer) {
		throw new Error("missing");
	}
	const scored = reduceDefault(started, firstAnswer.port);
	const timed = reduceBlitz({
		state: scored.state,
		event: { type: "timeout" },
		protocols: [proto, missOnly, retired],
		applications: entries,
		rng,
	});
	expect(timed.state.ended).toBe("timeout");
	expect(timed.state.score).toBe(1);
	expect(timed.guess).toBeUndefined();
});

test("correct when remainingIds is empty reshuffles startPool", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const firstAnswer = [...entries, proto].find(
		(entry) => entry.id === started.currentId,
	);
	if (!firstAnswer) {
		throw new Error("missing");
	}
	const afterFirst = reduceDefault(started, firstAnswer.port);
	expect(afterFirst.state.remainingIds).toEqual([]);
	const secondAnswer = [...entries, proto].find(
		(entry) => entry.id === afterFirst.state.currentId,
	);
	if (!secondAnswer) {
		throw new Error("missing");
	}
	const afterSecond = reduceDefault(afterFirst.state, secondAnswer.port);
	expect(afterSecond.state.ended).toBeNull();
	expect(afterSecond.state.score).toBe(2);
	expect(afterSecond.state.currentId).toBeTruthy();
	expect(
		[afterSecond.state.currentId, ...afterSecond.state.remainingIds].sort(),
	).toEqual(["c", "d"]);
});

test("reducing an already-ended state is a no-op", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const ended = reduceBlitz({
		state: started,
		event: { type: "timeout" },
		protocols: [proto, missOnly, retired],
		applications: entries,
		rng,
	});
	const again = reduceDefault(ended.state, 80);
	expect(again.state).toEqual(ended.state);
	expect(again.guess).toBeUndefined();
});

test("protocols miss of an applications-only port is unidentified", () => {
	const started = startBlitz({
		category: "applications",
		orientation: "default",
		mode: "sprint",
		utcToday: "2026-09-09",
		protocols: [proto, missOnly, retired],
		applications: entries,
		schedules,
		rng,
	});
	if ("error" in started) {
		throw new Error("empty");
	}
	const next = reduceBlitz({
		state: started,
		event: { type: "default-guess", digits: padFor(started, 80) },
		protocols: [proto, missOnly, retired],
		applications: entries,
		rng,
	});
	expect(next.guess).toEqual({ status: "miss", port: 80, identified: null });
});
