import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { createPersist, type KeyValueStore } from "../persist/storage";
import { App } from "./app";

function memoryStore(data: Map<string, string> = new Map()): KeyValueStore {
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => {
			data.set(key, value);
		},
	};
}

function stubMatchMedia(prefersDark: boolean) {
	window.matchMedia = (query: string) => ({
		matches: prefersDark && query.includes("prefers-color-scheme: dark"),
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	});
}

async function renderApp(options: {
	persist?: ReturnType<typeof createPersist>;
	path?: string;
	prefersDark?: boolean;
}) {
	stubMatchMedia(options.prefersDark ?? false);
	const persist = options.persist ?? createPersist(memoryStore());
	const path = options.path ?? "/portdle/";
	const history = createMemoryHistory({ initialEntries: [path] });
	render(<App persist={persist} history={history} />);
	await screen.findByRole("navigation", { name: "Main" });
	return persist;
}

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
});

test("first visit shows How-to on any route", async () => {
	await renderApp({ path: "/portdle/blitz" });
	const dialog = screen.getByRole("dialog", { name: "How-to" });
	expect(dialog).toBeTruthy();
	expect(
		within(dialog).getByText("Guess the port for the named service."),
	).toBeTruthy();
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();
});

test("dismiss sets howToSeen and does not auto-open again", async () => {
	const user = userEvent.setup();
	const persist = await renderApp({});
	expect(persist.readHowToSeen()).toBe(false);
	await user.click(screen.getByRole("button", { name: "Got it" }));
	expect(persist.readHowToSeen()).toBe(true);
	expect(screen.queryByRole("dialog", { name: "How-to" })).toBeNull();
});

test("Help still shows the rules after How-to is seen", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist, path: "/portdle/help" });
	expect(screen.queryByRole("dialog", { name: "How-to" })).toBeNull();
	expect(screen.getByRole("heading", { level: 1, name: "Help" })).toBeTruthy();
	expect(
		screen.getByText("Guess the port for the named service."),
	).toBeTruthy();
	expect(
		screen.getByText(
			"6 tries. A miss names the service if that port is in this catalog.",
		),
	).toBeTruthy();
});

test("theme control toggles opposite of effective theme onto html.dark", async () => {
	const user = userEvent.setup();
	const persist = await renderApp({ prefersDark: false });
	expect(persist.readTheme()).toBe("system");
	expect(document.documentElement.classList.contains("dark")).toBe(false);
	const toggle = screen.getByRole("button", { name: "Toggle color theme" });
	await user.click(toggle);
	expect(persist.readTheme()).toBe("dark");
	expect(document.documentElement.classList.contains("dark")).toBe(true);
	await user.click(toggle);
	expect(persist.readTheme()).toBe("light");
	expect(document.documentElement.classList.contains("dark")).toBe(false);
});

test("nav links and theme control are present for keyboard users", async () => {
	await renderApp({ persist: createPersist(memoryStore()) });
	const names = [
		"Mixed",
		"Protocols",
		"Applications",
		"Blitz",
		"History",
		"Help",
	];
	for (const name of names) {
		const link = screen.getByRole("link", { name });
		expect(link.tabIndex).not.toBe(-1);
	}
	expect(
		screen.getByRole("button", { name: "Toggle color theme" }).tabIndex,
	).not.toBe(-1);
	expect(screen.getByRole("button", { name: "Got it" }).tabIndex).not.toBe(-1);
});

test("placeholder headings exist on each route", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const cases = [
		["/portdle/", "Mixed"],
		["/portdle/protocols", "Protocols"],
		["/portdle/applications", "Applications"],
		["/portdle/blitz", "Blitz"],
		["/portdle/history", "History"],
		["/portdle/help", "Help"],
	] as const;
	for (const [path, heading] of cases) {
		cleanup();
		await renderApp({ persist, path });
		expect(
			screen.getByRole("heading", { level: 1, name: heading }),
		).toBeTruthy();
	}
});
