// Tracer bullet: one screen (the fresh Daily at rest) and one motion (the tile
// pop of a missed guess), on the Mixed Daily category of 2026-10-10 (SSH, port
// 22: a guess of two digits).

import { expect, test } from "./fixtures.ts";
import { expectNoMotion, shootMotion, waitForQuiet } from "./freeze.ts";

// Two `pop` animations of 150 ms, the second delayed by 40 ms, end at 190 ms.
const POP_TIMES = [0, 40, 75, 110, 150, 190];

test("fresh Daily at rest", async ({ page }, testInfo) => {
	test.skip(testInfo.project.name.endsWith("-reduced"), "A screen at rest.");
	await page.goto("/portdle/");
	await expect(page.getByLabel("Digit 1 of 2")).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("daily-fresh.png", {
		animations: "allow",
	});
});

test("tile pop of a missed guess", async ({ page }, testInfo) => {
	await page.goto("/portdle/");
	await page.getByLabel("Digit 1 of 2").click();
	await page.keyboard.type("80");
	await waitForQuiet(page);
	const submit = () => page.keyboard.press("Enter");
	if (testInfo.project.name.endsWith("-reduced")) {
		await submit();
		await expect(page.getByRole("img").first()).toBeVisible();
		await waitForQuiet(page);
		await expectNoMotion(page, "pop");
		await expect(page).toHaveScreenshot("daily-tile-pop-end.png", {
			animations: "allow",
		});
		return;
	}
	await shootMotion(page, {
		name: "daily-tile-pop",
		target: "pop",
		times: POP_TIMES,
		interact: submit,
	});
});
