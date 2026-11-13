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

// The open Account menu is not a dialog: a player can open it before the page
// behind it mounts its slots (issue 306). Its markup carries the hook.
test("the slots leave the focus alone when it is inside an open overlay", () => {
	const overlay = document.createElement("div");
	overlay.setAttribute("data-open-overlay", "");
	const button = document.createElement("button");
	overlay.append(button);
	document.body.append(overlay);
	button.focus();
	render(slots);
	expect(document.activeElement).toBe(button);
});

// Outside an overlay the slots take the focus, as a nav link or a switcher
// button can hold it after a click.
test.each(["a", "button"])(
	"the first slot takes the focus from a %s outside an overlay",
	(tag) => {
		const control = document.createElement(tag);
		control.setAttribute("href", "#");
		document.body.append(control);
		control.focus();
		render(slots);
		expect(document.activeElement).toBe(screen.getByLabelText("Digit 1 of 3"));
	},
);
