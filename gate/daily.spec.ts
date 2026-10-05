// Tracer bullet: one screen (the fresh Daily at rest) and one motion (the tile
// pop of a missed guess), on the Mixed Daily category of 2026-10-10 (SSH, port
// 22: a guess of two digits).

import type { TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures.ts";
import { expectNoMotion, shootMotion, waitForQuiet } from "./freeze.ts";

function isReduced(testInfo: TestInfo): boolean {
	return testInfo.project.use.reducedMotion === "reduce";
}

// Two `pop` animations of 150 ms, the second delayed by 40 ms, end at 190 ms.
const POP_TIMES = [0, 40, 75, 110, 150, 190];

test("fresh Daily at rest", async ({ page }, testInfo) => {
	test.skip(isReduced(testInfo), "A screen at rest.");
	await page.goto("/portdle/");
	await expect(page.getByLabel("Digit 1 of 2")).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("daily-fresh.png");
});

test("tile pop of a missed guess", async ({ page }, testInfo) => {
	await page.goto("/portdle/");
	await page.getByLabel("Digit 1 of 2").click();
	await page.keyboard.type("80");
	if (isReduced(testInfo)) {
		await waitForQuiet(page);
		await page.keyboard.press("Enter");
		// The counter changes only when the guess row exists.
		await expect(page.getByText("1 / 6")).toBeVisible();
		await waitForQuiet(page);
		await expectNoMotion(page, "pop");
		await expect(page).toHaveScreenshot("daily-tile-pop-end.png");
		return;
	}
	await shootMotion(page, {
		name: "daily-tile-pop",
		target: "pop",
		times: POP_TIMES,
		interact: () => page.keyboard.press("Enter"),
	});
});
