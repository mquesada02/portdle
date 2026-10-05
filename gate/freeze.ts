// Freezes motion at fixed times and takes one frame per time.
//
// Every wait polls from the test process: a page evaluation, then a real Node
// sleep. It never uses page timers or `requestAnimationFrame`, which the
// installed clock fakes (see fixtures.ts).

import { setTimeout as sleep } from "node:timers/promises";
import { expect, type Page } from "@playwright/test";

const POLL_MS = 10;
const TIMEOUT_MS = 2000;

async function pollUntil(
	label: string,
	timeoutMs: number,
	check: () => Promise<boolean>,
): Promise<void> {
	const end = Date.now() + timeoutMs;
	while (!(await check())) {
		if (Date.now() > end) {
			throw new Error(`Timed out after ${timeoutMs} ms: ${label}`);
		}
		await sleep(POLL_MS);
	}
}

// Waits until no animation is running. Use it before a frame at rest.
export async function waitForQuiet(page: Page): Promise<void> {
	await pollUntil("animations still running", TIMEOUT_MS, () =>
		page.evaluate(() =>
			document.getAnimations().every((a) => a.playState !== "running"),
		),
	);
}

// Runs `interact`, then freezes the animations it starts. `target` names the
// animation to wait for: a keyframe name such as `pop`, or a pseudo-element
// such as `::view-transition-new(screen)`. Earlier motion (for example a
// focus-ring transition from the pointer) must end first, or the helper would
// freeze it instead of the target. Each frame is `<name>-<time>ms.png`.
export async function shootMotion(
	page: Page,
	options: {
		name: string;
		target: string;
		times: number[];
		interact: () => Promise<void>;
	},
): Promise<void> {
	const { name, target, times, interact } = options;
	await waitForQuiet(page);
	await interact();
	await pollUntil(`no animation named ${target} started`, TIMEOUT_MS, () =>
		page.evaluate((wanted) => {
			const running = document
				.getAnimations()
				.filter((a) => a.playState === "running");
			const isTarget = (a: Animation) =>
				wanted.startsWith("::")
					? (a.effect as KeyframeEffect | null)?.pseudoElement === wanted
					: (a as CSSAnimation).animationName === wanted;
			if (!running.some(isTarget)) {
				return false;
			}
			for (const a of running) {
				a.pause();
			}
			return true;
		}, target),
	);
	// A pause is pending until the next frame. Setting a time before it settles
	// races with the pause.
	await page.evaluate(() =>
		Promise.all(document.getAnimations().map((a) => a.ready)),
	);
	for (const time of times) {
		// Two drawn frames after the change: a screenshot taken sooner can show
		// the compositor's stale frame (at 0 ms, a tile already scaled up). This
		// is a one-shot sync, not a poll, but it needs a running clock: with the
		// clock paused, `requestAnimationFrame` never fires.
		await page.evaluate(
			(ms) =>
				new Promise<void>((resolve) => {
					for (const a of document.getAnimations()) {
						if (a.playState === "paused") {
							a.currentTime = ms;
						}
					}
					requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
				}),
			time,
		);
		await expect(page).toHaveScreenshot(`${name}-${time}ms.png`, {
			animations: "allow",
		});
	}
}

// With reduced motion, no CSS animation of the target name may start.
export async function expectNoMotion(
	page: Page,
	target: string,
): Promise<void> {
	const names = await page.evaluate(() =>
		document.getAnimations().map((a) => (a as CSSAnimation).animationName),
	);
	expect(names, `animations named ${target}`).not.toContain(target);
}
