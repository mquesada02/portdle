// The Daily, Archive, and History motions. Each frame sequence is its own test
// with its own page: `shootMotion` leaves the animations paused. Frame times
// come from the current durations (Spec 3, "Durations and easing"). With reduced
// motion, each test takes one end frame and asserts that no animation started.

import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures.ts";
import { pauseClock, shootMotion, waitForQuiet } from "./freeze.ts";
import { openAtRest, shootDisclosure, TIMES_150 } from "./motion.ts";
import { seedStorage } from "./seed.ts";
import {
	expectEndFrame,
	holdGlobalStats,
	IDENTIFIED_MISS,
	openGame,
	PLAYED,
} from "./state.ts";

test("row shake of an empty guess", async ({ page }, testInfo) => {
	const reduced = await openGame(page, testInfo);
	await page.getByLabel("Digit 1 of 2").click();
	if (reduced) {
		await page.keyboard.press("Enter");
		await expect(page.getByText("Not enough digits.")).toBeVisible();
		await expectEndFrame(page, "daily-row-shake");
		return;
	}
	// 300 ms. The stops at 20, 40, 60, and 80 percent fall at 60, 120, 180, and
	// 240 ms.
	await shootMotion(page, {
		name: "daily-row-shake",
		target: "shake",
		times: [0, 60, 120, 180, 240, 300],
		interact: () => page.keyboard.press("Enter"),
	});
});

test("divider draw and Reveal rise of a won Daily", async ({
	page,
}, testInfo) => {
	const release = await holdGlobalStats(page);
	try {
		const reduced = await openGame(page, testInfo);
		await page.getByLabel("Digit 1 of 2").click();
		await page.keyboard.type("22");
		if (reduced) {
			await page.keyboard.press("Enter");
			await expect(page.getByText("Solved")).toBeVisible();
			await expectEndFrame(page, "daily-finish", { fullPage: true });
			return;
		}
		await waitForQuiet(page);
		await pauseClock(page);
		// The draw lasts 300 ms. The rise starts at 250 ms and ends at 550 ms.
		await shootMotion(page, {
			name: "daily-finish",
			target: "draw",
			times: [0, 140, 250, 300, 425, 550],
			interact: () => page.keyboard.press("Enter"),
			pausedClock: true,
			fullPage: true,
		});
	} finally {
		release();
	}
});

test("Miss popover opens", async ({ page }, testInfo) => {
	const reduced = await openGame(page, testInfo, {
		records: [IDENTIFIED_MISS],
	});
	const trigger = page.locator("[data-popover] button");
	await expect(trigger).toBeVisible();
	if (reduced) {
		await trigger.click();
		await expect(page.getByRole("note")).toBeVisible();
		await expectEndFrame(page, "daily-popover-open");
		return;
	}
	await shootMotion(page, {
		name: "daily-popover-open",
		target: "popover-in",
		times: [0, 30, 60, 90, 120],
		interact: () => trigger.click(),
	});
});

test("Miss popover closes", async ({ page }, testInfo) => {
	const reduced = await openGame(page, testInfo, {
		records: [IDENTIFIED_MISS],
	});
	await page.locator("[data-popover] button").click();
	await expect(page.getByRole("note")).toBeVisible();
	await waitForQuiet(page);
	if (reduced) {
		await page.keyboard.press("Escape");
		await expect(page.getByRole("note")).toBeHidden();
		await expectEndFrame(page, "daily-popover-close");
		return;
	}
	await pauseClock(page);
	await shootMotion(page, {
		name: "daily-popover-close",
		target: "popover-out",
		times: [0, 20, 40, 60, 80],
		interact: () => page.keyboard.press("Escape"),
		pausedClock: true,
	});
});

test("Daily switcher changes category", async ({ page }, testInfo) => {
	const reduced = await openGame(page, testInfo);
	await expect(page.getByLabel("Digit 1 of 2")).toBeVisible();
	const link = page
		.getByRole("navigation", { name: "Daily switcher" })
		.getByRole("link", { name: "Protocols" });
	if (reduced) {
		await link.click();
		await expect(page.getByRole("heading", { name: "FTP" })).toBeVisible();
		await expectEndFrame(page, "daily-switcher");
		return;
	}
	await shootMotion(page, {
		name: "daily-switcher",
		target: "::view-transition-new(switcher-content)",
		times: TIMES_150,
		interact: () => link.click(),
		toleranceOnAllFrames: true,
	});
});

test("History switcher changes segment", async ({ page }, testInfo) => {
	const reduced = await openGame(page, testInfo, {
		path: "/portdle/history",
		records: PLAYED,
	});
	await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
	const link = page
		.getByRole("navigation", { name: "History switcher" })
		.getByRole("link", { name: "Blitz" });
	if (reduced) {
		await link.click();
		await expect(page.getByText("No runs yet.")).toBeVisible();
		await expectEndFrame(page, "history-switcher");
		return;
	}
	await shootMotion(page, {
		name: "history-switcher",
		target: "::view-transition-new(switcher-content)",
		times: TIMES_150,
		interact: () => link.click(),
		toleranceOnAllFrames: true,
	});
});

test("Nav changes screen", async ({ page }, testInfo) => {
	const reduced = await openGame(page, testInfo, { records: PLAYED });
	// The Mixed Daily of 2026-10-10 is played: the Reveal shows its answer, and
	// the Global stats load. Wait for them, so they do not change the old screen.
	await expect(page.getByText("Global distribution")).toBeVisible();
	const link = page
		.getByRole("navigation", { name: "Main" })
		.getByRole("link", { name: "History" });
	if (reduced) {
		await link.click();
		await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
		await expectEndFrame(page, "nav-screen-change");
		return;
	}
	await shootMotion(page, {
		name: "nav-screen-change",
		target: "::view-transition-new(screen)",
		times: TIMES_150,
		interact: () => link.click(),
	});
});

test("How-to dialog opens", async ({ page }, testInfo) => {
	const reduced = await openGame(page, testInfo);
	await expect(page.getByLabel("Digit 1 of 2")).toBeVisible();
	const button = page.getByRole("button", { name: "How to play" });
	if (reduced) {
		await button.click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await expectEndFrame(page, "how-to-open");
		return;
	}
	await shootMotion(page, {
		name: "how-to-open",
		target: "transition:opacity",
		times: TIMES_150,
		interact: () => button.click(),
	});
});

test("How-to dialog closes", async ({ page }, testInfo) => {
	const reduced = await openGame(page, testInfo);
	await page.getByRole("button", { name: "How to play" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await waitForQuiet(page);
	const gotIt = page.getByRole("button", { name: "Got it" });
	if (reduced) {
		await gotIt.click();
		await expect(page.getByRole("dialog")).toBeHidden();
		await expectEndFrame(page, "how-to-close");
		return;
	}
	// The exit lasts 100 ms.
	await shootMotion(page, {
		name: "how-to-close",
		target: "transition:opacity",
		times: [0, 25, 50, 75, 100],
		interact: () => gotIt.click(),
	});
});

// The Rounds disclosure of a Blitz run in History. The run is the stored last
// run of `seedStorage`; its time shows in the local time zone.
test.describe("Rounds disclosure in History", () => {
	test.use({ timezoneId: "UTC" });

	test.beforeEach(async ({ page }) => {
		await seedStorage(page);
	});

	async function openHistory(page: Page, testInfo: TestInfo) {
		const reduced = await openGame(page, testInfo, {
			path: "/portdle/history/blitz",
		});
		await expect(page.getByText("Rounds (4)")).toBeVisible();
		return reduced;
	}

	test("opens", async ({ page, browserName }, testInfo) => {
		const reduced = await openHistory(page, testInfo);
		await shootDisclosure(page, {
			name: "history-rounds-open",
			interact: () => page.getByText("Rounds (4)").click(),
			done: () => expect(page.getByText("you typed").first()).toBeVisible(),
			reduced,
			browserName,
		});
	});

	test("closes", async ({ page, browserName }, testInfo) => {
		const reduced = await openHistory(page, testInfo);
		await openAtRest(page);
		await shootDisclosure(page, {
			name: "history-rounds-close",
			interact: () => page.getByText("Rounds (4)").click(),
			done: () => expect(page.getByText("you typed").first()).toBeHidden(),
			reduced,
			browserName,
		});
	});
});
