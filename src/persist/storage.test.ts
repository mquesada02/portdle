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
		...memoryStore(),
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
		...memoryStore(),
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
		...memoryStore(),
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
		...memoryStore(),
		setItem: () => {
			throw new Error("quota");
		},
	});
	expect(
		persist.writeCodex({ http: { state: "correct", fresh: true } }),
	).toEqual({ ok: false });
});

test("codexSort missing is name and round-trips port", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.readCodexSort()).toBe("name");
	expect(persist.writeCodexSort("port")).toEqual({ ok: true });
	expect(persist.readCodexSort()).toBe("port");
	expect(store.data.has("portdle:v1:codexSort")).toBe(true);
});

test("a codexSort value outside name and port reads as name", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	store.data.set("portdle:v1:codexSort", JSON.stringify("port-asc"));
	expect(persist.readCodexSort()).toBe("name");
});

test("corrupt codexSort JSON is name without dropping theme", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeTheme("dark")).toEqual({ ok: true });
	store.data.set("portdle:v1:codexSort", "{not json");
	expect(persist.readCodexSort()).toBe("name");
	expect(persist.readTheme()).toBe("dark");
});

test("writing codexSort does not touch daily, stats, blitzBests, or codex keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeCodexSort("port")).toEqual({ ok: true });
	expect(store.data.has("portdle:v1:daily:mixed:2026-09-09")).toBe(false);
	expect(store.data.has("portdle:v1:stats:mixed")).toBe(false);
	expect(store.data.has("portdle:v1:blitzBests")).toBe(false);
	expect(store.data.has("portdle:v1:codex")).toBe(false);
});

test("writeCodexSort setItem throw returns ok false", () => {
	const persist = createPersist({
		...memoryStore(),
		setItem: () => {
			throw new Error("quota");
		},
	});
	expect(persist.writeCodexSort("port")).toEqual({ ok: false });
});

test("memoryStore removes keys and lists them through length and key", () => {
	const store = memoryStore();
	store.setItem("a", "1");
	store.setItem("b", "2");
	expect(store.length).toBe(2);
	expect([store.key(0), store.key(1)].sort()).toEqual(["a", "b"]);
	expect(store.key(2)).toBeNull();
	store.removeItem("a");
	expect(store.length).toBe(1);
	expect(store.getItem("a")).toBeNull();
});

test("listDailyDates lists one category's stored dates ascending", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	const board = { status: "playing" as const, guesses: [] };
	persist.writeDaily("mixed", "2026-09-10", board);
	persist.writeDaily("mixed", "2026-09-08", board);
	persist.writeDaily("protocols", "2026-09-09", board);
	persist.writeTheme("dark");
	store.setItem("portdle:v1:daily:mixed:junk", "{}");
	expect(persist.listDailyDates("mixed")).toEqual(["2026-09-08", "2026-09-10"]);
	expect(persist.listDailyDates("applications")).toEqual([]);
});

test("listDailyDates lists a date whose stored value is corrupt", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	store.setItem("portdle:v1:daily:mixed:2026-09-09", "{not json");
	expect(persist.listDailyDates("mixed")).toEqual(["2026-09-09"]);
	expect(persist.readDaily("mixed", "2026-09-09")).toBeNull();
});

test("sync changes default to empty lists and round-trip", () => {
	const persist = createPersist(memoryStore());
	const empty = {
		codex: [],
		bests: [],
		runs: [],
		dailies: [],
		preferences: [],
	};
	expect(persist.readSyncChanges()).toEqual(empty);
	const changes = {
		codex: ["http"],
		bests: ["mixed|default|sprint"],
		runs: ["2026-09-09T10:00:00.000Z"],
		dailies: ["mixed|2026-09-09"],
		preferences: ["theme"],
	};
	expect(persist.writeSyncChanges(changes)).toEqual({ ok: true });
	expect(persist.readSyncChanges()).toEqual(changes);
});

test("a corrupt sync changes value reads as empty; one bad list empties only itself", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	store.setItem("portdle:v1:syncChanges", "{not json");
	expect(persist.readSyncChanges().codex).toEqual([]);
	store.setItem(
		"portdle:v1:syncChanges",
		JSON.stringify({ codex: "http", bests: ["a", 1, "b"], runs: ["r"] }),
	);
	expect(persist.readSyncChanges()).toEqual({
		codex: [],
		bests: ["a", "b"],
		runs: ["r"],
		dailies: [],
		preferences: [],
	});
});

test("sync account defaults to null, round-trips, and reads a bad value as null", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.readSyncAccount()).toBeNull();
	expect(persist.writeSyncAccount("acct-1")).toEqual({ ok: true });
	expect(persist.readSyncAccount()).toBe("acct-1");
	store.setItem("portdle:v1:syncAccount", JSON.stringify(5));
	expect(persist.readSyncAccount()).toBeNull();
	store.setItem("portdle:v1:syncAccount", JSON.stringify(""));
	expect(persist.readSyncAccount()).toBeNull();
});

test("sync bookkeeping writes return ok false when the store throws", () => {
	const persist = createPersist({
		...memoryStore(),
		setItem: () => {
			throw new Error("quota");
		},
	});
	expect(
		persist.writeSyncChanges({
			codex: [],
			bests: [],
			runs: [],
			dailies: [],
			preferences: [],
		}),
	).toEqual({ ok: false });
	expect(persist.writeSyncAccount("a")).toEqual({ ok: false });
});

test("clearAll removes every portdle key, bookkeeping included, and keeps foreign keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	persist.writeTheme("dark");
	persist.writeDaily("mixed", "2026-09-09", { status: "playing", guesses: [] });
	persist.writeSyncAccount("acct-1");
	store.setItem("other:key", "keep");
	persist.clearAll();
	expect([...store.data.keys()]).toEqual(["other:key"]);
	expect(persist.readTheme()).toBe("system");
});

test("clearAll removes the remaining keys when one removal throws", () => {
	const store = memoryStore();
	const persist = createPersist({
		get length() {
			return store.length;
		},
		key: (index) => store.key(index),
		getItem: (key) => store.getItem(key),
		setItem: (key, value) => store.setItem(key, value),
		removeItem: (key) => {
			if (key === "portdle:v1:theme") {
				throw new Error("blocked");
			}
			store.removeItem(key);
		},
	});
	persist.writeTheme("dark");
	persist.writeHowToSeen();
	expect(() => persist.clearAll()).not.toThrow();
	expect(store.data.has("portdle:v1:howToSeen")).toBe(false);
});

test("onWrite reports each successful player-data write", () => {
	const persist = createPersist(memoryStore());
	const seen: unknown[] = [];
	persist.onWrite((change) => seen.push(change));
	persist.writeTheme("dark");
	persist.writeHowToSeen();
	persist.writeCodexSort("port");
	persist.writeCodex({});
	persist.writeBlitzBests({});
	persist.writeBlitzRuns([]);
	persist.writeLastSeenUtc("2026-09-09");
	persist.writeDaily("mixed", "2026-09-09", { status: "playing", guesses: [] });
	persist.writeStats("protocols", {
		played: 0,
		wins: 0,
		currentStreak: 0,
		bestStreak: 0,
		histogram: [0, 0, 0, 0, 0, 0],
	});
	persist.writeLastPlayed("applications", "2026-09-09");
	expect(seen).toEqual([
		{ kind: "theme" },
		{ kind: "howToSeen" },
		{ kind: "codexSort" },
		{ kind: "codex" },
		{ kind: "blitzBests" },
		{ kind: "blitzRuns" },
		{ kind: "lastSeenUtc" },
		{ kind: "daily", category: "mixed", date: "2026-09-09" },
		{ kind: "stats", category: "protocols" },
		{ kind: "lastPlayed", category: "applications" },
	]);
});

test("onWrite hears nothing from failed writes, bookkeeping writes, or clearAll", () => {
	const failing = createPersist({
		...memoryStore(),
		setItem: () => {
			throw new Error("quota");
		},
	});
	const failedSeen: unknown[] = [];
	failing.onWrite((change) => failedSeen.push(change));
	failing.writeTheme("dark");
	expect(failedSeen).toEqual([]);

	const persist = createPersist(memoryStore());
	const seen: unknown[] = [];
	persist.onWrite((change) => seen.push(change));
	persist.writeSyncAccount("a");
	persist.writeSyncChanges({
		codex: [],
		bests: [],
		runs: [],
		dailies: [],
		preferences: [],
	});
	persist.clearAll();
	expect(seen).toEqual([]);
});

test("onWrite keeps one listener: a second registration replaces the first, and unregistering stops it", () => {
	const persist = createPersist(memoryStore());
	const first: unknown[] = [];
	const second: unknown[] = [];
	const unregisterFirst = persist.onWrite((change) => first.push(change));
	const unregisterSecond = persist.onWrite((change) => second.push(change));
	persist.writeTheme("dark");
	expect(first).toEqual([]);
	expect(second).toEqual([{ kind: "theme" }]);
	unregisterFirst();
	persist.writeTheme("light");
	expect(second).toHaveLength(2);
	unregisterSecond();
	persist.writeTheme("dark");
	expect(second).toHaveLength(2);
});

test("a throwing listener does not fail the write", () => {
	const persist = createPersist(memoryStore());
	persist.onWrite(() => {
		throw new Error("listener");
	});
	expect(persist.writeTheme("dark")).toEqual({ ok: true });
	expect(persist.readTheme()).toBe("dark");
});
