// Input edges: the computed border color of each input control at rest, in the
// light and dark projects. A resting edge must have at least 3:1 contrast
// (WCAG 2.2, 1.4.11 Non-text Contrast) against the background it sits on. An
// empty, a filled, and a focused digit slot show three different edges, and so
// do the rest, hover, and selected states of a choice chip. Frames are not
// compared here: the controls' frames are the other gate tests.

import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect, isReduced, test } from "./fixtures.ts";
import { waitForQuiet } from "./freeze.ts";
import { seedStorage } from "./seed.ts";
import { openGame } from "./state.ts";

const MIN_CONTRAST = 3;

type Rgba = [number, number, number, number];

// The edge color of the control, and the background of its nearest ancestor
// with an opaque background. A color is read as sRGB by painting it on a 1 x 1
// canvas, so the test does not depend on how an engine writes the color
// (`rgb()`, `oklch()`).
async function readEdge(
	control: Locator,
): Promise<{ edge: Rgba; background: Rgba }> {
	return control.evaluate((element) => {
		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) {
			throw new Error("No 2d canvas.");
		}
		const toRgba = (color: string): Rgba => {
			context.clearRect(0, 0, 1, 1);
			context.fillStyle = "#000000";
			context.fillStyle = color;
			context.fillRect(0, 0, 1, 1);
			const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(
				0,
				0,
				1,
				1,
			).data;
			return [r, g, b, a];
		};
		const edge = toRgba(getComputedStyle(element).borderTopColor);
		let background: Rgba | null = null;
		for (
			let node: Element | null = element.parentElement;
			node;
			node = node.parentElement
		) {
			const color = toRgba(getComputedStyle(node).backgroundColor);
			if (color[3] === 255) {
				background = color;
				break;
			}
		}
		if (!background) {
			throw new Error("No ancestor with an opaque background.");
		}
		return { edge, background };
	});
}

function luminance([r, g, b]: Rgba): number {
	const channel = (value: number) => {
		const unit = value / 255;
		return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgba, b: Rgba): number {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

// The resting edge of the control has the contrast, against its background.
async function expectRestingEdge(control: Locator): Promise<Rgba> {
	await waitForQuiet(control.page());
	const { edge, background } = await readEdge(control);
	expect(
		contrast(edge, background),
		`edge ${edge.join(",")} on ${background.join(",")}`,
	).toBeGreaterThanOrEqual(MIN_CONTRAST);
	return edge;
}

function expectDistinct(colors: Rgba[]): void {
	expect(new Set(colors.map((color) => color.join(","))).size).toBe(
		colors.length,
	);
}

// The first chip of the fieldset, selected or not.
function chip(scope: Locator, selected: boolean): Locator {
	return scope
		.locator("fieldset")
		.first()
		.locator(
			selected ? "label:has(input:checked)" : "label:has(input:not(:checked))",
		)
		.first();
}

// The rest, hover, and selected edge of the chips in the fieldset. Each state
// is read with the pointer where the state needs it. Only the rest edge has the
// 3:1 check; the three edges must differ.
async function expectChipStates(page: Page, scope: Locator): Promise<void> {
	const resting = chip(scope, false);
	await page.mouse.move(0, 0);
	const rest = await expectRestingEdge(resting);
	await resting.hover();
	await waitForQuiet(page);
	const hover = (await readEdge(resting)).edge;
	await page.mouse.move(0, 0);
	await waitForQuiet(page);
	const selected = (await readEdge(chip(scope, true))).edge;
	expectDistinct([rest, hover, selected]);
}

function skipReduced(testInfo: TestInfo): void {
	test.skip(isReduced(testInfo), "The colors do not depend on motion.");
}

async function openSetup(page: Page, testInfo: TestInfo) {
	await seedStorage(page);
	await openGame(page, testInfo, { path: "/portdle/blitz" });
	await page.getByRole("button", { name: "New run" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	// The dialog opens on the last run's Sprint.
	await page.getByRole("dialog").getByText("Survival", { exact: true }).click();
}

test("digit slots: empty, filled, and focused", async ({ page }, testInfo) => {
	skipReduced(testInfo);
	// The Applications Daily is Rails, port 3000: four slots. The first slot
	// takes focus on mount, so after one digit slot 1 is filled and unfocused,
	// slot 2 is empty and focused, and slot 4 is empty and unfocused.
	await openGame(page, testInfo, { path: "/portdle/applications" });
	await page.getByLabel("Digit 1 of 4").click();
	await page.keyboard.type("3");
	const focused = page.getByLabel("Digit 2 of 4");
	await expect(focused).toBeFocused();
	await expect(page.getByLabel("Digit 1 of 4")).toHaveValue("3");
	await expect(page.getByLabel("Digit 4 of 4")).not.toBeFocused();
	await waitForQuiet(page);
	const empty = await expectRestingEdge(page.getByLabel("Digit 4 of 4"));
	const filled = (await readEdge(page.getByLabel("Digit 1 of 4"))).edge;
	const focus = (await readEdge(focused)).edge;
	expectDistinct([empty, filled, focus]);
});

test("Blitz run: digit slot at rest", async ({ page }, testInfo) => {
	skipReduced(testInfo);
	await openSetup(page, testInfo);
	await page.getByRole("dialog").getByText("Default", { exact: true }).click();
	await page.getByRole("button", { name: "Start" }).click();
	await expect(page.getByText("Round 1")).toBeVisible();
	// The first puzzle is the same on every run (the seeded random source). A
	// puzzle of one digit has only the focused slot, so the test needs two.
	const slots = page.locator("input[aria-label^='Digit ']");
	expect(await slots.count()).toBeGreaterThanOrEqual(2);
	await expectRestingEdge(slots.last());
});

test("Blitz inverted arena: service-name field at rest", async ({
	page,
}, testInfo) => {
	skipReduced(testInfo);
	await openSetup(page, testInfo);
	await page.getByRole("dialog").getByText("Inverted", { exact: true }).click();
	await page.getByRole("button", { name: "Start" }).click();
	await expect(page.getByText("Round 1")).toBeVisible();
	await expectRestingEdge(page.getByRole("combobox", { name: "Service name" }));
});

test("Blitz setup chips: rest, hover, and selected", async ({
	page,
}, testInfo) => {
	skipReduced(testInfo);
	await openSetup(page, testInfo);
	const dialog = page.getByRole("dialog");
	// The first fieldset is the Daily category: one selected chip and two others.
	await expectChipStates(page, dialog);
});

test.describe("confirmed name", () => {
	test.use({ account: "confirmed" });

	test("name editor field at rest", async ({ page }, testInfo) => {
		skipReduced(testInfo);
		await page.goto("/portdle/");
		await page.getByRole("button", { name: "Account", exact: true }).click();
		await page.getByRole("button", { name: "Edit display name" }).click();
		const field = page.getByLabel("Display name");
		// The editor focuses its field; the focus edge is not the resting edge.
		await expect(field).toBeFocused();
		await field.blur();
		await expectRestingEdge(field);
	});

	test("Leaderboards chips: rest, hover, and selected", async ({
		page,
	}, testInfo) => {
		skipReduced(testInfo);
		await page.goto("/portdle/blitz");
		await page.getByRole("tab", { name: "Leaderboards" }).click();
		await expect(page.getByRole("cell", { name: "Swift Otter" })).toBeVisible();
		await expectChipStates(page, page.getByRole("tabpanel"));
	});
});

test.describe("unconfirmed name", () => {
	test.use({ account: "unconfirmed" });

	test("name confirm field at rest", async ({ page }, testInfo) => {
		skipReduced(testInfo);
		await page.goto("/portdle/");
		const dialog = page.getByRole("dialog");
		await expect(
			page.getByRole("heading", { name: "Confirm your display name" }),
		).toBeVisible();
		const field = dialog.getByRole("textbox");
		await field.blur();
		await expectRestingEdge(field);
	});
});
