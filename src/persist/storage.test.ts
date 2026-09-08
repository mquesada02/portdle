import { expect, test } from "vitest";
import { createPersist, type KeyValueStore } from "./storage";

function memoryStore(
	data: Map<string, string> = new Map(),
): KeyValueStore & { data: Map<string, string> } {
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => {
			data.set(key, value);
		},
	};
}

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
});
