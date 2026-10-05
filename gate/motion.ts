// One motion test: frames at fixed times, or with reduced motion the end frame.

import type { Page } from "@playwright/test";
import { shootMotion } from "./freeze.ts";
import { expectEndFrame } from "./state.ts";

// The frames of a 150 ms motion (`rise`, `pop`).
export const TIMES_150 = [0, 40, 75, 110, 150];

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
