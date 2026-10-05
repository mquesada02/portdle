// The theme crossfade: the toggle on the fresh Daily of 2026-10-10. Each
// project starts in its own theme (see fixtures.ts), so the light projects
// frame light to dark and the dark projects dark to light.

import type { TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures.ts";
import { expectNoMotion, shootMotion, waitForQuiet } from "./freeze.ts";

function isReduced(testInfo: TestInfo): boolean {
	return testInfo.project.use.reducedMotion === "reduce";
}

// One 250 ms crossfade of the whole page.
const CROSSFADE_TIMES = [0, 60, 125, 190, 250];
const NEW_PAGE = "::view-transition-new(root)";

test("theme crossfade", async ({ page }, testInfo) => {
	await page.goto("/portdle/");
	await expect(page.getByLabel("Digit 1 of 2")).toBeVisible();
	const toggle = page.getByRole("button", { name: "Toggle color theme" });
	const wasDark = await page.evaluate(() =>
		document.documentElement.classList.contains("dark"),
	);
	if (isReduced(testInfo)) {
		await waitForQuiet(page);
		await toggle.click();
		// The class flips at once: no view transition holds the change back.
		await expect
			.poll(() =>
				page.evaluate(() =>
					document.documentElement.classList.contains("dark"),
				),
			)
			.toBe(!wasDark);
		await waitForQuiet(page);
		await expectNoMotion(page, NEW_PAGE);
		await expect(page).toHaveScreenshot("theme-crossfade-end.png");
		return;
	}
	await shootMotion(page, {
		name: "theme-crossfade",
		target: NEW_PAGE,
		times: CROSSFADE_TIMES,
		interact: () => toggle.click(),
	});
});
