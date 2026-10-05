// Codex: the reorder of a sort change, the pop of the fresh cards, and both
// sorts at rest. The seeded Codex holds four protocols (gate/seed.ts), and the
// page loads directly, so no screen transition mixes with the pop.

import { expect, isReduced, test } from "./fixtures.ts";
import { shootMotion, waitForQuiet } from "./freeze.ts";
import { shootOrEnd, TIMES_150 } from "./motion.ts";
import { seedStorage } from "./seed.ts";
import { expectEndFrame, openGame } from "./state.ts";

test.use({ timezoneId: "UTC" });

// The reorder's group tween lasts 200 ms.
const REORDER_TIMES = [0, 50, 100, 150, 200];
const CODEX = "/portdle/codex";

test("Codex in the Name sort at rest", async ({ page }, testInfo) => {
	test.skip(isReduced(testInfo), "A screen at rest.");
	await seedStorage(page);
	await openGame(page, testInfo, { path: CODEX });
	await expect(page.getByText("Seen 4 /")).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("codex-name.png");
});

test("Codex in the Port sort at rest", async ({ page }, testInfo) => {
	test.skip(isReduced(testInfo), "A screen at rest.");
	await seedStorage(page, { sort: "port" });
	await openGame(page, testInfo, { path: CODEX });
	await expect(page.getByText("Seen 4 /")).toBeVisible();
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot("codex-port.png");
});

test("Reorder: Name sort to Port sort", async ({ page }, testInfo) => {
	await seedStorage(page, { fresh: false });
	const reduced = await openGame(page, testInfo, { path: CODEX });
	await expect(page.getByText("Seen 4 /")).toBeVisible();
	// The keyboard changes the sort: a pointer over the tab starts a hover color
	// transition at an unpredictable time, which the freeze would catch half done.
	await page.getByLabel("Port").focus();
	await shootOrEnd(page, reduced, {
		name: "codex-reorder",
		target: "::view-transition-group(codex-echo)",
		times: REORDER_TIMES,
		interact: () => page.keyboard.press("Space"),
		done: () => expect(page.getByLabel("Port")).toBeChecked(),
	});
});

test("Fresh cards pop", async ({ page }, testInfo) => {
	await seedStorage(page);
	if (isReduced(testInfo)) {
		await openGame(page, testInfo, { path: CODEX });
		await expect(page.getByText("Seen 4 /")).toBeVisible();
		await expectEndFrame(page, "codex-card-pop");
		return;
	}
	// The page loads inside the interaction, so the hold sees the pop start. The
	// hold keeps each pop at its start, so the interaction can wait for the
	// cards: a slow page load cannot make the helper miss the pop.
	await shootMotion(page, {
		name: "codex-card-pop",
		target: "pop",
		times: TIMES_150,
		interact: async () => {
			await page.goto(CODEX);
			await expect(page.getByText("Seen 4 /")).toBeVisible();
		},
	});
});
