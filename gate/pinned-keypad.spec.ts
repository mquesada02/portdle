// The input block of the Daily board (digit slots, marks strip, message line,
// keypad) is pinned above the phone tab bar on a touch screen that is narrower
// than 768 px and at least 650 px tall (#337). The test reads boxes and takes no
// screenshot. One project is enough: the viewport is set in each test.

import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect, isReduced, test } from "./fixtures.ts";
import { ARCHIVE_ONE_MISS, openGame, playingMixed, WON } from "./state.ts";

test.beforeEach(({ browserName }, testInfo) => {
	test.skip(
		browserName !== "chromium" ||
			isReduced(testInfo) ||
			testInfo.project.name !== "chromium-375-light",
		"A layout test: one Chromium project, with a viewport per test.",
	);
});

// "Directly above": a pinned Submit key ends this close to the tab bar's top.
const DIRECTLY_ABOVE = 16;

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: Locator): Promise<Box> {
	const found = await locator.boundingBox();
	expect(found, "the element has a box").not.toBeNull();
	return found as Box;
}

function submitKey(page: Page): Locator {
	return page
		.getByRole("group", { name: "Keypad" })
		.getByRole("button", { name: "Submit" });
}

function tabBar(page: Page): Locator {
	return page.getByRole("navigation", { name: "Main" });
}

// The parts of the input block, in screen order.
function parts(page: Page): Locator[] {
	return [
		page.getByLabel("Digit 1 of 2"),
		page.getByRole("group", { name: "Tracker strip" }),
		page.locator("main p[aria-live='polite']"),
		page.getByRole("group", { name: "Keypad" }),
	];
}

async function open(
	page: Page,
	testInfo: TestInfo,
	size: { width: number; height: number },
	options: Parameters<typeof openGame>[2],
): Promise<void> {
	await page.setViewportSize(size);
	await openGame(page, testInfo, options);
}

async function scrollTo(page: Page, where: "top" | "bottom"): Promise<void> {
	await page.evaluate((target) => {
		window.scrollTo({
			top: target === "top" ? 0 : document.documentElement.scrollHeight,
			behavior: "instant",
		});
	}, where);
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(resolve)),
	);
}

// How many elements in the board are `position: sticky`.
function stickyCount(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			[...document.querySelectorAll("main *")].filter(
				(element) => getComputedStyle(element).position === "sticky",
			).length,
	);
}

async function canScroll(page: Page): Promise<boolean> {
	return page.evaluate(
		() => document.documentElement.scrollHeight > window.innerHeight,
	);
}

// The block's top edge, from the top of the document.
async function documentTop(page: Page): Promise<number> {
	const slot = await box(page.getByLabel("Digit 1 of 2"));
	const scrollY = await page.evaluate(() => window.scrollY);
	return slot.y + scrollY;
}

async function expectSubmitAboveTabBar(
	page: Page,
	directlyAbove: boolean,
): Promise<void> {
	const tabTop = (await box(tabBar(page))).y;
	const submit = await box(submitKey(page));
	expect(submit.y + submit.height).toBeLessThanOrEqual(tabTop);
	if (directlyAbove) {
		expect(tabTop - (submit.y + submit.height)).toBeLessThanOrEqual(
			DIRECTLY_ABOVE,
		);
	}
}

test.describe("touch screen", () => {
	test.use({ hasTouch: true, isMobile: true });

	for (const guesses of [0, 1, 3, 5]) {
		test(`Submit is above the tab bar with ${guesses} guesses`, async ({
			page,
		}, testInfo) => {
			await open(
				page,
				testInfo,
				{ width: 375, height: 800 },
				{
					records: guesses ? [playingMixed(guesses)] : [],
				},
			);
			await expect(submitKey(page)).toBeVisible();
			for (const where of ["top", "bottom"] as const) {
				await scrollTo(page, where);
				await expectSubmitAboveTabBar(page, guesses > 0);
			}
		});
	}

	test("the slots, the marks strip and the message line stay with the keypad", async ({
		page,
	}, testInfo) => {
		await open(
			page,
			testInfo,
			{ width: 375, height: 800 },
			{
				records: [playingMixed(1)],
			},
		);
		await expect(submitKey(page)).toBeVisible();
		expect(await canScroll(page), "the page can scroll").toBe(true);
		const tabTop = (await box(tabBar(page))).y;
		const at: Record<string, Box[]> = {};
		for (const where of ["top", "bottom"] as const) {
			await scrollTo(page, where);
			at[where] = [];
			for (const part of parts(page)) {
				at[where].push(await box(part));
			}
		}
		for (const where of ["top", "bottom"]) {
			const boxes = at[where] ?? [];
			boxes.forEach((part, index) => {
				expect(part.y + part.height).toBeLessThanOrEqual(tabTop);
				if (index > 0) {
					const before = boxes[index - 1] as Box;
					expect(part.y).toBeGreaterThanOrEqual(before.y + before.height - 1);
				}
			});
		}
		// Within one pixel: the fixed tab bar sits on a half pixel.
		at.top?.forEach((part, index) => {
			const later = at.bottom?.[index] as Box;
			expect(Math.abs(later.y - part.y)).toBeLessThanOrEqual(1);
			expect(later.height).toBe(part.height);
		});
	});

	test("the last guess row is above the pinned block", async ({
		page,
	}, testInfo) => {
		await open(
			page,
			testInfo,
			{ width: 375, height: 800 },
			{
				records: [playingMixed(5)],
			},
		);
		await expect(submitKey(page)).toBeVisible();
		await scrollTo(page, "bottom");
		const lastTile = await box(page.locator("main .animate-pop").last());
		const slot = await box(page.getByLabel("Digit 1 of 2"));
		expect(lastTile.y + lastTile.height).toBeLessThanOrEqual(slot.y);
	});

	test("a guess sent with the keypad keeps Submit in reach", async ({
		page,
	}, testInfo) => {
		await open(page, testInfo, { width: 375, height: 800 }, {});
		const keypad = page.getByRole("group", { name: "Keypad" });
		await keypad.getByRole("button", { name: "8", exact: true }).click();
		await keypad.getByRole("button", { name: "0", exact: true }).click();
		await submitKey(page).click();
		await expect(page.getByText("1 / 6")).toBeVisible();
		await expectSubmitAboveTabBar(page, true);
		// The same board loaded again (the guess is stored): Submit is where the
		// real flow left it.
		const afterFlow = await box(submitKey(page));
		await page.reload();
		await expect(submitKey(page)).toBeVisible();
		const afterLoad = await box(submitKey(page));
		expect(Math.abs(afterLoad.y - afterFlow.y)).toBeLessThanOrEqual(1);
	});

	for (const [size, pinned] of [
		[{ width: 375, height: 650 }, true],
		[{ width: 375, height: 649 }, false],
		[{ width: 767, height: 800 }, true],
		[{ width: 768, height: 800 }, false],
	] as const) {
		test(`the pin at ${size.width} × ${size.height} is ${pinned ? "on" : "off"}`, async ({
			page,
		}, testInfo) => {
			await open(page, testInfo, size, { records: [playingMixed(5)] });
			await expect(submitKey(page)).toBeVisible();
			expect(await stickyCount(page)).toBe(pinned ? 1 : 0);
			if (pinned) {
				await scrollTo(page, "top");
				await expectSubmitAboveTabBar(page, true);
			}
		});
	}

	for (const size of [
		{ width: 800, height: 375 },
		{ width: 768, height: 1024 },
		{ width: 768, height: 800 },
	]) {
		test(`the block is in the flow at ${size.width} × ${size.height}`, async ({
			page,
		}, testInfo) => {
			await open(page, testInfo, size, { records: [playingMixed(5)] });
			await expect(submitKey(page)).toBeVisible();
			expect(await stickyCount(page)).toBe(0);
			if (await canScroll(page)) {
				await scrollTo(page, "top");
				const top = await documentTop(page);
				await scrollTo(page, "bottom");
				expect(await documentTop(page)).toBe(top);
			}
		});
	}

	test("a finished Daily shows the Reveal with nothing pinned", async ({
		page,
	}, testInfo) => {
		await open(
			page,
			testInfo,
			{ width: 375, height: 800 },
			{
				records: [WON],
			},
		);
		await expect(page.getByText("Global distribution")).toBeVisible();
		await expect(page.getByLabel("Digit 1 of 2")).toHaveCount(0);
		await expect(page.getByRole("group", { name: "Keypad" })).toHaveCount(0);
		await expect(
			page.getByRole("group", { name: "Tracker strip" }),
		).toHaveCount(0);
		expect(await stickyCount(page)).toBe(0);
	});

	test("the Archive board pins the keypad too", async ({ page }, testInfo) => {
		await open(
			page,
			testInfo,
			{ width: 375, height: 800 },
			{
				path: "/portdle/archive/board?category=applications&date=2026-10-09",
				records: [ARCHIVE_ONE_MISS],
			},
		);
		await expect(submitKey(page)).toBeVisible();
		for (const where of ["top", "bottom"] as const) {
			await scrollTo(page, where);
			await expectSubmitAboveTabBar(page, true);
		}
	});
});

test.describe("fine pointer", () => {
	test.use({ hasTouch: false, isMobile: false });

	for (const size of [
		{ width: 375, height: 800 },
		{ width: 1024, height: 768 },
	]) {
		test(`the block is in the flow at ${size.width} × ${size.height}`, async ({
			page,
		}, testInfo) => {
			await open(page, testInfo, size, { records: [playingMixed(5)] });
			await expect(page.getByLabel("Digit 1 of 2")).toBeVisible();
			expect(await stickyCount(page)).toBe(0);
			if (await canScroll(page)) {
				await scrollTo(page, "top");
				const top = await documentTop(page);
				await scrollTo(page, "bottom");
				expect(await documentTop(page)).toBe(top);
			}
		});
	}
});
