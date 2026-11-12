// The returning-player seed of the Lighthouse guard, defined once: the
// `localStorage` entries of a player who has played every Schedule day of the
// fixtures in all three Daily categories (mixed results), ran Blitz 20 times,
// has Blitz Bests, and has seen the How-to. The keys and shapes mirror
// src/persist/storage.ts (its key constants are private); the types of
// src/engine/types.ts check the shapes. The guard writes the entries before
// the audit runs and turns the storage reset off.
//
// Every Daily record has `late: false`: a record without it that is dated
// after the switch-over day is discarded by `applySwitchOver` before the first
// render.

import { SCHEDULE_DAYS } from "../gate/answers.ts";
import type {
	BlitzBests,
	BlitzRun,
	DailyCategory,
	DailyPersist,
} from "../src/engine/types.ts";

const CATEGORIES: DailyCategory[] = ["mixed", "protocols", "applications"];
const RUN_COUNT = 20;

// A won record with `misses` misses before the right port, or a lost one.
function dailyRecord(won: boolean, misses: number, day: number): DailyPersist {
	const guesses: DailyPersist["guesses"] = [];
	for (let n = 0; n < (won ? misses : 6); n++) {
		guesses.push({
			port: 1000 + n * 7 + day,
			result: "miss",
			identified: null,
		});
	}
	if (won) {
		guesses.push({ port: 22, result: "correct", identified: null });
	}
	return { status: won ? "won" : "lost", guesses, late: false };
}

function blitzRun(index: number): BlitzRun {
	return {
		category: CATEGORIES[index % CATEGORIES.length] as DailyCategory,
		orientation: "default",
		mode: index % 2 === 0 ? "sprint" : "survival",
		ended: "timeout",
		endedAt: new Date(
			Date.UTC(2026, 9, 4, 12) + index * 3_600_000,
		).toISOString(),
		score: 2,
		rounds: [
			{ id: "ssh", name: "SSH", port: 22, outcome: "correct", wrong: null },
			{
				id: "http",
				name: "HTTP",
				port: 80,
				outcome: "miss",
				wrong: { kind: "typed", port: 81, owner: null },
			},
			{ id: "dns", name: "DNS", port: 53, outcome: "correct", wrong: null },
		],
	};
}

const BESTS: BlitzBests = {
	"mixed|default|sprint": { score: 2 },
	"protocols|default|survival": { score: 2 },
};

// The entries to write: `localStorage` key to its stored string.
export function returningSeed(): Record<string, string> {
	const entries: Record<string, string> = {
		"portdle:v1:howToSeen": JSON.stringify(true),
		"portdle:v1:blitzBests": JSON.stringify(BESTS),
		"portdle:v1:blitzRuns": JSON.stringify(
			Array.from({ length: RUN_COUNT }, (_, index) => blitzRun(index)),
		),
	};
	SCHEDULE_DAYS.forEach((day, dayIndex) => {
		CATEGORIES.forEach((category, categoryIndex) => {
			const step = dayIndex + categoryIndex;
			entries[`portdle:v1:daily:${category}:${day}`] = JSON.stringify(
				dailyRecord(step % 4 !== 0, step % 5, dayIndex),
			);
		});
	});
	return entries;
}
