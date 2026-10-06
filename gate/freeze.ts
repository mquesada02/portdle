// Freezes motion at fixed times and takes one frame per time.
//
// Every wait polls from the test process: a page evaluation, then a real Node
// sleep (the one fixed wait is `LATE_START_MS` in `shootHeld`). The polls
// never use page timers, which the installed clock fakes (see fixtures.ts).
// The frame sync in `shootHeld` does use `requestAnimationFrame`, so it needs a
// running clock, or `pausedClock`. With `pausedClock` in WebKit and Firefox the
// sync is left out (see `shootHeld`).

import { setTimeout as sleep } from "node:timers/promises";
import { type CDPSession, expect, type Page } from "@playwright/test";

const POLL_MS = 10;
// A wall-clock budget for every wait below: a loaded runner starts an
// animation late.
const TIMEOUT_MS = 10_000;
// The color tolerance of the frames between a motion's first and last time.
// Rarely, a frame in a compositor layer differs by one or two color levels.
// The first and the last time of a motion, and the frames at rest, stay
// exact, and `maxDiffPixels` stays 0 everywhere.
const IN_FLIGHT_THRESHOLD = 0.02;
// A fixed wait, not a poll: animations of the same change can start late.
const LATE_START_MS = 100;
const TRANSITION_PREFIX = "transition:";
// The target of a Rounds disclosure height change (Chromium only).
export const DETAILS_CONTENT_TARGET = "::details-content";

type Engine = "chromium" | "webkit" | "firefox";

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

type HoldWindow = Window & { __holdStarts?: boolean };

// Holds the animations that `interact` starts (rate 0), so a slow poll on a
// loaded machine cannot miss a 150 ms animation. A view transition is held when
// it is ready, on the current document only. A keyframe animation or a CSS
// transition is held at its start or run event (an init script covers a page
// that `interact` loads). A held animation still counts as running, so the poll
// finds it and pauses it. `releaseStarts` ends the hold, so later animations
// run as usual. Call `shootMotion` once per page: the hold cannot be removed
// from later documents.
async function holdStarts(page: Page, target: string): Promise<void> {
	if (target.startsWith("::")) {
		await page.evaluate(() => {
			if (typeof document.startViewTransition !== "function") {
				return;
			}
			(window as HoldWindow).__holdStarts = true;
			const start = document.startViewTransition.bind(document);
			document.startViewTransition = (...args: Parameters<typeof start>) => {
				const transition = start(...args);
				// The empty rejection handler is for a skipped transition.
				transition.ready.then(
					() => {
						if ((window as HoldWindow).__holdStarts) {
							for (const a of document.getAnimations()) {
								a.playbackRate = 0;
							}
						}
					},
					() => {},
				);
				return transition;
			};
		});
		return;
	}
	const hold = () => {
		(window as HoldWindow).__holdStarts = true;
		const holdTarget = (event: Event) => {
			if ((window as HoldWindow).__holdStarts) {
				// `subtree` adds the pseudo-elements, such as a dialog `::backdrop`.
				for (const a of (event.target as Element).getAnimations({
					subtree: true,
				})) {
					a.playbackRate = 0;
				}
			}
		};
		document.addEventListener("animationstart", holdTarget, true);
		document.addEventListener("transitionrun", holdTarget, true);
	};
	await page.addInitScript(hold);
	await page.evaluate(hold);
}

async function releaseStarts(page: Page): Promise<void> {
	await page.evaluate(() => {
		(window as HoldWindow).__holdStarts = false;
	});
}

// How `shootMotion` holds the animations of a change and freezes them at the
// frame times. `arm` runs before the interaction, `waitStarted` after it.
type Hold = {
	arm: () => Promise<void>;
	waitStarted: () => Promise<void>;
	seek: (time: number) => Promise<void>;
	release: () => Promise<void>;
};

// Waits for the target animation, then pauses every running animation.
async function waitForTarget(page: Page, target: string): Promise<void> {
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
}

// The default hold: the page events of `holdStarts`, and the page seek that
// `shootHeld` does for every frame.
function holdByEvents(page: Page, target: string): Hold {
	return {
		arm: () => holdStarts(page, target),
		waitStarted: () => waitForTarget(page, target),
		seek: async () => {},
		release: () => releaseStarts(page),
	};
}

// The hold for `DETAILS_CONTENT_TARGET`. Chromium lists no such transition in
// `getAnimations()` and fires no event for it, so this hold uses the CDP
// (Chrome DevTools Protocol) Animation domain: the document timeline runs at
// rate 0 before the interaction, and `seek` sets the time of every started
// animation.
function holdThroughCdp(page: Page): Hold {
	const started: string[] = [];
	let cdp: CDPSession | undefined;
	return {
		arm: async () => {
			if (page.context().browser()?.browserType().name() !== "chromium") {
				throw new Error(`${DETAILS_CONTENT_TARGET} needs Chromium (CDP)`);
			}
			cdp = await page.context().newCDPSession(page);
			cdp.on("Animation.animationStarted", ({ animation }) =>
				started.push(animation.id),
			);
			await cdp.send("Animation.enable");
			await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });
		},
		waitStarted: () =>
			pollUntil(
				`no ${DETAILS_CONTENT_TARGET} animation started`,
				TIMEOUT_MS,
				() => Promise.resolve(started.length > 0),
			),
		seek: async (time) => {
			await cdp?.send("Animation.seekAnimations", {
				animations: started,
				currentTime: time,
			});
		},
		release: async () => {
			try {
				await cdp?.send("Animation.setPlaybackRate", { playbackRate: 1 });
			} finally {
				await cdp?.detach();
			}
		},
	};
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

type ShootOptions = {
	name: string;
	target: string;
	times: number[];
	interact: () => Promise<void>;
	// The test paused the clock (see `pauseClock`).
	pausedClock?: boolean;
	// Shoot the whole page, not the viewport.
	fullPage?: boolean;
	// Every frame takes the color tolerance, also the first and the last. The
	// switcher view transitions need it: the tab label drew one level off in
	// the first frame and in the last frame, in rare runs.
	toleranceOnAllFrames?: boolean;
	// Engines where the target motion does not exist (for example, WebKit and
	// Firefox have no exit transition on a dialog, and no `::details-content`
	// height change). There the change is instant: the helper takes only the end
	// frame, the last time. A test lists an engine on purpose, so a missing
	// motion in any other engine still fails.
	noMotionIn?: Engine[];
	// TEMPORARY workaround (#249): in these engines every frame takes this
	// stylesheet (a file path), because part of the page is unstable there.
	// Remove it with that ticket. A `mask` does not work: the snapshots of a
	// view transition draw above it. The `noMotionIn` path does not use it.
	stylePathIn?: { engines: Engine[]; stylePath: string };
};

// Runs `interact`, then freezes the animations it starts. `target` names the
// animation to wait for: a keyframe name such as `pop`, a pseudo-element such
// as `::view-transition-new(screen)`, a CSS transition by property name such
// as `transition:opacity`, or `DETAILS_CONTENT_TARGET`. Earlier motion (for
// example a focus-ring transition from the pointer) must end first, or the
// helper would freeze it instead of the target. It holds the animations that
// `interact` starts first (see `Hold`), and releases the hold after the last
// frame.
// Each frame is `<name>-<time>ms.png`.
export async function shootMotion(
	page: Page,
	options: ShootOptions,
): Promise<void> {
	await waitForQuiet(page);
	if (options.noMotionIn?.includes(engineOf(page))) {
		await options.interact();
		await waitForQuiet(page);
		await expect(page).toHaveScreenshot(
			`${options.name}-${options.times.at(-1)}ms.png`,
			{ fullPage: options.fullPage },
		);
		return;
	}
	const hold =
		options.target === DETAILS_CONTENT_TARGET
			? holdThroughCdp(page)
			: holdByEvents(page, options.target);
	try {
		await hold.arm();
		await shootHeld(page, options, hold);
	} finally {
		// A failed release must not hide the error of the test.
		await hold.release().catch(() => {});
	}
}

function engineOf(page: Page): Engine {
	return page.context().browser()?.browserType().name() as Engine;
}

async function shootHeld(
	page: Page,
	options: ShootOptions,
	hold: Hold,
): Promise<void> {
	const { name, interact, pausedClock, fullPage, toleranceOnAllFrames } =
		options;
	const engine = engineOf(page);
	// Firefox draws the live page, not the view-transition overlay, in a
	// screenshot (cause unverified). For a view transition it takes only the
	// end frame, the last time.
	const times =
		engine === "firefox" && options.target.startsWith("::view-transition")
			? options.times.slice(-1)
			: options.times;
	const stylePath = options.stylePathIn?.engines.includes(engine)
		? options.stylePathIn.stylePath
		: undefined;
	await interact();
	await hold.waitStarted();
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
		await hold.seek(time);
		// Two drawn frames after the change: a screenshot taken sooner can show
		// the compositor's stale frame (at 0 ms, a tile already scaled up). This
		// is a one-shot sync, not a poll. With a running clock it uses the page's
		// `requestAnimationFrame`. With a paused clock that never fires, so it
		// uses the browser's own (`window.nativeRaf`, saved in fixtures.ts). In
		// WebKit and Firefox that one does not fire either under a paused clock
		// (checked 2026-10-05), so there the sync is left out: `toHaveScreenshot`
		// takes screenshots until two in a row match.
		await page.evaluate(
			({ ms, native, sync }) =>
				new Promise<void>((resolve) => {
					for (const a of document.getAnimations()) {
						if (a.playState === "paused") {
							a.currentTime = ms;
						}
					}
					if (!sync) {
						resolve();
						return;
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
			{
				ms: time,
				native: pausedClock === true,
				sync: !(pausedClock && engine !== "chromium"),
			},
		);
		const tolerated =
			toleranceOnAllFrames ||
			(time !== options.times[0] && time !== options.times.at(-1));
		await expect(page).toHaveScreenshot(`${name}-${time}ms.png`, {
			fullPage,
			stylePath,
			// Left out for the first and last frame: an undefined value would
			// replace the exact threshold of the gate configuration.
			...(tolerated && { threshold: IN_FLIGHT_THRESHOLD }),
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
