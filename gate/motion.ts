// One motion test: frames at fixed times, or with reduced motion the end frame.

import type { Page } from "@playwright/test";
import { expect } from "./fixtures.ts";
import { shootMotion, waitForQuiet } from "./freeze.ts";
import { expectEndFrame } from "./state.ts";

// The frames of a 150 ms motion (`rise`, `pop`, a view transition, a dialog enter).
export const TIMES_150 = [0, 40, 75, 110, 150];

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
