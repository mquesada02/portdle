import { screen, within } from "@testing-library/react";
import type { KeyValueStore } from "../persist/storage";

export function memoryStore(
	data: Map<string, string> = new Map(),
): KeyValueStore & { data: Map<string, string> } {
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => {
			data.set(key, value);
		},
	};
}

// The first of the N "Digit n of N" slots in the "Port digits" group,
// shared by the Daily and Blitz Default test suites since both render the
// same digit-slot control.
export function portDigits(): HTMLElement {
	const [first] = within(
		screen.getByRole("group", { name: "Port digits" }),
	).getAllByRole("textbox");
	if (!first) {
		throw new Error("no digit slots found");
	}
	return first;
}

export function stubMatchMedia(
	prefersDark = false,
	prefersReducedMotion = false,
) {
	window.matchMedia = (query: string) => ({
		matches:
			(prefersDark && query.includes("prefers-color-scheme: dark")) ||
			(prefersReducedMotion &&
				query.includes("prefers-reduced-motion: reduce")),
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	});
}
