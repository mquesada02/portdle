import { expect, test } from "vitest";
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

test("lastSeenUtc round-trips and corrupt is null", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	expect(persist.readLastSeenUtc()).toBeNull();
	expect(persist.writeLastSeenUtc("2026-09-09")).toEqual({ ok: true });
	expect(persist.readLastSeenUtc()).toBe("2026-09-09");
	store.data.set("portdle:v1:lastSeenUtc", "{not json");
	expect(persist.readLastSeenUtc()).toBeNull();
});
