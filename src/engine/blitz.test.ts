import { expect, test } from "vitest";
import { reduceBlitz, startBlitz } from "./blitz";
import { digitLength } from "./guess";
import { chargen, http, telnet, vite } from "./test-fixtures";
import type { CatalogEntry, ScheduleFile } from "./types";

const entries: CatalogEntry[] = ["a", "b", "c", "d"].map((id, index) => ({
	id,
	name: id.toUpperCase(),
	port: 4000 + index,
	transport: "tcp",
	description: id,
	answerEligible: true,
}));
const ssh: CatalogEntry = {
	id: "ssh",
	name: "SSH",
	port: 2222,
	transport: "tcp",
	description: "ssh",
	answerEligible: true,
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
		protocols: [http, chargen, telnet],
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
			protocols: [http],
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
	const answer = [...entries, http, chargen, telnet, ssh, vite].find(
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
		protocols: [http, chargen, telnet],
		applications: entries,
		rng,
	});
}

test("correct default-guess increments score and changes currentId", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const answer = entries.find((entry) => entry.id === started.currentId);
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
	const firstAnswer = entries.find((entry) => entry.id === started.currentId);
	if (!firstAnswer) {
		throw new Error("missing");
	}
	const scored = reduceDefault(started, firstAnswer.port);
	const timed = reduceBlitz({
		state: scored.state,
		event: { type: "timeout" },
		protocols: [http, chargen, telnet],
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
	const firstAnswer = entries.find((entry) => entry.id === started.currentId);
	if (!firstAnswer) {
		throw new Error("missing");
	}
	const afterFirst = reduceDefault(started, firstAnswer.port);
	expect(afterFirst.state.remainingIds).toEqual([]);
	const secondAnswer = entries.find(
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
		protocols: [http, chargen, telnet],
		applications: entries,
		rng,
	});
	const again = reduceDefault(ended.state, 80);
	expect(again.state).toEqual(ended.state);
	expect(again.guess).toBeUndefined();
});

test("applications miss of a protocols-only port is unidentified", () => {
	const started = startBlitz({
		category: "applications",
		orientation: "default",
		mode: "sprint",
		utcToday: "2026-09-09",
		protocols: [http, chargen, telnet],
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
		protocols: [http, chargen, telnet],
		applications: entries,
		rng,
	});
	expect(next.guess).toEqual({ status: "miss", port: 80, identified: null });
});

test("protocols miss of an applications-only port is unidentified", () => {
	const started = startBlitz({
		category: "protocols",
		orientation: "default",
		mode: "sprint",
		utcToday: "2026-09-09",
		protocols: [http, chargen, telnet, ssh],
		applications: [...entries, vite],
		schedules,
		rng,
	});
	if ("error" in started) {
		throw new Error("empty");
	}
	expect(started.currentId).toBe("ssh");
	const next = reduceBlitz({
		state: started,
		event: { type: "default-guess", digits: padFor(started, 5173) },
		protocols: [http, chargen, telnet, ssh],
		applications: [...entries, vite],
		rng,
	});
	expect(next.guess).toEqual({
		status: "miss",
		port: 5173,
		identified: null,
	});
});

function startMixedInverted() {
	return startBlitz({
		category: "mixed",
		orientation: "inverted",
		mode: "sprint",
		utcToday: "2026-09-09",
		protocols: [http, chargen, telnet],
		applications: entries,
		schedules,
		rng,
	});
}

function reduceInverted(
	state: Exclude<
		ReturnType<typeof startMixedInverted>,
		{ error: "empty-pool" }
	>,
	id: string,
) {
	return reduceBlitz({
		state,
		event: { type: "inverted-guess", id },
		protocols: [http, chargen, telnet],
		applications: entries,
		rng,
	});
}

test("inverted start records orientation and excludes daily ids", () => {
	const started = startMixedInverted();
	if ("error" in started) {
		throw new Error("empty");
	}
	expect(started.orientation).toBe("inverted");
	const ids = [started.currentId, ...started.remainingIds];
	expect(ids.sort()).toEqual(["c", "d"]);
});

test("inverted correct increments score and changes currentId", () => {
	const started = startMixedInverted();
	if ("error" in started) {
		throw new Error("empty");
	}
	const next = reduceInverted(started, started.currentId);
	expect(next.inverted).toEqual({ status: "correct", id: started.currentId });
	expect(next.state.score).toBe(1);
	expect(next.state.lives).toBe(3);
	expect(next.state.currentId).not.toBe(started.currentId);
});

test("inverted miss decrements lives and advances", () => {
	const started = startMixedInverted();
	if ("error" in started) {
		throw new Error("empty");
	}
	const next = reduceInverted(started, "http");
	expect(next.state.lives).toBe(2);
	expect(next.state.score).toBe(0);
	expect(next.state.currentId).not.toBe(started.currentId);
	expect(next.inverted).toMatchObject({
		status: "miss",
		id: "http",
		samePort: false,
		identified: { id: "http", name: "HTTP", port: 80 },
	});
});

test("miss when remainingIds is empty reshuffles startPool", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const firstAnswer = entries.find((entry) => entry.id === started.currentId);
	if (!firstAnswer) {
		throw new Error("missing");
	}
	const afterFirst = reduceDefault(started, firstAnswer.port);
	expect(afterFirst.state.remainingIds).toEqual([]);
	const afterMiss = reduceDefault(afterFirst.state, 80);
	expect(afterMiss.state.ended).toBeNull();
	expect(afterMiss.state.lives).toBe(2);
	expect(afterMiss.state.currentId).toBeTruthy();
	expect(
		[afterMiss.state.currentId, ...afterMiss.state.remainingIds].sort(),
	).toEqual(["c", "d"]);
});
