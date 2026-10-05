// Freezes motion at fixed times and takes one frame per time.
//
// Every wait polls from the test process: a page evaluation, then a real Node
// sleep (the one fixed wait is `LATE_START_MS` in `shootMotion`). The polls
// never use page timers, which the installed clock fakes (see fixtures.ts).
// The frame sync in `shootMotion` does use
// `requestAnimationFrame`, so it needs a running clock, or `pausedClock`.

import { setTimeout as sleep } from "node:timers/promises";
import { expect, type Page } from "@playwright/test";

const POLL_MS = 10;
// A wall-clock budget for every wait below: a loaded runner starts an
// animation late.
const TIMEOUT_MS = 10_000;
// The color tolerance of the frames between a motion's first and last time.
// Rarely, a frame in a compositor layer differs by one or two color levels.
// The first frame, the last frame, and the frames at rest stay exact, and
// `maxDiffPixels` stays 0 everywhere.
const IN_FLIGHT_THRESHOLD = 0.02;
// A fixed wait, not a poll: animations of the same change can start late.
const LATE_START_MS = 100;
const TRANSITION_PREFIX = "transition:";

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

// Pauses the installed clock one second ahead. Use it after `waitForQuiet` and
// after all typing, before the interaction: the jump runs the timers that are
// due in that second. With a paused clock, no page timer fires, so a timer
// cannot change the page while its animations are frozen. Pass
// `pausedClock: true` to `shootMotion` afterwards.
export async function pauseClock(page: Page): Promise<void> {
	const now = await page.evaluate(() => Date.now());
	await page.clock.pauseAt(new Date(now + 1000));
}

// Runs `interact`, then freezes the animations it starts. `target` names the
// animation to wait for: a keyframe name such as `pop`, a pseudo-element such
// as `::view-transition-new(screen)`, or a CSS transition by property name
// such as `transition:opacity`. Earlier motion (for example a
// focus-ring transition from the pointer) must end first, or the helper would
// freeze it instead of the target. Each frame is `<name>-<time>ms.png`.
export async function shootMotion(
	page: Page,
	options: {
		name: string;
		target: string;
		times: number[];
		interact: () => Promise<void>;
		// The test paused the clock (see `pauseClock`).
		pausedClock?: boolean;
		// Shoot the whole page, not the viewport.
		fullPage?: boolean;
		// The first frame also takes the color tolerance. The switcher view
		// transitions need it: their first frame (the tab label) drew one level off
		// in about 1 of 10 five-run checks.
		toleranceOnFirstFrame?: boolean;
	},
): Promise<void> {
	const {
		name,
		target,
		times,
		interact,
		pausedClock,
		fullPage,
		toleranceOnFirstFrame,
	} = options;
	await waitForQuiet(page);
	await interact();
	await pollUntil(`no animation named ${target} started`, TIMEOUT_MS, () =>
		page.evaluate(
			({ wanted, prefix }) => {
				const running = document
					.getAnimations()
					.filter((a) => a.playState === "running");
				const isTarget = (a: Animation) =>
					wanted.startsWith("::")
						? (a.effect as KeyframeEffect | null)?.pseudoElement === wanted
						: wanted.startsWith(prefix)
							? (a as CSSTransition).transitionProperty ===
								wanted.slice(prefix.length)
							: (a as CSSAnimation).animationName === wanted;
				if (!running.some(isTarget)) {
					return false;
				}
				for (const a of running) {
					a.pause();
				}
				return true;
			},
			{ wanted: target, prefix: TRANSITION_PREFIX },
		),
	);
	// Other animations of the same change can start a frame or two after the
	// target (the color transitions of the Nav and the switchers). Wait, then
	// pause them too: a transition that keeps running changes the frames.
	await sleep(LATE_START_MS);
	// A pause is pending until the next frame. Setting a time before it settles
	// races with the pause.
	await page.evaluate(() => {
		const animations = document.getAnimations();
		for (const a of animations) {
			if (a.playState === "running") {
				a.pause();
			}
		}
		return Promise.all(animations.map((a) => a.ready));
	});
	for (const time of times) {
		// Two drawn frames after the change: a screenshot taken sooner can show
		// the compositor's stale frame (at 0 ms, a tile already scaled up). This
		// is a one-shot sync, not a poll. With a running clock it uses the page's
		// `requestAnimationFrame`. With a paused clock that never fires, so it
		// uses the browser's own (`window.nativeRaf`, saved in fixtures.ts).
		await page.evaluate(
			({ ms, native }) =>
				new Promise<void>((resolve) => {
					for (const a of document.getAnimations()) {
						if (a.playState === "paused") {
							a.currentTime = ms;
						}
					}
					const raf = native
						? (
								window as unknown as {
									nativeRaf: typeof requestAnimationFrame;
								}
							).nativeRaf
						: requestAnimationFrame;
					raf(() => raf(() => resolve()));
				}),
			{ ms: time, native: pausedClock === true },
		);
		const inFlight =
			(toleranceOnFirstFrame || time !== times[0]) && time !== times.at(-1);
		await expect(page).toHaveScreenshot(`${name}-${time}ms.png`, {
			fullPage,
			// Left out for the first and last frame: an undefined value would
			// replace the exact threshold of the gate configuration.
			...(inFlight && { threshold: IN_FLIGHT_THRESHOLD }),
		});
	}
}

// With reduced motion, no animation of the target may start. `target` is a
// keyframe name or a `::view-transition-*` pseudo-element, as in `shootMotion`.
export async function expectNoMotion(
	page: Page,
	target: string,
): Promise<void> {
	const names = await page.evaluate(
		(wanted) =>
			document
				.getAnimations()
				.map((a) =>
					wanted.startsWith("::")
						? (a.effect as KeyframeEffect | null)?.pseudoElement
						: (a as CSSAnimation).animationName,
				),
		target,
	);
	expect(names, `animations named ${target}`).not.toContain(target);
}
