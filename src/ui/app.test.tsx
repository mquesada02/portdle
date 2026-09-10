import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { createPersist } from "../persist/storage";
import { dailyOn } from "../test/dailies";
import { memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

async function renderApp(options: {
	persist?: ReturnType<typeof createPersist>;
	path?: string;
	prefersDark?: boolean;
	utcToday?: string;
}) {
	stubMatchMedia(options.prefersDark ?? false);
	const persist = options.persist ?? createPersist(memoryStore());
	const path = options.path ?? "/portdle/";
	const history = createMemoryHistory({ initialEntries: [path] });
	render(
		<App
			persist={persist}
			history={history}
			utcToday={options.utcToday ?? "2026-09-09"}
		/>,
	);
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

test("Escape closes How-to and sets howToSeen", async () => {
	const user = userEvent.setup();
	const persist = await renderApp({});
	expect(persist.readHowToSeen()).toBe(false);
	await user.keyboard("{Escape}");
	expect(persist.readHowToSeen()).toBe(true);
	expect(screen.queryByRole("dialog", { name: "How-to" })).toBeNull();
});

test("backdrop click closes How-to and sets howToSeen", async () => {
	const user = userEvent.setup();
	const persist = await renderApp({});
	const dialog = screen.getByRole("dialog", { name: "How-to" });
	await user.click(dialog);
	expect(persist.readHowToSeen()).toBe(true);
	expect(screen.queryByRole("dialog", { name: "How-to" })).toBeNull();
});

test("How to play button reopens How-to after it is dismissed", async () => {
	const user = userEvent.setup();
	await renderApp({});
	await user.click(screen.getByRole("button", { name: "Got it" }));
	expect(screen.queryByRole("dialog", { name: "How-to" })).toBeNull();
	await user.click(screen.getByRole("button", { name: "How to play" }));
	expect(screen.getByRole("dialog", { name: "How-to" })).toBeTruthy();
});

test("Help still shows the rules after How-to is seen", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist, path: "/portdle/help" });
	expect(screen.queryByRole("dialog", { name: "How-to" })).toBeNull();
	expect(screen.getByRole("heading", { level: 1, name: "Help" })).toBeTruthy();
	const main = screen.getByRole("main");
	expect(
		within(main).getByText("Guess the port for the named service."),
	).toBeTruthy();
	expect(
		within(main).getByText(
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
	const names = ["Daily", "Blitz", "History", "Help"];
	for (const name of names) {
		const link = screen.getByRole("link", { name });
		expect(link.tabIndex).not.toBe(-1);
	}
	expect(
		screen.getByRole("button", { name: "Toggle color theme" }).tabIndex,
	).not.toBe(-1);
	expect(screen.getByRole("button", { name: "Got it" }).tabIndex).not.toBe(-1);
});

test("Daily nav link is active on all three Daily routes and no other route", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	for (const path of [
		"/portdle/",
		"/portdle/protocols",
		"/portdle/applications",
	] as const) {
		cleanup();
		await renderApp({ persist, path });
		expect(
			screen.getByRole("link", { name: "Daily", current: "page" }),
		).toBeTruthy();
		expect(
			screen.queryByRole("link", { name: "Blitz", current: "page" }),
		).toBeNull();
		expect(
			screen.queryByRole("link", { name: "History", current: "page" }),
		).toBeNull();
		expect(
			screen.queryByRole("link", { name: "Help", current: "page" }),
		).toBeNull();
	}
});

test("Blitz, History, and Help nav links are active only on their own route", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const cases = [
		["/portdle/blitz", "Blitz"],
		["/portdle/history", "History"],
		["/portdle/help", "Help"],
	] as const;
	for (const [path, name] of cases) {
		cleanup();
		await renderApp({ persist, path });
		expect(screen.getByRole("link", { name, current: "page" })).toBeTruthy();
		expect(
			screen.queryByRole("link", { name: "Daily", current: "page" }),
		).toBeNull();
	}
});

test("failed write shows the shared Progress notice", async () => {
	const user = userEvent.setup();
	const failingPersist = createPersist({
		getItem: () => null,
		setItem: () => {
			throw new Error("quota");
		},
	});
	await renderApp({ persist: failingPersist });
	await user.click(screen.getByRole("button", { name: "Got it" }));
	expect(screen.getByRole("status").textContent).toBe("Progress may not save.");
});

test("placeholder headings exist on each route", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const cases = [
		["/portdle/", dailyOn("mixed").name],
		["/portdle/protocols", dailyOn("protocols").name],
		["/portdle/applications", dailyOn("applications").name],
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
