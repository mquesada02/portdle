// Signed-in screens at rest: the Account menu, the Leaderboards tab, and the
// Name confirm. The fixtures sign the page in before it loads (see
// fixtures.ts), so each test only opens its screen.

import type { TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures.ts";
import { waitForQuiet } from "./freeze.ts";

function isReduced(testInfo: TestInfo): boolean {
	return testInfo.project.use.reducedMotion === "reduce";
}

test.describe("confirmed name", () => {
	test.use({ account: "confirmed" });

	test("Account menu open", async ({ page }, testInfo) => {
		test.skip(isReduced(testInfo), "A screen at rest.");
		await page.goto("/portdle/");
		await page.getByLabel("Account", { exact: true }).click();
		await expect(page.getByText("Brave Falcon")).toBeVisible();
		await waitForQuiet(page);
		await expect(page).toHaveScreenshot("account-menu.png");
	});

	test("Leaderboards tab", async ({ page }, testInfo) => {
		test.skip(isReduced(testInfo), "A screen at rest.");
		await page.goto("/portdle/blitz");
		await page.getByRole("tab", { name: "Leaderboards" }).click();
		await expect(page.getByRole("row").first()).toBeVisible();
		await waitForQuiet(page);
		await expect(page).toHaveScreenshot("leaderboards.png");
	});
});

test.describe("unconfirmed name", () => {
	test.use({ account: "unconfirmed" });

	test("Name confirm", async ({ page }, testInfo) => {
		test.skip(isReduced(testInfo), "A screen at rest.");
		await page.goto("/portdle/");
		await expect(
			page.getByRole("heading", { name: "Confirm your display name" }),
		).toBeVisible();
		await waitForQuiet(page);
		await expect(page).toHaveScreenshot("name-confirm.png");
	});
});
