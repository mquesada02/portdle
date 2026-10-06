// DIAG #249 probe, branch diag/249 only. Logs the state of every transition at
// its transitionrun event when the How-to dialog opens.
import { expect, test } from "./fixtures.ts";
import { openGame } from "./state.ts";

test("DIAG probe: how-to transitionrun state", async ({ page }, testInfo) => {
	if (testInfo.project.use.reducedMotion === "reduce") {
		test.skip();
	}
	await openGame(page, testInfo);
	await expect(page.getByLabel("Digit 1 of 2")).toBeVisible();
	const button = page.getByRole("button", { name: "How to play" });
	await button.hover();
	await page.evaluate(() => {
		const w = window as unknown as { __diag: unknown[] };
		w.__diag = [];
		document.addEventListener(
			"transitionrun",
			(event) => {
				const e = event as TransitionEvent;
				const t = e.target as Element;
				const anims = t
					.getAnimations({ subtree: true })
					.filter(
						(a) =>
							(a as CSSTransition).transitionProperty === e.propertyName &&
							(a.effect as KeyframeEffect).target === t,
					);
				w.__diag.push([
					t.tagName,
					t.getAttribute("aria-label") ?? "",
					e.propertyName,
					anims.map((a) => [a.playState, a.currentTime]),
					Math.round(performance.now()),
				]);
			},
			true,
		);
	});
	await button.click();
	await page.waitForTimeout(400);
	const log = await page.evaluate(
		() => (window as unknown as { __diag: unknown[] }).__diag,
	);
	console.log(`[DIAG-b249] ${testInfo.project.name} ${JSON.stringify(log)}`);
});
