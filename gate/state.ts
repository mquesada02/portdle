// Helpers that the Daily, Archive, and History gate tests share: stored game
// state, a held Global stats read, and a log of the animations that start.

import type { Page, TestInfo } from "@playwright/test";
import { expect, isReduced } from "./fixtures.ts";
import { waitForQuiet } from "./freeze.ts";

// The stored Daily record: the shape that `isDailyPersist` accepts
// (src/persist/storage.ts).
type Guess = {
	port: number;
	result: "correct" | "miss";
	identified: { id: string; name: string; port: number } | null;
};
type Saved = {
	category: "mixed" | "protocols" | "applications";
	date: string;
	status: "won" | "lost" | "playing";
	guesses: Guess[];
};

const SSH = { id: "ssh", name: "SSH", port: 22 };
const HTTP = { id: "http", name: "HTTP", port: 80 };
const ELASTICSEARCH = {
	id: "elasticsearch",
	name: "Elasticsearch",
	port: 9200,
};

function miss(port: number, identified: Guess["identified"] = null): Guess {
	return { port, result: "miss", identified };
}

function correct(port: number): Guess {
	return { port, result: "correct", identified: null };
}

// Mixed 2026-10-10 is SSH (22) and Protocols 2026-10-10 is FTP (21).
export const WON: Saved = {
	category: "mixed",
	date: "2026-10-10",
	status: "won",
	guesses: [correct(22)],
};
export const LOST: Saved = {
	category: "protocols",
	date: "2026-10-10",
	status: "lost",
	guesses: [
		miss(22, SSH),
		miss(80, HTTP),
		miss(53),
		miss(25),
		miss(23),
		miss(69),
	],
};
// One identified miss: the row caption is the entry name, a Miss popover.
export const IDENTIFIED_MISS: Saved = {
	category: "mixed",
	date: "2026-10-10",
	status: "playing",
	guesses: [miss(80, HTTP)],
};
// The Archive list and History show these results.
export const PLAYED: Saved[] = [
	WON,
	LOST,
	{
		category: "mixed",
		date: "2026-10-09",
		status: "won",
		guesses: [correct(514)],
	},
	{
		category: "protocols",
		date: "2026-10-09",
		status: "lost",
		guesses: [
			miss(6380),
			miss(6381),
			miss(6382),
			miss(6383),
			miss(6384),
			miss(6385),
		],
	},
	{
		category: "applications",
		date: "2026-10-08",
		status: "won",
		guesses: [miss(9001), miss(9200, ELASTICSEARCH), correct(9000)],
	},
];

// Writes the records to `localStorage` before the page loads. A marker in
// `sessionStorage` makes it run once per session, so a reload keeps the
// progress that the test makes.
async function seedDailies(page: Page, records: Saved[]): Promise<void> {
	await page.addInitScript((seed) => {
		if (sessionStorage.getItem("gate:seeded")) {
			return;
		}
		for (const { category, date, ...value } of seed) {
			localStorage.setItem(
				`portdle:v1:daily:${category}:${date}`,
				JSON.stringify({ ...value, late: false }),
			);
		}
		sessionStorage.setItem("gate:seeded", "true");
	}, records);
}

type MotionWindow = { motionLog?: string[] };

// Collects the name of every animation and transition that starts in the
// document, also one that has ended before the test looks.
async function installMotionLog(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const log: string[] = [];
		(window as MotionWindow).motionLog = log;
		document.addEventListener(
			"animationstart",
			(event) =>
				log.push(`animation ${(event as AnimationEvent).animationName}`),
			true,
		);
		document.addEventListener(
			"transitionrun",
			(event) =>
				log.push(`transition ${(event as TransitionEvent).propertyName}`),
			true,
		);
	});
}

// Opens the app at `path` with the stored records. With reduced motion, the
// motion log is on. Returns whether the project has reduced motion.
export async function openGame(
	page: Page,
	testInfo: TestInfo,
	options: { path?: string; records?: Saved[] } = {},
): Promise<boolean> {
	const reduced = isReduced(testInfo);
	if (options.records) {
		await seedDailies(page, options.records);
	}
	if (reduced) {
		await installMotionLog(page);
	}
	await page.goto(options.path ?? "/portdle/");
	return reduced;
}

// With reduced motion: no animation started, and one end frame of the motion.
export async function expectEndFrame(
	page: Page,
	name: string,
	options: { fullPage?: boolean } = {},
): Promise<void> {
	await waitForQuiet(page);
	const log = await page.evaluate(() => (window as MotionWindow).motionLog);
	// Not installed: the test would pass with no check.
	expect(log, "motion log installed").toBeDefined();
	expect(log, "animations that started").toEqual([]);
	await expect(page).toHaveScreenshot(`${name}-end.png`, options);
}

// Holds the Global stats read until the returned function runs. The stats
// load after a Daily finishes and change the page height, so a frame sequence
// holds them. Call the function before the test ends: the read then reaches
// the stub like any other.
export async function holdGlobalStats(page: Page): Promise<() => void> {
	let release = () => {};
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/rest/v1/daily_global_stats*", async (route) => {
		await released;
		await route.fallback();
	});
	return release;
}
