import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DigitSlots } from "./digit-slots";

afterEach(cleanup);

function slots() {
	return (
		<DigitSlots
			length={3}
			value=""
			disabled={false}
			onChange={() => {}}
			onSubmit={() => {}}
		/>
	);
}

test("the first slot takes the focus when the slots mount", () => {
	render(slots());
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
	try {
		render(slots());
		expect(document.activeElement).toBe(field);
	} finally {
		dialog.remove();
	}
});
