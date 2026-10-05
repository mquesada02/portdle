// The gate's `test`: every test gets the stub backend, the fixed clock, a
// seeded random source, and the stored How-to flag and theme, and fails when a
// request had no stub.
//
// Clock (checked with Playwright 1.63, Chromium, 2026-10-05): after
// `clock.install`, the page's `setTimeout`, `setInterval`,
// `requestAnimationFrame`, `requestIdleCallback`, `performance.now`, and `Date`
// are fakes. `MessageChannel` and CSS animations are not. Time still flows at
// the real rate. After `pauseAt`, page timers and `requestAnimationFrame` never
// fire, so a test that pauses the clock must not poll in the page. freeze.ts
// polls from the test process.

import { test as base, expect } from "@playwright/test";
import { stubBackend } from "./stub.ts";

export { expect };

// The fixed moment of every test: the server time of the current Dailies.
const FIXED_TIME = new Date("2026-10-10T12:00:00Z");

// Runs in the page before any script: a seeded `Math.random`, the stored
// How-to flag (so no dialog covers the Daily), and the stored theme.
function initScript(theme: string) {
	let seed = 42;
	Math.random = () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};
	localStorage.setItem("portdle:v1:howToSeen", "true");
	localStorage.setItem("portdle:v1:theme", JSON.stringify(theme));
}

export const test = base.extend({
	page: async ({ page, baseURL, colorScheme }, use) => {
		if (!baseURL) {
			throw new Error("The gate configuration sets no baseURL.");
		}
		const unstubbed = await stubBackend(
			page.context(),
			new URL(baseURL).origin,
		);
		await page.clock.install({ time: FIXED_TIME });
		await page.addInitScript(initScript, colorScheme ?? "light");
		await use(page);
		expect(unstubbed, "requests with no stub").toEqual([]);
	},
});
