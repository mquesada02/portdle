// Blitz: the three phase changes (Start, Last life, Play again), the Rounds
// disclosure of the Arena's last run, and the screens at rest (Arena, Setup
// dialog, Run, End card). A Run uses Mixed, Default, and Survival. Survival
// shows no countdown, so the running clock changes no frame. The Prompts of a
// Run come from the seeded `Math.random` of fixtures.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { expect, isReduced, test } from "./fixtures.ts";
import { waitForQuiet } from "./freeze.ts";
import { shootOrEnd, TIMES_150 } from "./motion.ts";
import { seedStorage } from "./seed.ts";
import { openGame } from "./state.ts";

test.use({ timezoneId: "UTC" });

const CATALOG = JSON.parse(
	readFileSync(join(import.meta.dirname, "fixtures", "catalog.json"), "utf8"),
) as { name: string; port: number }[];

// The phase change plays the `rise` of 150 ms on the new screen.
const PHASE_TARGET = "::view-transition-new(screen)";

test.beforeEach(async ({ page }) => {
	await seedStorage(page);
});

// Opens the Arena. Returns whether the project has reduced motion.
function openArena(page: Page, testInfo: TestInfo): Promise<boolean> {
	return openGame(page, testInfo, { path: "/portdle/blitz" });
}

async function openSetup(page: Page, testInfo: TestInfo): Promise<boolean> {
	const reduced = await openArena(page, testInfo);
	await page.getByRole("button", { name: "New run" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	// The dialog opens on the last run's Sprint.
	await page.getByRole("dialog").getByText("Survival", { exact: true }).click();
	return reduced;
}

async function startRun(page: Page, testInfo: TestInfo) {
	await openSetup(page, testInfo);
	await page.getByRole("button", { name: "Start" }).click();
	await expect(page.getByText("Round 1")).toBeVisible();
}

// Types digits in the slots of the Prompt. The submit is the caller's.
async function typeGuess(page: Page, kind: "correct" | "miss") {
	const name = await page.locator("main h1").innerText();
	const entry = CATALOG.find((item) => item.name === name);
	if (!entry) {
		throw new Error(`No catalog entry for the Prompt ${name}`);
	}
	const digits = String(entry.port);
	// A wrong guess repeats one digit that is not the first digit of the port.
	const wrong = (digits[0] === "1" ? "2" : "1").repeat(digits.length);
	await page.getByLabel(`Digit 1 of ${digits.length}`).click();
	await page.keyboard.type(kind === "correct" ? digits : wrong);
}

async function guess(page: Page, kind: "correct" | "miss") {
	await typeGuess(page, kind);
	await page.keyboard.press("Enter");
}

// One correct guess, then two misses; the next miss ends the Run.
async function playToLastLife(page: Page, testInfo: TestInfo) {
	await startRun(page, testInfo);
	await guess(page, "correct");
	await expect(page.getByText("Round 2")).toBeVisible();
	await guess(page, "miss");
	await expect(page.getByText("Round 3")).toBeVisible();
	await guess(page, "miss");
	await expect(page.getByText("Round 4")).toBeVisible();
	await waitForQuiet(page);
}

async function playToEnd(page: Page, testInfo: TestInfo) {
	await playToLastLife(page, testInfo);
	await guess(page, "miss");
	await expect(page.getByText("Out of lives")).toBeVisible();
}

test("Arena with a last run at rest", async ({ page }, testInfo) => {
	test.skip(isReduced(testInfo), "A screen at rest.");
	await openArena(page, testInfo);
	await expect(page.getByText("Last run")).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("blitz-arena.png");
});

test("Setup dialog at rest", async ({ page }, testInfo) => {
	test.skip(isReduced(testInfo), "A screen at rest.");
	await openArena(page, testInfo);
	await page.getByRole("button", { name: "New run" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("blitz-setup.png");
});

test("Run at rest", async ({ page }, testInfo) => {
	test.skip(isReduced(testInfo), "A screen at rest.");
	await startRun(page, testInfo);
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("blitz-run.png");
});

test("End card at rest", async ({ page }, testInfo) => {
	test.skip(isReduced(testInfo), "A screen at rest.");
	await playToEnd(page, testInfo);
	await waitForQuiet(page);
	await expect(page.getByText("New best")).toBeVisible();
	await expect(page).toHaveScreenshot("blitz-end.png");
});

test("Start: Arena to Run", async ({ page }, testInfo) => {
	const reduced = await openSetup(page, testInfo);
	await shootOrEnd(page, reduced, {
		name: "blitz-start",
		target: PHASE_TARGET,
		times: TIMES_150,
		interact: () => page.getByRole("button", { name: "Start" }).click(),
		done: () => expect(page.getByText("Round 1")).toBeVisible(),
	});
});

test("Last life: Run to End card", async ({ page }, testInfo) => {
	await playToLastLife(page, testInfo);
	await typeGuess(page, "miss");
	await shootOrEnd(page, isReduced(testInfo), {
		name: "blitz-last-life",
		target: PHASE_TARGET,
		times: TIMES_150,
		interact: () => page.keyboard.press("Enter"),
		done: () => expect(page.getByText("Out of lives")).toBeVisible(),
	});
});

test("Play again: End card to Arena", async ({ page }, testInfo) => {
	await playToEnd(page, testInfo);
	await shootOrEnd(page, isReduced(testInfo), {
		name: "blitz-play-again",
		target: PHASE_TARGET,
		times: TIMES_150,
		interact: () => page.getByRole("button", { name: "Play again" }).click(),
		done: () => expect(page.getByText("Last run")).toBeVisible(),
	});
});

test("Rounds disclosure of the last run", async ({ page }, testInfo) => {
	const reduced = await openArena(page, testInfo);
	await expect(page.getByText("Rounds (4)")).toBeVisible();
	await shootOrEnd(page, reduced, {
		name: "blitz-rounds-rise",
		target: "rise",
		times: TIMES_150,
		interact: () => page.getByText("Rounds (4)").click(),
		done: () => expect(page.getByText("you typed").first()).toBeVisible(),
	});
});
