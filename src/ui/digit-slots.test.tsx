import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DigitSlots } from "./digit-slots";

const slots = (
	<DigitSlots
		length={3}
		value=""
		disabled={false}
		onChange={() => {}}
		onSubmit={() => {}}
	/>
);

afterEach(() => {
	cleanup();
	document.body.replaceChildren();
});

test("the first slot takes the focus when the slots mount", () => {
	render(slots);
	expect(document.activeElement).toBe(screen.getByLabelText("Digit 1 of 3"));
});

// A modal dialog (the Name confirm) can open before the page behind it
// mounts its slots: the page must not take the focus from the dialog.
test("the slots leave the focus alone when it is inside a dialog", () => {
	const dialog = document.createElement("dialog");
	dialog.setAttribute("open", "");
	const field = document.createElement("input");
	dialog.append(field);
	document.body.append(dialog);
	field.focus();
	render(slots);
	expect(document.activeElement).toBe(field);
});

// The Account menu is a plain panel, not a dialog: a player can open it
// before the page behind it mounts its slots (issue 306).
test("the slots leave the focus alone when a button has it", () => {
	const button = document.createElement("button");
	document.body.append(button);
	button.focus();
	render(slots);
	expect(document.activeElement).toBe(button);
});

test("the slots leave the focus alone when an element in an open menu has it", () => {
	const menu = document.createElement("div");
	menu.setAttribute("role", "menu");
	const item = document.createElement("button");
	menu.append(item);
	document.body.append(menu);
	item.focus();
	render(slots);
	expect(document.activeElement).toBe(item);
});
