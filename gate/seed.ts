// Stored data for the Blitz and Codex frames. An init script writes it before
// the app reads it. It runs after the base init script of fixtures.ts. It runs
// on every document load, so a test loads the page once.

import type { Page } from "@playwright/test";

// A Mixed, Default, Sprint run that the clock ended: two correct rounds and two
// misses, each miss a typed Wrong answer. Its time is the one the Arena shows.
const LAST_RUN = {
	category: "mixed",
	orientation: "default",
	mode: "sprint",
	ended: "timeout",
	endedAt: "2026-10-10T11:30:00.000Z",
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
		{
			id: "ftp",
			name: "FTP",
			port: 21,
			outcome: "miss",
			wrong: {
				kind: "typed",
				port: 25,
				owner: { id: "smtp", name: "SMTP", port: 25 },
			},
		},
	],
};

// No Survival Best: the Survival Run of the End card sets a new one.
const BESTS = {
	"mixed|default|sprint": { score: 2 },
	"protocols|default|sprint": { score: 3 },
};

// Four protocols among the first eight cards of both sorts, so a frame (the
// viewport only) shows them. `fresh` marks the cards that pop on a visit.
function codex(fresh: boolean) {
	return {
		echo: { state: "correct", fresh },
		discard: { state: "missed", fresh: false },
		daytime: { state: "identified", fresh },
		chargen: { state: "correct", fresh },
	};
}

function writeStored(entries: Record<string, unknown>) {
	for (const [key, value] of Object.entries(entries)) {
		localStorage.setItem(`portdle:v1:${key}`, JSON.stringify(value));
	}
}

// `fresh: false` stores a Codex that was visited before, so no card pops.
// `sort` stores the Codex sort.
export async function seedStorage(
	page: Page,
	options: { fresh?: boolean; sort?: "name" | "port" } = {},
): Promise<void> {
	const { fresh = true, sort } = options;
	await page.addInitScript(writeStored, {
		blitzRuns: [LAST_RUN],
		blitzBests: BESTS,
		codex: codex(fresh),
		...(sort && { codexSort: sort }),
	});
}
