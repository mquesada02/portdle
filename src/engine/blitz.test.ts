import { beforeEach, expect, test } from "vitest";
import {
	buildRun,
	prependRun,
	reduceBlitz,
	replacesBest,
	startBlitz,
} from "./blitz";
import { digitLength } from "./guess";
import { chargen, http, telnet, vite } from "./test-fixtures";
import type { BlitzRun, BlitzState, CatalogEntry } from "./types";

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

// Today's three Daily answers, as the server's current Dailies name them.
const dailyIds = ["a", "http", "b"];

const rng = () => 0;
let nowMs = 0;
const now = () => nowMs;

beforeEach(() => {
	nowMs = 0;
});

function startMixed() {
	return startBlitz({
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		protocols: [http, chargen, telnet],
		applications: entries,
		dailyIds,
		rng,
		now,
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
			protocols: [http],
			applications: entries,
			dailyIds,
			rng,
			now,
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
		now,
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
		now,
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
		now,
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
		protocols: [http, chargen, telnet],
		applications: entries,
		dailyIds,
		rng,
		now,
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
		now,
	});
	expect(next.guess).toEqual({ status: "miss", port: 80, identified: null });
});

test("protocols miss of an applications-only port is unidentified", () => {
	const started = startBlitz({
		category: "protocols",
		orientation: "default",
		mode: "sprint",
		protocols: [http, chargen, telnet, ssh],
		applications: [...entries, vite],
		dailyIds,
		rng,
		now,
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
		now,
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
		protocols: [http, chargen, telnet],
		applications: entries,
		dailyIds,
		rng,
		now,
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
		now,
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

test("committed correct round appends a round with no wrong answer", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const answer = entries.find((entry) => entry.id === started.currentId);
	if (!answer) {
		throw new Error("missing");
	}
	const next = reduceDefault(started, answer.port);
	expect(next.state.rounds).toEqual([
		{
			id: answer.id,
			name: answer.name,
			port: answer.port,
			outcome: "correct",
			wrong: null,
		},
	]);
});

test("default miss on an owned port appends a typed round with the owner", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const answer = entries.find((entry) => entry.id === started.currentId);
	if (!answer) {
		throw new Error("missing");
	}
	const next = reduceDefault(started, 80);
	expect(next.state.rounds).toEqual([
		{
			id: answer.id,
			name: answer.name,
			port: answer.port,
			outcome: "miss",
			wrong: {
				kind: "typed",
				port: 80,
				owner: { id: "http", name: "HTTP", port: 80 },
			},
		},
	]);
});

test("default miss on an unowned port appends a typed round with no owner", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const answer = entries.find((entry) => entry.id === started.currentId);
	if (!answer) {
		throw new Error("missing");
	}
	const next = reduceDefault(started, 9999);
	expect(next.state.rounds).toEqual([
		{
			id: answer.id,
			name: answer.name,
			port: answer.port,
			outcome: "miss",
			wrong: { kind: "typed", port: 9999, owner: null },
		},
	]);
});

test("inverted miss appends a picked round", () => {
	const started = startMixedInverted();
	if ("error" in started) {
		throw new Error("empty");
	}
	const answer = entries.find((entry) => entry.id === started.currentId);
	if (!answer) {
		throw new Error("missing");
	}
	const next = reduceInverted(started, "http");
	expect(next.state.rounds).toEqual([
		{
			id: answer.id,
			name: answer.name,
			port: answer.port,
			outcome: "miss",
			wrong: { kind: "picked", pick: { id: "http", name: "HTTP", port: 80 } },
		},
	]);
});

test("same-port inverted pick still appends a picked round", () => {
	const portA: CatalogEntry = {
		id: "port-a",
		name: "Port A",
		port: 9200,
		transport: "tcp",
		description: "port-a",
		answerEligible: true,
	};
	const portB: CatalogEntry = {
		id: "port-b",
		name: "Port B",
		port: 9200,
		transport: "tcp",
		description: "port-b",
		answerEligible: true,
	};
	const started = startBlitz({
		category: "applications",
		orientation: "inverted",
		mode: "sprint",
		protocols: [],
		applications: [portA, portB],
		dailyIds,
		rng,
		now,
	});
	if ("error" in started) {
		throw new Error("empty");
	}
	const answer = [portA, portB].find((entry) => entry.id === started.currentId);
	const pick = [portA, portB].find((entry) => entry.id !== started.currentId);
	if (!answer || !pick) {
		throw new Error("missing");
	}
	const next = reduceBlitz({
		state: started,
		event: { type: "inverted-guess", id: pick.id },
		protocols: [],
		applications: [portA, portB],
		rng,
		now,
	});
	expect(next.state.rounds).toEqual([
		{
			id: answer.id,
			name: answer.name,
			port: answer.port,
			outcome: "miss",
			wrong: {
				kind: "picked",
				pick: { id: pick.id, name: pick.name, port: pick.port },
			},
		},
	]);
});

test("invalid guess appends nothing to rounds", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const next = reduceDefault(started, "12");
	expect(next.state.rounds).toEqual([]);
});

test("timeout appends nothing to rounds", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const timed = reduceBlitz({
		state: started,
		event: { type: "timeout" },
		protocols: [http, chargen, telnet],
		applications: entries,
		rng,
		now,
	});
	expect(timed.state.rounds).toEqual([]);
});

test("round number reads 3 after two committed rounds", () => {
	const started = startMixed();
	if ("error" in started) {
		throw new Error("empty");
	}
	const firstAnswer = entries.find((entry) => entry.id === started.currentId);
	if (!firstAnswer) {
		throw new Error("missing");
	}
	const afterFirst = reduceDefault(started, firstAnswer.port);
	const secondAnswer = entries.find(
		(entry) => entry.id === afterFirst.state.currentId,
	);
	if (!secondAnswer) {
		throw new Error("missing");
	}
	const afterSecond = reduceDefault(afterFirst.state, secondAnswer.port);
	expect(afterSecond.state.rounds.length + 1).toBe(3);
});

const clock = () => "2026-09-09T12:00:00.000Z";

function endedState(overrides: Partial<BlitzState>): BlitzState {
	return {
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		lives: 0,
		score: 2,
		remainingIds: [],
		currentId: "a",
		startPool: ["a", "b"],
		ended: "lives",
		rounds: [
			{ id: "a", name: "A", port: 4000, outcome: "correct", wrong: null },
		],
		startedAtMs: 0,
		timeToScoreMs: 1500,
		...overrides,
	};
}

test("buildRun snapshots the setup end reason score and rounds from a lives-ended state", () => {
	const state = endedState({});
	expect(buildRun({ state, clock })).toEqual({
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		ended: "lives",
		endedAt: "2026-09-09T12:00:00.000Z",
		score: 2,
		timeToScoreMs: 1500,
		rounds: state.rounds,
	});
});

test("buildRun reflects a timeout-ended state and the clock's instant", () => {
	const state = endedState({
		category: "protocols",
		orientation: "inverted",
		mode: "marathon",
		ended: "timeout",
		score: 0,
		timeToScoreMs: 0,
		rounds: [],
	});
	expect(buildRun({ state, clock })).toEqual({
		category: "protocols",
		orientation: "inverted",
		mode: "marathon",
		ended: "timeout",
		endedAt: "2026-09-09T12:00:00.000Z",
		score: 0,
		timeToScoreMs: 0,
		rounds: [],
	});
});

function fakeRun(endedAt: string): BlitzRun {
	return {
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		ended: "timeout",
		endedAt,
		score: 0,
		rounds: [],
	};
}

test("prependRun adds a run to the front without dropping any under fifty", () => {
	const runs = [fakeRun("2026-09-08T12:00:00.000Z")];
	const next = prependRun(runs, fakeRun("2026-09-09T12:00:00.000Z"));
	expect(next).toEqual([
		fakeRun("2026-09-09T12:00:00.000Z"),
		fakeRun("2026-09-08T12:00:00.000Z"),
	]);
});

test("prependRun keeps exactly fifty newest first dropping the oldest", () => {
	const runs = Array.from({ length: 50 }, (_, index) =>
		fakeRun(`run-${index}`),
	);
	const next = prependRun(runs, fakeRun("newest"));
	expect(next.length).toBe(50);
	expect(next[0]).toEqual(fakeRun("newest"));
	expect(next.at(-1)).toEqual(fakeRun("run-48"));
});

function startTimed(
	orientation: "default" | "inverted",
	mode: "sprint" | "survival",
) {
	nowMs = 1000;
	const started = startBlitz({
		category: "mixed",
		orientation,
		mode,
		protocols: [http, chargen, telnet],
		applications: entries,
		dailyIds,
		rng,
		now,
	});
	if ("error" in started) {
		throw new Error("empty");
	}
	return started;
}

function answerPort(state: BlitzState): number {
	const answer = [...entries, http].find(
		(entry) => entry.id === state.currentId,
	);
	if (!answer) {
		throw new Error("missing");
	}
	return answer.port;
}

test("a new run has time to score zero", () => {
	const started = startTimed("default", "sprint");
	expect(started.startedAtMs).toBe(1000);
	expect(started.timeToScoreMs).toBe(0);
});

test("a correct default round sets time to score to the elapsed time", () => {
	const started = startTimed("default", "sprint");
	nowMs = 3500;
	const next = reduceDefault(started, answerPort(started));
	expect(next.state.timeToScoreMs).toBe(2500);
	nowMs = 9000;
	const second = reduceDefault(next.state, answerPort(next.state));
	expect(second.state.timeToScoreMs).toBe(8000);
});

test("a correct inverted round in Survival sets time to score to the elapsed time", () => {
	const started = startTimed("inverted", "survival");
	nowMs = 1750;
	const next = reduceInverted(started, started.currentId);
	expect(next.state.score).toBe(1);
	expect(next.state.timeToScoreMs).toBe(750);
});

test("a miss, an invalid guess, a duplicate guess, and a timeout keep time to score", () => {
	const started = startTimed("default", "sprint");
	nowMs = 2000;
	const scored = reduceDefault(started, answerPort(started)).state;
	nowMs = 5000;
	const wrongPort = answerPort(scored) === 9999 ? 9998 : 9999;
	const missed = reduceDefault(scored, wrongPort).state;
	expect(missed.timeToScoreMs).toBe(1000);
	const invalid = reduceDefault(missed, "1").state;
	expect(invalid.timeToScoreMs).toBe(1000);
	nowMs = 7000;
	const timedOut = reduceBlitz({
		state: missed,
		event: { type: "timeout" },
		protocols: [http, chargen, telnet],
		applications: entries,
		rng,
		now,
	}).state;
	expect(timedOut.timeToScoreMs).toBe(1000);
	expect(buildRun({ state: timedOut, clock }).timeToScoreMs).toBe(1000);
});

test("a run with no correct answer builds a stored run with time zero", () => {
	const started = startTimed("default", "sprint");
	nowMs = 4000;
	const timedOut = reduceBlitz({
		state: started,
		event: { type: "timeout" },
		protocols: [http, chargen, telnet],
		applications: entries,
		rng,
		now,
	}).state;
	expect(buildRun({ state: timedOut, clock }).timeToScoreMs).toBe(0);
});

test("replacesBest follows the Best replacement rule", () => {
	const timed = { score: 5, timeToScoreMs: 30000 };
	const cases: Array<[string, Parameters<typeof replacesBest>[0], boolean]> = [
		["no Best", { best: undefined, score: 1, timeToScoreMs: 5 }, true],
		[
			"no Best and zero score",
			{ best: undefined, score: 0, timeToScoreMs: 0 },
			true,
		],
		[
			"higher score, slower time",
			{ best: timed, score: 6, timeToScoreMs: 59000 },
			true,
		],
		[
			"lower score, faster time",
			{ best: timed, score: 4, timeToScoreMs: 1 },
			false,
		],
		[
			"equal score, faster time",
			{ best: timed, score: 5, timeToScoreMs: 29999 },
			true,
		],
		[
			"equal score, equal time",
			{ best: timed, score: 5, timeToScoreMs: 30000 },
			false,
		],
		[
			"equal score, slower time",
			{ best: timed, score: 5, timeToScoreMs: 30001 },
			false,
		],
		[
			"equal score against an untimed Best",
			{ best: { score: 5 }, score: 5, timeToScoreMs: 59000 },
			true,
		],
		[
			"zero score against an untimed zero Best",
			{ best: { score: 0 }, score: 0, timeToScoreMs: 0 },
			true,
		],
		[
			"lower score against an untimed Best",
			{ best: { score: 5 }, score: 4, timeToScoreMs: 1 },
			false,
		],
	];
	for (const [name, input, expected] of cases) {
		expect(replacesBest(input), name).toBe(expected);
	}
});

test("a retired entry is never a miss identification in a Blitz round", () => {
	const old: CatalogEntry = { ...ssh, id: "old", port: 4003, retired: true };
	const started = startBlitz({
		category: "applications",
		orientation: "default",
		mode: "sprint",
		dailyIds: [],
		protocols: [],
		applications: [entries[0] as CatalogEntry, old],
		rng,
		now,
	});
	if ("error" in started) {
		throw new Error("empty");
	}
	const { guess } = reduceBlitz({
		state: started,
		event: { type: "default-guess", digits: "4003" },
		protocols: [],
		applications: [entries[0] as CatalogEntry, old],
		rng,
		now,
	});
	expect(guess).toEqual({ status: "miss", port: 4003, identified: null });
});
