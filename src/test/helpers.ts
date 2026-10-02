import { screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";
import type { KeyValueStore } from "../persist/storage";

export function memoryStore(
	data: Map<string, string> = new Map(),
): KeyValueStore & { data: Map<string, string> } {
	return {
		data,
		get length() {
			return data.size;
		},
		key: (index) => [...data.keys()][index] ?? null,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => {
			data.set(key, value);
		},
		removeItem: (key) => {
			data.delete(key);
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

// Installs a fake View Transitions API the way src/router.tsx's
// defaultViewTransition (and src/ui/view-transition.ts's runViewTransition)
// expect it: document.startViewTransition present, and window.CSS.supports
// reporting support for the selector the router and the helper both check
// before passing types through. Records each call's resolved types.
export function stubViewTransitions() {
	const calls: string[][] = [];
	const originalStart = document.startViewTransition;
	const originalSupports = window.CSS.supports;
	document.startViewTransition = ((
		options: ViewTransitionUpdateCallback | StartViewTransitionOptions,
	) => {
		if (typeof options === "function") {
			calls.push([]);
			options();
		} else {
			calls.push(options.types ?? []);
			options.update?.();
		}
		return {
			ready: Promise.resolve(),
			updateCallbackDone: Promise.resolve(),
			finished: Promise.resolve(),
			skipTransition: () => {},
			types: new Set<string>(),
		} as ViewTransition;
	}) as Document["startViewTransition"];
	window.CSS.supports = (() => true) as typeof window.CSS.supports;
	return {
		calls,
		restore() {
			document.startViewTransition = originalStart;
			window.CSS.supports = originalSupports;
		},
	};
}

// Waits until the server reads of the Daily, Blitz, and the Codex have
// settled: no screen shows the loading line any more.
export async function loaded() {
	await waitFor(() => {
		expect(screen.queryByText("Loading...")).toBeNull();
	});
}

// Lets every pending promise step and zero-delay timer run.
export const flush = () =>
	new Promise<void>((resolve) => setTimeout(resolve, 0));
