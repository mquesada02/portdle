// One motion test: frames at fixed times, or with reduced motion the end frame.

import type { Page } from "@playwright/test";
import { expect } from "./fixtures.ts";
import { DETAILS_CONTENT_TARGET, shootMotion, waitForQuiet } from "./freeze.ts";
import { expectEndFrame } from "./state.ts";

// The frames of a 150 ms motion (`rise`, `pop`, a view transition, a dialog enter).
export const TIMES_150 = [0, 40, 75, 110, 150];

// The frames of a 200 ms motion (the Rounds disclosure height in src/styles.css).
export const TIMES_200 = [0, 50, 100, 150, 200];

// A frame at rest, taken once the animations ended.
export async function restShot(page: Page, name: string): Promise<void> {
	await waitForQuiet(page);
	await expect(page).toHaveScreenshot(`${name}.png`);
}

// With motion: `shootMotion`, one frame per time. With reduced motion (the page
// came from `openGame`, which logs the animations that start): the
// interaction, `done` (the page shows the result), and `expectEndFrame`.
export async function shootOrEnd(
	page: Page,
	reduced: boolean,
	options: {
		name: string;
		target: string;
		times: number[];
		interact: () => Promise<void>;
		done: () => Promise<void>;
	},
): Promise<void> {
	const { name, target, times, interact, done } = options;
	if (!reduced) {
		await shootMotion(page, { name, target, times, interact });
		return;
	}
	await interact();
	await done();
	await expectEndFrame(page, name);
}

// One Rounds disclosure sequence (open or close). The freeze route is the CDP
// one of `shootMotion`, so it runs in Chromium with motion only. With reduced
// motion: the interaction, `done`, a check that the page sets no transition on
// the content, and the end frame. In an engine that does not animate the height
// (Firefox and WebKit have no `interpolate-size`): the interaction, `done`, and
// one end frame, which records the instant change.
export async function shootDisclosure(
	page: Page,
	options: {
		name: string;
		interact: () => Promise<void>;
		done: () => Promise<void>;
		reduced: boolean;
		browserName: string;
	},
): Promise<void> {
	const { name, interact, done, reduced, browserName } = options;
	if (!reduced && browserName === "chromium") {
		await shootMotion(page, {
			name,
			target: DETAILS_CONTENT_TARGET,
			times: TIMES_200,
			interact,
		});
		return;
	}
	await interact();
	await done();
	if (reduced) {
		// The motion log cannot see this transition: it fires no event.
		const duration = await page
			.locator("details")
			.evaluate(
				(details) =>
					getComputedStyle(details, "::details-content").transitionDuration,
			);
		expect(duration, "transition duration of the content").toBe("0s");
		await expectEndFrame(page, name);
		return;
	}
	await restShot(page, `${name}-end`);
}

// Opens the one Rounds disclosure of the page and leaves it at rest, for a
// close sequence. A style tag removes the transition for the click, and goes
// before the freeze starts. The tag removal changes no computed height, so no
// transition starts.
async function openAtRest(page: Page): Promise<void> {
	const style = await page.addStyleTag({
		content: "details::details-content { transition: none }",
	});
	await page.getByText("Rounds (4)").click();
	await expect(page.getByText("you typed").first()).toBeVisible();
	await style.evaluate((node) => node.parentNode?.removeChild(node));
}

// The open or the close sequence of the "Rounds (4)" disclosure of the stored
// last run. `closing` starts from an open disclosure at rest.
export async function shootRoundsToggle(
	page: Page,
	options: {
		name: string;
		closing: boolean;
		reduced: boolean;
		browserName: string;
	},
): Promise<void> {
	const { name, closing, reduced, browserName } = options;
	await expect(page.getByText("Rounds (4)")).toBeVisible();
	if (closing) {
		await openAtRest(page);
	}
	const log = page.getByText("you typed").first();
	await shootDisclosure(page, {
		name,
		interact: () => page.getByText("Rounds (4)").click(),
		done: () =>
			closing ? expect(log).toBeHidden() : expect(log).toBeVisible(),
		reduced,
		browserName,
	});
}
