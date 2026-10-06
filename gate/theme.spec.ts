// The theme crossfade: the toggle on the fresh Daily of 2026-10-10. Each
// project starts in its own theme (see fixtures.ts), so the light projects
// frame light to dark and the dark projects dark to light.

import { expect, isReduced, test } from "./fixtures.ts";
import { expectNoMotion, shootMotion, waitForQuiet } from "./freeze.ts";

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
		// Sample from before the click until the 250 ms crossfade would have
		// ended: a check after the motion would pass even if it had run.
		const seen = page.evaluate(
			() =>
				new Promise<(string | null | undefined)[]>((resolve) => {
					const names = new Set<string | null | undefined>();
					const end = performance.now() + 400;
					const sample = () => {
						for (const a of document.getAnimations()) {
							names.add((a.effect as KeyframeEffect | null)?.pseudoElement);
						}
						if (performance.now() < end) {
							requestAnimationFrame(sample);
						} else {
							resolve([...names]);
						}
					};
					sample();
				}),
		);
		seen.catch(() => {});
		await toggle.click();
		// Both layers hold the motion back (the helper starts no transition, and
		// the reduced-motion rule zeroes the pseudo-elements), so the check below
		// fails only if both break. The class flips.
		await expect
			.poll(() =>
				page.evaluate(() =>
					document.documentElement.classList.contains("dark"),
				),
			)
			.toBe(!wasDark);
		await expectNoMotion(page, NEW_PAGE);
		expect(await seen, "pseudo-element animations seen").not.toContain(
			NEW_PAGE,
		);
		await waitForQuiet(page);
		await expect(page).toHaveScreenshot("theme-crossfade-end.png");
		return;
	}
	// The click blurs the focused digit slot and starts a border transition.
	// In WebKit the view transition starts later, and that transition can end
	// before the freeze. Blur first: `shootMotion` waits for it to end.
	await page.evaluate(() =>
		(document.activeElement as HTMLElement | null)?.blur(),
	);
	await shootMotion(page, {
		name: "theme-crossfade",
		target: NEW_PAGE,
		times: CROSSFADE_TIMES,
		interact: () => toggle.click(),
	});
});
