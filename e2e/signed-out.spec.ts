import { expect, test } from "@playwright/test";
import { boardCanonical, HEAD } from "../src/ui/head.ts";
import {
	answerFor,
	dayBefore,
	dismissHowTo,
	puzzleNumberFor,
	serverToday,
	stack,
	submitAnswer,
} from "./helpers.ts";

test("a signed-out player loads and finishes the Daily", async ({ page }) => {
	const today = await serverToday();
	const answer = await answerFor("mixed", today);

	await page.goto("/portdle/");
	await dismissHowTo(page);
	await expect(
		page.getByText(`#${puzzleNumberFor(today)} · ${today}`),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 1, name: answer.name }),
	).toBeVisible();

	await submitAnswer(page, answer.port);
	await expect(page.getByText("Solved", { exact: true })).toBeVisible();
	// The Reveal names the port; the guess tiles show it too, so match the
	// Reveal's paragraph.
	await expect(
		page.locator("p", { hasText: new RegExp(`^${answer.port}$`) }),
	).toBeVisible();

	// Global stats show to every finisher; a signed-out finish adds no row, so
	// no count is asserted.
	await expect(
		page.getByRole("heading", { name: "Global stats" }),
	).toBeVisible();
	await expect(page.getByText("Players", { exact: true })).toBeVisible();
	await expect(page.getByText("Solve rate", { exact: true })).toBeVisible();
	await expect(page.getByText("Global distribution")).toBeVisible();
});

test("in-app navigation updates the tab title", async ({ page }) => {
	await page.goto("/portdle/");
	await dismissHowTo(page);
	await expect(page).toHaveTitle(HEAD["/"]?.title ?? "");

	const nav = page.getByRole("navigation", { name: "Main" });
	for (const [name, route] of [
		["Blitz", "/blitz"],
		["Codex", "/codex"],
		["History", "/history"],
	] as const) {
		await nav.getByRole("link", { name }).click();
		await expect(page).toHaveTitle(HEAD[route]?.title ?? "");
	}
});

test("the error panel shows when the stack is unreachable and recovers", async ({
	page,
}) => {
	const today = await serverToday();
	const answer = await answerFor("mixed", today);
	// "Stack stopped" is read as "stack unreachable" (owner decision): the
	// browser cannot reach the stack's REST address.
	const restRoutes = `${stack().apiUrl}/rest/v1/**`;
	await page.route(restRoutes, (route) => route.abort());

	await page.goto("/portdle/");
	await dismissHowTo(page);
	await expect(
		page.getByText("Portdle's server isn't answering. Try again in a moment."),
	).toBeVisible();

	await page.unroute(restRoutes);
	await page.getByRole("button", { name: "Try again" }).click();
	await expect(
		page.getByRole("heading", { level: 1, name: answer.name }),
	).toBeVisible();
});

test("a board opened from the Archive list has the new URL and its canonical link", async ({
	page,
}) => {
	const yesterday = dayBefore(await serverToday());
	const query = `category=applications&date=${yesterday}`;

	await page.goto("/portdle/archive");
	await dismissHowTo(page);
	await page.locator(`a[href$="/archive/board?${query}"]`).click();
	await expect(page).toHaveURL(`/portdle/archive/board?${query}`);
	await expect(
		page.getByText(`#${puzzleNumberFor(yesterday)} · ${yesterday}`),
	).toBeVisible();
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		"href",
		boardCanonical({ category: "applications", date: yesterday }),
	);
});

test("an Archive late play appears in History", async ({ page }) => {
	const yesterday = dayBefore(await serverToday());
	const answer = await answerFor("applications", yesterday);
	const row = page.locator(
		`a[href$="/archive/board?category=applications&date=${yesterday}"]`,
	);

	await page.goto("/portdle/archive");
	await dismissHowTo(page);
	await row.click();
	await expect(
		page.getByText(`#${puzzleNumberFor(yesterday)} · ${yesterday}`),
	).toBeVisible();

	await submitAnswer(page, answer.port);
	await expect(page.getByText("Solved", { exact: true })).toBeVisible();
	await expect(page.getByText("Late play, not counted")).toBeVisible();

	await page.getByRole("link", { name: "History" }).click();
	await expect(row).toContainText(`#${puzzleNumberFor(yesterday)}`);
	await expect(row).toContainText("Won 1/6");
	await expect(row).toContainText(answer.name);
	await expect(row).toContainText(String(answer.port));
});

for (const [name, path, title] of [
	["the app", "/portdle/", null],
	["the privacy page", "/portdle/privacy.html", "Privacy - Portdle"],
] as const) {
	for (const [stored, scheme] of [
		["dark", "light"],
		["light", "dark"],
	] as const) {
		test(`${name} paints a stored ${stored} theme before the bundle loads`, async ({
			page,
		}) => {
			// Hold every bundle request: the theme must come from the head script.
			await page.route("**/portdle/assets/*.js", () => new Promise(() => {}));
			await page.emulateMedia({ colorScheme: scheme });
			await page.addInitScript((theme) => {
				localStorage.setItem("portdle:v1:theme", JSON.stringify(theme));
			}, stored);
			// The default wait is the `load` event, which needs the held bundle.
			const response = await page.goto(path, { waitUntil: "commit" });
			expect(response?.status()).toBe(200);
			// An inline script runs as soon as the parser reaches it, so an
			// attached head script has already set the class.
			await expect(page.locator("head script").first()).toBeAttached();
			const html = page.locator("html");
			if (stored === "dark") {
				await expect(html).toHaveClass(/\bdark\b/);
			} else {
				await expect(html).not.toHaveClass(/\bdark\b/);
			}
			if (title) {
				await expect(page).toHaveTitle(title);
			}
		});
	}
}
