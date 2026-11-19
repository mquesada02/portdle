import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { createPersist } from "../persist/storage";
import { currentEntry } from "../test/blitz";
import { dailyOn, padToAnswer } from "../test/dailies";
import { createFakeRemote } from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	portDigits,
	stubMatchMedia,
} from "../test/helpers";
import { App } from "./app";

// Fixture: the Mixed Daily on UTC_TODAY is Nuxt, port 3000 (four slots).
const mixedAnswer = dailyOn("mixed");

async function renderAt(path: string, coarsePointer: boolean) {
	stubMatchMedia(false, false, 0, coarsePointer);
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			remote={createFakeRemote()}
			history={createMemoryHistory({ initialEntries: [`/portdle${path}`] })}
		/>,
	);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
}

function keypad() {
	return screen.getByRole("group", { name: "Keypad" });
}

async function tapKeys(user: ReturnType<typeof userEvent.setup>, keys: string) {
	for (const key of keys) {
		await user.click(
			within(keypad()).getByRole("button", {
				name: new RegExp(`^${key}(,|$)`),
			}),
		);
	}
}

function slotValues() {
	return within(screen.getByRole("group", { name: "Port digits" }))
		.getAllByRole("textbox")
		.map((slot) => (slot as HTMLInputElement).value)
		.join("");
}

afterEach(() => {
	cleanup();
});

test("on a touch screen the Daily shows the keypad, one Submit, and slots that open no keyboard", async () => {
	await renderAt("/", true);
	const keys = within(keypad())
		.getAllByRole("button")
		.map((key) => key.getAttribute("aria-label") ?? key.textContent);
	expect(keys).toEqual([
		"1, unknown",
		"2, unknown",
		"3, unknown",
		"4, unknown",
		"5, unknown",
		"6, unknown",
		"7, unknown",
		"8, unknown",
		"9, unknown",
		"Backspace",
		"0, unknown",
		"Submit",
	]);
	expect(screen.getAllByRole("button", { name: "Submit" })).toHaveLength(1);
	expect(portDigits().getAttribute("inputmode")).toBe("none");
});

test("after a miss each Daily keypad key shows and says its mark", async () => {
	const user = userEvent.setup();
	await renderAt("/", true);
	await tapKeys(user, padToAnswer(80, mixedAnswer));
	await user.click(within(keypad()).getByRole("button", { name: "Submit" }));
	// "0080" against "3000": 0 is placed, 8 is absent, the rest were not typed.
	const placed = within(keypad()).getByRole("button", { name: "0, placed" });
	expect(placed.className).toContain("bg-emerald-500");
	const absent = within(keypad()).getByRole("button", { name: "8, absent" });
	expect(absent.className).toContain("bg-zinc-500");
	const unknown = within(keypad()).getByRole("button", { name: "1, unknown" });
	expect(unknown.className).toContain("bg-zinc-100");
	expect(
		within(keypad()).getByRole("button", { name: "Backspace" }),
	).toBeTruthy();
});

test("keypad keys and its Submit commit a guess as typing and Enter do", async () => {
	const user = userEvent.setup();
	await renderAt("/", true);
	await tapKeys(user, padToAnswer(80, mixedAnswer));
	expect(slotValues()).toBe("0080");
	await user.click(within(keypad()).getByRole("button", { name: "Submit" }));
	expect(screen.getByText("1 / 6")).toBeTruthy();
	expect(slotValues()).toBe("");
});

test("the keypad's Backspace removes the last digit", async () => {
	const user = userEvent.setup();
	await renderAt("/", true);
	await tapKeys(user, "12");
	await user.click(within(keypad()).getByRole("button", { name: "Backspace" }));
	expect(slotValues()).toBe("1");
});

test("an incomplete guess from the keypad shows the not-enough-digits message and spends nothing", async () => {
	const user = userEvent.setup();
	await renderAt("/", true);
	await tapKeys(user, "80");
	await user.click(within(keypad()).getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Not enough digits.")).toBeTruthy();
	expect(screen.getByText("0 / 6")).toBeTruthy();
});

test("a hardware keyboard still types and submits with a coarse pointer", async () => {
	const user = userEvent.setup();
	await renderAt("/", true);
	await user.type(portDigits(), `${padToAnswer(80, mixedAnswer)}{Enter}`);
	expect(screen.getByText("1 / 6")).toBeTruthy();
});

test("with a fine pointer the Daily has no keypad and keeps its Submit button and numeric slots", async () => {
	await renderAt("/", false);
	expect(screen.queryByRole("group", { name: "Keypad" })).toBeNull();
	expect(screen.getAllByRole("button", { name: "Submit" })).toHaveLength(1);
	expect(portDigits().getAttribute("inputmode")).toBe("numeric");
	expect(screen.getByRole("group", { name: "Tracker strip" })).toBeTruthy();
});

test("Blitz Default has the keypad on a touch screen and Blitz Inverted has none", async () => {
	const user = userEvent.setup();
	await renderAt("/blitz", true);
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const keyNames = within(keypad())
		.getAllByRole("button")
		.map((key) => key.getAttribute("aria-label") ?? key.textContent);
	expect(keyNames).toEqual([
		..."123456789".split(""),
		"Backspace",
		"0",
		"Submit",
	]);
	const answer = currentEntry();
	await tapKeys(user, padToAnswer(answer.port, answer));
	await user.click(within(keypad()).getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Score 1")).toBeTruthy();

	cleanup();
	await renderAt("/blitz", true);
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("radio", { name: "Inverted" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	expect(screen.queryByRole("group", { name: "Keypad" })).toBeNull();
});
