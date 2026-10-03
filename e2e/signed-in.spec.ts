import { expect, test } from "@playwright/test";
import {
	answerFor,
	dayBefore,
	openFinishedBoard,
	serverToday,
	signIn,
	storedDaily,
} from "./helpers.ts";

// The test account keeps what an earlier run synced (nothing can delete rows),
// so each spec ends on the same asserted state on a first run and on a rerun.

test("a signed-in late play syncs its late mark", async ({ browser }) => {
	const yesterday = dayBefore(await serverToday());
	const answer = await answerFor("applications", yesterday);
	const session = await signIn();
	const context = await browser.newContext();
	await session.storeIn(context);
	const page = await context.newPage();

	await openFinishedBoard(
		page,
		`/portdle/archive/applications/${yesterday}`,
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
	await context.close();
});

test("global stats appear after a signed-in on-day finish", async ({
	browser,
}) => {
	const today = await serverToday();
	const answer = await answerFor("protocols", today);
	const session = await signIn();
	const context = await browser.newContext();
	await session.storeIn(context);
	const page = await context.newPage();

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
	await context.close();
});
