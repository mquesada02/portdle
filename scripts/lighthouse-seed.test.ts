import { describe, expect, test } from "vitest";
import { SCHEDULE_DAYS } from "../gate/answers.ts";
import { SWITCH_OVER_DAY } from "../src/engine/switch-over.ts";
import { DAILY_CATEGORIES } from "../src/engine/types.ts";
import { createPersist, type KeyValueStore } from "../src/persist/storage.ts";
import { returningSeed } from "./lighthouse-seed.ts";

// An in-memory store with the seed in it.
function seededStore(): KeyValueStore {
	const data = new Map(Object.entries(returningSeed()));
	return {
		get length() {
			return data.size;
		},
		key: (index) => [...data.keys()][index] ?? null,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key),
	};
}

describe("returning seed", () => {
	test("reads back through the app's storage: every Schedule day in all three categories, 20 runs, the Bests, How-to seen", () => {
		const persist = createPersist(seededStore());
		for (const category of DAILY_CATEGORIES) {
			expect(persist.listDailyDates(category).sort()).toEqual(SCHEDULE_DAYS);
			for (const day of SCHEDULE_DAYS) {
				expect(persist.readDaily(category, day)).not.toBeNull();
			}
		}
		expect(persist.readBlitzRuns()).toHaveLength(20);
		expect(Object.keys(persist.readBlitzBests()).length).toBeGreaterThan(0);
		expect(persist.readHowToSeen()).toBe(true);
	});

	test("has won and lost records in every category", () => {
		const persist = createPersist(seededStore());
		for (const category of DAILY_CATEGORIES) {
			const statuses = new Set(
				persist
					.listDailyDates(category)
					.map((day) => persist.readDaily(category, day)?.status),
			);
			expect(statuses).toContain("won");
			expect(statuses).toContain("lost");
		}
	});

	test("survives the switch-over step that runs before the first render", () => {
		const persist = createPersist(seededStore());
		persist.applySwitchOver(SWITCH_OVER_DAY);
		for (const category of DAILY_CATEGORIES) {
			expect(persist.listDailyDates(category).sort()).toEqual(SCHEDULE_DAYS);
		}
	});
});
