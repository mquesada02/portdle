import { expect, test } from "vitest";
import type { BlitzRun } from "../engine/types";
import { memoryStore } from "../test/helpers";
import { createPersist } from "./storage";

test("readTheme defaults to system", () => {
	const persist = createPersist(memoryStore());
	expect(persist.readTheme()).toBe("system");
});

test("theme round-trips light and dark", () => {
	const persist = createPersist(memoryStore());
	expect(persist.writeTheme("light")).toEqual({ ok: true });
	expect(persist.readTheme()).toBe("light");
	expect(persist.writeTheme("dark")).toEqual({ ok: true });
	expect(persist.readTheme()).toBe("dark");
});

test("how-to is unseen by default and latches after write", () => {
	const persist = createPersist(memoryStore());
	expect(persist.readHowToSeen()).toBe(false);
	expect(persist.writeHowToSeen()).toEqual({ ok: true });
	expect(persist.readHowToSeen()).toBe(true);
});

test("corrupt JSON for one key is ignored without affecting the other", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeTheme("dark")).toEqual({ ok: true });
	store.data.set("portdle:v1:howToSeen", "{not json");
	expect(persist.readHowToSeen()).toBe(false);
	expect(persist.readTheme()).toBe("dark");
	store.data.set("portdle:v1:theme", "{not json");
	expect(persist.readTheme()).toBe("system");
	expect(persist.writeHowToSeen()).toEqual({ ok: true });
	expect(persist.readHowToSeen()).toBe(true);
});

test("setItem throw returns ok false", () => {
	const persist = createPersist({
		getItem: () => null,
		setItem: () => {
			throw new Error("quota");
		},
	});
	expect(persist.writeTheme("dark")).toEqual({ ok: false });
	expect(persist.writeHowToSeen()).toEqual({ ok: false });
	expect(
		persist.writeDaily("mixed", "2026-09-09", {
			status: "playing",
			guesses: [{ port: 80, result: "miss", identified: null }],
		}),
	).toEqual({ ok: false });
	expect(
		persist.writeStats("mixed", {
			played: 1,
			wins: 1,
			currentStreak: 1,
			bestStreak: 1,
			histogram: [1, 0, 0, 0, 0, 0],
		}),
	).toEqual({ ok: false });
	expect(persist.writeLastPlayed("mixed", "2026-09-09")).toEqual({ ok: false });
	expect(persist.writeLastSeenUtc("2026-09-09")).toEqual({ ok: false });
});

test("mixed daily round-trips and corrupt daily is ignored", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	const board = {
		status: "playing" as const,
		guesses: [{ port: 80, result: "miss" as const, identified: null }],
	};
	expect(persist.readDaily("mixed", "2026-09-09")).toBeNull();
	expect(persist.writeDaily("mixed", "2026-09-09", board)).toEqual({
		ok: true,
	});
	expect(persist.readDaily("mixed", "2026-09-09")).toEqual(board);
	expect(store.data.has("portdle:v1:daily:mixed:2026-09-09")).toBe(true);
	expect(persist.writeTheme("dark")).toEqual({ ok: true });
	store.data.set("portdle:v1:daily:mixed:2026-09-09", "{not json");
	expect(persist.readDaily("mixed", "2026-09-09")).toBeNull();
	expect(persist.readTheme()).toBe("dark");
});

test("mixed stats and lastPlayed round-trip without protocols keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	const stats = {
		played: 1,
		wins: 1,
		currentStreak: 1,
		bestStreak: 1,
		histogram: [0, 0, 1, 0, 0, 0] as [
			number,
			number,
			number,
			number,
			number,
			number,
		],
	};
	expect(persist.readStats("mixed")).toBeNull();
	expect(persist.writeStats("mixed", stats)).toEqual({ ok: true });
	expect(persist.readStats("mixed")).toEqual(stats);
	expect(persist.writeLastPlayed("mixed", "2026-09-09")).toEqual({ ok: true });
	expect(persist.readLastPlayed("mixed")).toBe("2026-09-09");
	expect(store.data.has("portdle:v1:stats:mixed")).toBe(true);
	expect(store.data.has("portdle:v1:lastPlayed:mixed")).toBe(true);
	expect(store.data.has("portdle:v1:stats:protocols")).toBe(false);
	expect(store.data.has("portdle:v1:lastPlayed:protocols")).toBe(false);
	expect(persist.readStats("protocols")).toBeNull();
});

test("protocols daily and stats round-trip without mixed or applications keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	const board = {
		status: "playing" as const,
		guesses: [{ port: 22, result: "miss" as const, identified: null }],
	};
	const stats = {
		played: 1,
		wins: 1,
		currentStreak: 1,
		bestStreak: 1,
		histogram: [1, 0, 0, 0, 0, 0] as [
			number,
			number,
			number,
			number,
			number,
			number,
		],
	};
	expect(persist.writeDaily("protocols", "2026-09-09", board)).toEqual({
		ok: true,
	});
	expect(persist.readDaily("protocols", "2026-09-09")).toEqual(board);
	expect(persist.writeStats("protocols", stats)).toEqual({ ok: true });
	expect(persist.writeLastPlayed("protocols", "2026-09-09")).toEqual({
		ok: true,
	});
	expect(store.data.has("portdle:v1:daily:protocols:2026-09-09")).toBe(true);
	expect(store.data.has("portdle:v1:stats:protocols")).toBe(true);
	expect(store.data.has("portdle:v1:stats:mixed")).toBe(false);
	expect(store.data.has("portdle:v1:stats:applications")).toBe(false);
});

test("applications daily and stats round-trip without mixed keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(
		persist.writeDaily("applications", "2026-09-09", {
			status: "won",
			guesses: [{ port: 5173, result: "correct", identified: null }],
		}),
	).toEqual({ ok: true });
	expect(persist.readDaily("applications", "2026-09-09")?.status).toBe("won");
	expect(store.data.has("portdle:v1:daily:mixed:2026-09-09")).toBe(false);
});

test("blitzBests missing is empty object and round-trips", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.readBlitzBests()).toEqual({});
	expect(persist.writeBlitzBests({ "mixed|default|sprint": 4 })).toEqual({
		ok: true,
	});
	expect(persist.readBlitzBests()).toEqual({ "mixed|default|sprint": 4 });
	expect(store.data.has("portdle:v1:blitzBests")).toBe(true);
});

test("inverted blitzBests round-trip without dropping default", () => {
	const persist = createPersist(memoryStore());
	expect(
		persist.writeBlitzBests({
			"mixed|default|sprint": 4,
			"mixed|inverted|sprint": 4,
		}),
	).toEqual({ ok: true });
	expect(persist.readBlitzBests()).toEqual({
		"mixed|default|sprint": 4,
		"mixed|inverted|sprint": 4,
	});
});

test("corrupt blitzBests is empty without dropping theme", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeTheme("dark")).toEqual({ ok: true });
	store.data.set("portdle:v1:blitzBests", "{not json");
	expect(persist.readBlitzBests()).toEqual({});
	expect(persist.readTheme()).toBe("dark");
});

test("writing blitzBests does not write daily or stats keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeBlitzBests({ "mixed|default|sprint": 2 })).toEqual({
		ok: true,
	});
	expect(store.data.has("portdle:v1:daily:mixed:2026-09-09")).toBe(false);
	expect(store.data.has("portdle:v1:stats:mixed")).toBe(false);
});

test("writeBlitzBests setItem throw returns ok false", () => {
	const persist = createPersist({
		getItem: () => null,
		setItem: () => {
			throw new Error("quota");
		},
	});
	expect(persist.writeBlitzBests({ "mixed|default|sprint": 1 })).toEqual({
		ok: false,
	});
});

test("lastSeenUtc round-trips and corrupt is null", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.readLastSeenUtc()).toBeNull();
	expect(persist.writeLastSeenUtc("2026-09-09")).toEqual({ ok: true });
	expect(persist.readLastSeenUtc()).toBe("2026-09-09");
	store.data.set("portdle:v1:lastSeenUtc", "{not json");
	expect(persist.readLastSeenUtc()).toBeNull();
});

function fakeRun(): BlitzRun {
	return {
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		ended: "timeout",
		endedAt: "2026-09-09T12:00:00.000Z",
		score: 2,
		rounds: [
			{ id: "http", name: "HTTP", port: 80, outcome: "correct", wrong: null },
		],
	};
}

test("blitzRuns missing is empty array and round-trips", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.readBlitzRuns()).toEqual([]);
	const run = fakeRun();
	expect(persist.writeBlitzRuns([run])).toEqual({ ok: true });
	expect(persist.readBlitzRuns()).toEqual([run]);
	expect(store.data.has("portdle:v1:blitzRuns")).toBe(true);
});

test("corrupt JSON blitzRuns reads as no runs without dropping theme", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeTheme("dark")).toEqual({ ok: true });
	store.data.set("portdle:v1:blitzRuns", "{not json");
	expect(persist.readBlitzRuns()).toEqual([]);
	expect(persist.readTheme()).toBe("dark");
});

test("non-array blitzRuns reads as no runs", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	store.data.set("portdle:v1:blitzRuns", JSON.stringify({ not: "array" }));
	expect(persist.readBlitzRuns()).toEqual([]);
});

test("a run missing rounds reads the whole blitzRuns value as no runs", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	const { rounds: _rounds, ...withoutRounds } = fakeRun();
	store.data.set("portdle:v1:blitzRuns", JSON.stringify([withoutRounds]));
	expect(persist.readBlitzRuns()).toEqual([]);
});

test("writing blitzRuns does not write daily or stats keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeBlitzRuns([fakeRun()])).toEqual({ ok: true });
	expect(store.data.has("portdle:v1:daily:mixed:2026-09-09")).toBe(false);
	expect(store.data.has("portdle:v1:stats:mixed")).toBe(false);
});

test("writeBlitzRuns setItem throw returns ok false", () => {
	const persist = createPersist({
		getItem: () => null,
		setItem: () => {
			throw new Error("quota");
		},
	});
	expect(persist.writeBlitzRuns([fakeRun()])).toEqual({ ok: false });
});

test("codex missing is empty object and round-trips", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.readCodex()).toEqual({});
	expect(
		persist.writeCodex({ http: { state: "correct", fresh: true } }),
	).toEqual({ ok: true });
	expect(persist.readCodex()).toEqual({
		http: { state: "correct", fresh: true },
	});
	expect(store.data.has("portdle:v1:codex")).toBe(true);
});

test("a codex record with a state outside identified, missed, and correct reads as empty", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	store.data.set(
		"portdle:v1:codex",
		JSON.stringify({ http: { state: "seen", fresh: true } }),
	);
	expect(persist.readCodex()).toEqual({});
});

test("corrupt codex JSON is empty without dropping theme", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeTheme("dark")).toEqual({ ok: true });
	store.data.set("portdle:v1:codex", "{not json");
	expect(persist.readCodex()).toEqual({});
	expect(persist.readTheme()).toBe("dark");
});

test("writing codex does not write daily, stats, or blitzBests keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(
		persist.writeCodex({ http: { state: "missed", fresh: false } }),
	).toEqual({ ok: true });
	expect(store.data.has("portdle:v1:daily:mixed:2026-09-09")).toBe(false);
	expect(store.data.has("portdle:v1:stats:mixed")).toBe(false);
	expect(store.data.has("portdle:v1:blitzBests")).toBe(false);
});

test("writeCodex setItem throw returns ok false", () => {
	const persist = createPersist({
		getItem: () => null,
		setItem: () => {
			throw new Error("quota");
		},
	});
	expect(
		persist.writeCodex({ http: { state: "correct", fresh: true } }),
	).toEqual({ ok: false });
});
