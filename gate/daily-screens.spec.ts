// The Daily, Archive, and History screens at rest, and the error panel. Screens
// have no motion, so they run without reduced motion only (as `daily-fresh`
// does). Every frame is the whole page: the Reveal and the lists are below the
// first screen.

import { expect, test } from "./fixtures.ts";
import { waitForQuiet } from "./freeze.ts";
import { isReduced, LOST, openGame, PLAYED, WON } from "./state.ts";

test.beforeEach(({ browserName }, testInfo) => {
	test.skip(isReduced(testInfo), `A screen at rest (${browserName}).`);
});

test("won Daily", async ({ page }, testInfo) => {
	await openGame(page, testInfo, { records: [WON] });
	await expect(page.getByText("Global distribution")).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("daily-won.png", { fullPage: true });
});

test("lost Daily", async ({ page }, testInfo) => {
	await openGame(page, testInfo, {
		path: "/portdle/protocols",
		records: [LOST],
	});
	await expect(page.getByText("Global distribution")).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("daily-lost.png", { fullPage: true });
});

test("Archive list", async ({ page }, testInfo) => {
	await openGame(page, testInfo, {
		path: "/portdle/archive",
		records: PLAYED,
	});
	await expect(page.getByRole("list", { name: "2026-10-04" })).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("archive-list.png", { fullPage: true });
});

test("Archive board", async ({ page }, testInfo) => {
	// An unplayed Daily: Applications on 2026-10-09 (pgAdmin, port 5050).
	await openGame(page, testInfo, {
		path: "/portdle/archive/applications/2026-10-09",
		records: PLAYED,
	});
	await expect(page.getByLabel("Digit 1 of 4")).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("archive-board.png", { fullPage: true });
});

test("History", async ({ page }, testInfo) => {
	await openGame(page, testInfo, {
		path: "/portdle/history",
		records: PLAYED,
	});
	await expect(page.getByRole("list", { name: "2026-10-10" })).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("history.png", { fullPage: true });
});

test("error panel", async ({ page }, testInfo) => {
	await page.route("**/rest/v1/catalog_entries*", (route) => route.abort());
	await openGame(page, testInfo);
	const message = page.getByText("Portdle's server isn't answering.");
	await expect(message).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("error-panel.png", { fullPage: true });
	await expect(message).toBeVisible();
});
