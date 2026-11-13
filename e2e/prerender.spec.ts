// Checks on the prerendered build, served the way GitHub Pages serves it: the
// bundle loads after the first paint, hydrates without an error, and the first
// paint comes from the prerendered markup.

import { expect, test } from "@playwright/test";
import { HEAD } from "../src/ui/head.ts";
import { dayBefore, dismissHowTo, serverToday } from "./helpers.ts";

// The URL of each page route. One file serves every board, so the board route
// takes a valid query.
async function routeUrls(): Promise<string[]> {
	const yesterday = dayBefore(await serverToday());
	return Object.keys(HEAD).map((route) =>
		route === "/archive/board"
			? `/portdle/archive/board?category=mixed&date=${yesterday}`
			: `/portdle${route === "/" ? "/" : route}`,
	);
}

test("an old board link lands on the new board URL and shows that board", async ({
	page,
}) => {
	const yesterday = dayBefore(await serverToday());
	const query = `category=applications&date=${yesterday}`;

	await page.goto(`/portdle/archive/applications/${yesterday}`);
	await dismissHowTo(page);
	await expect(page).toHaveURL(`/portdle/archive/board?${query}`);
	await expect(page.getByText(new RegExp(`· ${yesterday}$`))).toBeVisible();
});

test("every prerendered route hydrates with no error", async ({ page }) => {
	const problems: string[] = [];
	page.on("console", (message) => {
		if (message.type() === "error") {
			problems.push(`console: ${message.text()}`);
		}
	});
	page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

	for (const url of await routeUrls()) {
		await page.goto(url);
		// The How-to dialog opens in an effect, so it shows once the bundle has
		// hydrated the page. Clear the device so the next route shows it again.
		await dismissHowTo(page);
		await page.evaluate(() => localStorage.clear());
	}
	expect(problems).toEqual([]);
});

test("the bundle loads after the load event", async ({ page }) => {
	await page.goto("/portdle/");
	await dismissHowTo(page);
	const starts = await page.evaluate(() => {
		const [navigation] = performance.getEntriesByType(
			"navigation",
		) as PerformanceNavigationTiming[];
		const bundles = performance
			.getEntriesByType("resource")
			.filter((entry) => /\/portdle\/assets\/[^/]+\.js$/.test(entry.name));
		return {
			loadEventStart: navigation?.loadEventStart ?? 0,
			bundles: bundles.map((entry) => entry.startTime),
		};
	});
	expect(starts.loadEventStart).toBeGreaterThan(0);
	expect(starts.bundles.length).toBeGreaterThan(0);
	for (const start of starts.bundles) {
		expect(start).toBeGreaterThanOrEqual(starts.loadEventStart);
	}
});

test("the largest contentful paint of each page is in the prerendered markup", async ({
	page,
	browserName,
}) => {
	test.skip(
		browserName !== "chromium",
		"Only Chromium reports largest-contentful-paint entries.",
	);
	// No bundle runs, so nothing that renders after data arrives can be the
	// candidate: it comes from the prerendered markup.
	await page.route("**/portdle/assets/*.js", () => new Promise(() => {}));
	for (const url of await routeUrls()) {
		await page.goto(url);
		const inRoot = await page.evaluate(
			() =>
				new Promise<boolean>((resolve) => {
					new PerformanceObserver((list) => {
						const entry = list.getEntries().at(-1) as
							| (PerformanceEntry & { element: Element | null })
							| undefined;
						resolve(
							entry?.element != null &&
								document.getElementById("root")?.contains(entry.element) ===
									true,
						);
					}).observe({ type: "largest-contentful-paint", buffered: true });
				}),
		);
		expect(inRoot, url).toBe(true);
	}
});
