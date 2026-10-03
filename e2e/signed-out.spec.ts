import { expect, test } from "@playwright/test";
import {
	answerFor,
	dayBefore,
	dismissHowTo,
	puzzleNumberFor,
	serverToday,
	stackApiUrl,
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

test("the error panel shows when the stack is unreachable and recovers", async ({
	page,
}) => {
	const today = await serverToday();
	const answer = await answerFor("mixed", today);
	// "Stack stopped" is read as "stack unreachable" (owner decision): the
	// browser cannot reach the stack's REST address.
	const restRoutes = `${stackApiUrl()}/rest/v1/**`;
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

test("an Archive late play appears in History", async ({ page }) => {
	const yesterday = dayBefore(await serverToday());
	const answer = await answerFor("applications", yesterday);
	const row = page.locator(`a[href$="/archive/applications/${yesterday}"]`);

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
