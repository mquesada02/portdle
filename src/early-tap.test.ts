import { beforeAll, beforeEach, expect, test } from "vitest";
import {
	EARLY_TAP_GLOBAL,
	replayEarlyTap,
	stopEarlyTapCapture,
} from "./early-tap";
import script from "./early-tap-script.js?raw";

type State = {
	stopped: boolean;
	tap: { button: HTMLButtonElement; text: string | null } | null;
};
const state = () =>
	(window as unknown as Record<string, State>)[EARLY_TAP_GLOBAL] as State;

// The script adds a window listener, so it runs once for the whole file.
beforeAll(() => {
	new Function(script)();
});

beforeEach(() => {
	state().stopped = false;
	state().tap = null;
	document.body.innerHTML = "";
});

function button(text: string): {
	button: HTMLButtonElement;
	clicks: () => number;
} {
	const element = document.createElement("button");
	element.innerHTML = `<span>${text}</span>`;
	document.body.append(element);
	let count = 0;
	element.addEventListener("click", () => {
		count += 1;
	});
	return { button: element, clicks: () => count };
}

function tap(target: Element): boolean {
	const event = new MouseEvent("click", { bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event.defaultPrevented;
}

test("the script sets the global that the app reads", () => {
	expect(script).toContain(`window.${EARLY_TAP_GLOBAL} =`);
});

test("the script holds no <, so it can be inlined in a script tag", () => {
	expect(script).not.toContain("<");
});

test("a tap inside a button is stored and its default is stopped", () => {
	const { button: element } = button("Got it");
	expect(tap(element.firstElementChild as Element)).toBe(true);
	expect(state().tap).toEqual({ button: element, text: "Got it" });
});

test("a tap outside a button is not stored", () => {
	const paragraph = document.createElement("p");
	document.body.append(paragraph);
	expect(tap(paragraph)).toBe(false);
	expect(state().tap).toBeNull();
});

test("after the capture stops, a tap is not stored or stopped", () => {
	const { button: element } = button("Got it");
	stopEarlyTapCapture();
	expect(tap(element)).toBe(false);
	expect(state().tap).toBeNull();
});

test("only the last tap is kept", () => {
	const first = button("One");
	const second = button("Two");
	tap(first.button);
	tap(second.button);
	expect(state().tap?.button).toBe(second.button);
});

test("the replay clicks the stored button once", () => {
	const { button: element, clicks } = button("Got it");
	tap(element);
	stopEarlyTapCapture();
	const before = clicks();
	replayEarlyTap();
	replayEarlyTap();
	expect(clicks() - before).toBe(1);
	expect(state().tap).toBeNull();
});

test.each([
	[
		"is no longer on the page",
		(element: HTMLButtonElement) => element.remove(),
	],
	[
		"is disabled",
		(element: HTMLButtonElement) => {
			element.disabled = true;
		},
	],
	[
		"shows other text",
		(element: HTMLButtonElement) => {
			element.textContent = "Share";
		},
	],
])("the replay skips a button that %s", (_name, change) => {
	const { button: element, clicks } = button("Got it");
	tap(element);
	stopEarlyTapCapture();
	const before = clicks();
	change(element);
	replayEarlyTap();
	expect(clicks()).toBe(before);
	expect(state().tap).toBeNull();
});
