import { expect, test } from "vitest";
import { dailyKey } from "../engine/daily-key";
import type { BlitzRun, DailyPersist } from "../engine/types";
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

test("applications daily round-trips without mixed keys", () => {
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
	expect(persist.readBlitzBests()).toEqual({
		"mixed|default|sprint": { score: 4 },
	});
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
		"mixed|default|sprint": { score: 4 },
		"mixed|inverted|sprint": { score: 4 },
	});
});

test("blitzBests round-trip a Best with a time and read a bare score as untimed", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	persist.writeBlitzBests({
		"mixed|default|sprint": { score: 4, timeToScoreMs: 20000 },
		"mixed|default|marathon": 7,
	});
	expect(persist.readBlitzBests()).toEqual({
		"mixed|default|sprint": { score: 4, timeToScoreMs: 20000 },
		"mixed|default|marathon": { score: 7 },
	});
	expect(store.data.get("portdle:v1:blitzBests")).toBe(
		JSON.stringify({
			"mixed|default|sprint": { score: 4, timeToScoreMs: 20000 },
			"mixed|default|marathon": 7,
		}),
	);
});

test("a Best with a non-number time or a missing score makes blitzBests read empty", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	store.data.set(
		"portdle:v1:blitzBests",
		JSON.stringify({
			"mixed|default|sprint": { score: 4, timeToScoreMs: "9" },
		}),
	);
	expect(persist.readBlitzBests()).toEqual({});
	store.data.set(
		"portdle:v1:blitzBests",
		JSON.stringify({ "mixed|default|sprint": { timeToScoreMs: 9 } }),
	);
	expect(persist.readBlitzBests()).toEqual({});
});

test("corrupt blitzBests is empty without dropping theme", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeTheme("dark")).toEqual({ ok: true });
	store.data.set("portdle:v1:blitzBests", "{not json");
	expect(persist.readBlitzBests()).toEqual({});
	expect(persist.readTheme()).toBe("dark");
});

test("writing blitzBests does not write daily keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeBlitzBests({ "mixed|default|sprint": 2 })).toEqual({
		ok: true,
	});
	expect(store.data.has("portdle:v1:daily:mixed:2026-09-09")).toBe(false);
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

test("blitzRuns load with or without a time to score and reject a non-number time", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	const timed = { ...fakeRun(), timeToScoreMs: 1200 };
	persist.writeBlitzRuns([timed, fakeRun()]);
	expect(persist.readBlitzRuns()).toEqual([timed, fakeRun()]);
	store.data.set(
		"portdle:v1:blitzRuns",
		JSON.stringify([{ ...fakeRun(), timeToScoreMs: "1200" }]),
	);
	expect(persist.readBlitzRuns()).toEqual([]);
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

test("writing blitzRuns does not write daily keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeBlitzRuns([fakeRun()])).toEqual({ ok: true });
	expect(store.data.has("portdle:v1:daily:mixed:2026-09-09")).toBe(false);
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

test("writing codex does not write daily or blitzBests keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(
		persist.writeCodex({ http: { state: "missed", fresh: false } }),
	).toEqual({ ok: true });
	expect(store.data.has("portdle:v1:daily:mixed:2026-09-09")).toBe(false);
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

test("writing codexSort does not touch daily, blitzBests, or codex keys", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.writeCodexSort("port")).toEqual({ ok: true });
	expect(store.data.has("portdle:v1:daily:mixed:2026-09-09")).toBe(false);
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
	persist.writeDaily("mixed", "2026-09-09", { status: "playing", guesses: [] });
	expect(seen).toEqual([
		{ kind: "theme" },
		{ kind: "howToSeen" },
		{ kind: "codexSort" },
		{ kind: "codex" },
		{ kind: "blitzBests" },
		{ kind: "blitzRuns" },
		{ kind: "daily", category: "mixed", date: "2026-09-09" },
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

test("readPreferences returns only the stored valid preferences", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.readPreferences()).toEqual({});
	store.setItem("portdle:v1:theme", JSON.stringify("purple"));
	store.setItem("portdle:v1:howToSeen", JSON.stringify(false));
	store.setItem("portdle:v1:codexSort", JSON.stringify("size"));
	expect(persist.readPreferences()).toEqual({});
	persist.writeTheme("dark");
	persist.writeHowToSeen();
	persist.writeCodexSort("name");
	expect(persist.readPreferences()).toEqual({
		theme: "dark",
		howToSeen: true,
		codexSort: "name",
	});
});

const MISS = { port: 80, result: "miss" as const, identified: null };

test("a daily record round-trips its late mark and refuses a late that is not a boolean", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	for (const late of [true, false]) {
		const board: DailyPersist = { status: "playing", guesses: [MISS], late };
		persist.writeDaily("mixed", "2026-09-09", board);
		expect(persist.readDaily("mixed", "2026-09-09")).toEqual(board);
	}
	store.data.set(
		"portdle:v1:daily:mixed:2026-09-09",
		JSON.stringify({ status: "playing", guesses: [], late: "yes" }),
	);
	expect(persist.readDaily("mixed", "2026-09-09")).toBeNull();
	store.data.set(
		"portdle:v1:daily:mixed:2026-09-09",
		JSON.stringify({ status: "playing", guesses: [] }),
	);
	expect(persist.readDaily("mixed", "2026-09-09")?.late).toBeUndefined();
});

function seedSwitchOver() {
	const store = memoryStore();
	const persist = createPersist(store);
	store.data.set("portdle:v1:stats:mixed", "{}");
	store.data.set("portdle:v1:stats:protocols", "{}");
	store.data.set("portdle:v1:lastPlayed:applications", '"2026-09-30"');
	store.data.set("portdle:v1:lastSeenUtc", '"2026-09-30"');
	persist.writeDaily("mixed", "2026-09-30", { status: "won", guesses: [MISS] });
	persist.writeDaily("mixed", "2026-10-01", {
		status: "playing",
		guesses: [MISS],
	});
	persist.writeDaily("protocols", "2026-10-02", {
		status: "playing",
		guesses: [MISS],
	});
	persist.writeDaily("applications", "2026-10-02", {
		status: "playing",
		guesses: [MISS],
		late: true,
	});
	persist.writeSyncChanges({
		codex: ["http"],
		bests: [],
		runs: [],
		dailies: [
			dailyKey("mixed", "2026-09-30"),
			dailyKey("protocols", "2026-10-02"),
			dailyKey("applications", "2026-10-02"),
		],
		preferences: [],
	});
	store.data.set("other:key", "kept");
	return { store, persist };
}

test("applySwitchOver marks records on or before the day, discards later unmarked ones, and drops their pending entries", () => {
	const { store, persist } = seedSwitchOver();
	expect(persist.applySwitchOver("2026-10-01")).toEqual({ ok: true });
	expect(persist.readDaily("mixed", "2026-09-30")?.late).toBe(false);
	expect(persist.readDaily("mixed", "2026-10-01")?.late).toBe(false);
	expect(persist.readDaily("protocols", "2026-10-02")).toBeNull();
	expect(store.data.has("portdle:v1:daily:protocols:2026-10-02")).toBe(false);
	expect(persist.readDaily("applications", "2026-10-02")?.late).toBe(true);
	expect(persist.readSyncChanges()).toEqual({
		codex: ["http"],
		bests: [],
		runs: [],
		dailies: [
			dailyKey("mixed", "2026-09-30"),
			dailyKey("applications", "2026-10-02"),
		],
		preferences: [],
	});
});

test("applySwitchOver removes the stored stats keys and keeps other keys", () => {
	const { store, persist } = seedSwitchOver();
	persist.applySwitchOver("2026-10-01");
	for (const key of store.data.keys()) {
		expect(key).not.toMatch(/stats|lastPlayed|lastSeenUtc/);
	}
	expect(store.data.get("other:key")).toBe("kept");
});

test("applySwitchOver is idempotent and leaves a value that is not a record alone", () => {
	const { store, persist } = seedSwitchOver();
	store.data.set("portdle:v1:daily:mixed:2026-10-05", "{not json");
	persist.applySwitchOver("2026-10-01");
	const once = new Map(store.data);
	expect(persist.applySwitchOver("2026-10-01")).toEqual({ ok: true });
	expect(store.data).toEqual(once);
	expect(store.data.get("portdle:v1:daily:mixed:2026-10-05")).toBe("{not json");
});

test("applySwitchOver reports a failed write and finishes the rest", () => {
	const { store, persist } = seedSwitchOver();
	const failing = createPersist({
		...store,
		length: store.length,
		key: (index) => store.key(index),
		getItem: (key) => store.getItem(key),
		removeItem: (key) => store.removeItem(key),
		setItem: () => {
			throw new Error("quota");
		},
	});
	expect(failing.applySwitchOver("2026-10-01")).toEqual({ ok: false });
	expect(persist.readDaily("protocols", "2026-10-02")).toBeNull();
	expect(persist.applySwitchOver("2026-10-01")).toEqual({ ok: true });
	expect(persist.readDaily("mixed", "2026-09-30")?.late).toBe(false);
});
