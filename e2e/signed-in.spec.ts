import { expect, test } from "@playwright/test";
import {
	answerFor,
	dayBefore,
	openFinishedBoard,
	serverToday,
	storedDaily,
	withSignedInPage,
} from "./helpers.ts";

// Each project's test user keeps what an earlier run synced (nothing can
// delete rows), so each spec ends on the same asserted state on a first run
// and on a rerun.

test("a signed-in late play syncs its late mark", async ({
	browser,
}, testInfo) => {
	const project = testInfo.project.name;
	const yesterday = dayBefore(await serverToday());
	const answer = await answerFor("applications", yesterday);

	await withSignedInPage(browser, project, async (page, session) => {
		await openFinishedBoard(
			page,
			`/portdle/archive/board?category=applications&date=${yesterday}`,
			"applications",
			yesterday,
			answer.port,
		);
		await expect(page.getByText("Late play, not counted")).toBeVisible();

		// The push runs after the finish, so the stored row is polled.
		await expect
			.poll(() => storedDaily(session.accessToken, "applications", yesterday), {
				timeout: 15_000,
			})
			.toMatchObject({ status: "won", late: true });
	});
});

test("global stats appear after a signed-in on-day finish", async ({
	browser,
}, testInfo) => {
	const project = testInfo.project.name;
	const today = await serverToday();
	const answer = await answerFor("protocols", today);

	await withSignedInPage(browser, project, async (page) => {
		await openFinishedBoard(
			page,
			"/portdle/protocols",
			"protocols",
			today,
			answer.port,
		);

		await expect(
			page.getByRole("heading", { name: "Global stats" }),
		).toBeVisible();
		const players = page
			.locator("dt", { hasText: "Players" })
			.locator("xpath=following-sibling::dd");
		await expect(players).toHaveText(/^[1-9]\d*$/, { timeout: 15_000 });
		// The own result, a win in one try, is the highlighted bar.
		const highlighted = page.locator('li[aria-current="true"]');
		await expect(highlighted).toHaveCount(1);
		await expect(highlighted.locator("span").first()).toHaveText("1");
	});
});
