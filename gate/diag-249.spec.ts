// DIAG #249 probe, branch diag/249 only. Logs the hover transition of the
// clicked nav link at the moment the view transition starts.
import { expect, test } from "./fixtures.ts";
import { openGame, PLAYED } from "./state.ts";

test("DIAG probe: hover transition at view transition start", async ({
	page,
}, testInfo) => {
	if (testInfo.project.use.reducedMotion === "reduce") {
		test.skip();
	}
	await openGame(page, testInfo, { records: PLAYED });
	await expect(page.getByText("Global distribution")).toBeVisible();
	const link = page
		.getByRole("navigation", { name: "Main" })
		.getByRole("link", { name: "History" });
	await page.evaluate(() => {
		const w = window as unknown as { __diag: unknown[] };
		w.__diag = [];
		const a = Array.from(document.querySelectorAll("nav a")).find((x) =>
			x.textContent?.includes("History"),
		) as HTMLElement;
		const t0 = performance.timeOrigin;
		document.addEventListener("mousemove", () =>
			w.__diag.push(["mousemove", Date.now()]),
		);
		const start = document.startViewTransition.bind(document);
		document.startViewTransition = (...args: Parameters<typeof start>) => {
			w.__diag.push([
				"vt-start",
				Date.now(),
				getComputedStyle(a).color,
				a.getAnimations().map((x) => [
					(x as CSSTransition).transitionProperty,
					x.currentTime,
				]),
				a.matches(":hover"),
			]);
			return start(...args);
		};
		void t0;
	});
	await page.evaluate(() => {
		const w = window as unknown as { __diag: unknown[] };
		document.addEventListener(
			"transitionrun",
			(event) => {
				const e = event as TransitionEvent;
				const t = e.target as Element;
				const anims = t
					.getAnimations()
					.filter(
						(a) => (a as CSSTransition).transitionProperty === e.propertyName,
					);
				w.__diag.push([
					"run",
					t.textContent?.slice(0, 8),
					e.propertyName,
					anims.map((a) => [a.playState, a.currentTime]),
				]);
			},
			true,
		);
	});
	await link.hover();
	await page.waitForTimeout(400);
	await link.click();
	await page.waitForTimeout(300);
	const log = (await page.evaluate(
		() => (window as unknown as { __diag: unknown[] }).__diag,
	)) as unknown[][];
	console.log(`[DIAG-a249] ${testInfo.project.name} ${JSON.stringify(log)}`);
});
