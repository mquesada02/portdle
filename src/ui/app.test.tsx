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
	reducedMotion?: boolean;
	utcToday?: string;
}) {
	stubMatchMedia(options.prefersDark ?? false, options.reducedMotion ?? false);
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

// Installs a fake View Transitions API the way src/router.tsx's
// defaultViewTransition expects it: document.startViewTransition present,
// and window.CSS.supports reporting support for the selector the router
// checks before passing types through. Records each call's resolved types.
function stubViewTransitions() {
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

test("How-to explains what green, yellow, and gray mean", async () => {
	await renderApp({});
	const dialog = screen.getByRole("dialog", { name: "How-to" });
	expect(
		within(dialog).getByText(
			"After each try, green means right digit in the right place, yellow means the digit is in the port elsewhere, gray means it is not in the port.",
		),
	).toBeTruthy();
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
	const names = ["Daily", "Blitz", "History", "Codex"];
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
	}
});

test("nav has exactly four links, in order Daily, Blitz, History, Codex", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist });
	const mainNav = screen.getByRole("navigation", { name: "Main" });
	const links = within(mainNav).getAllByRole("link");
	expect(links.map((link) => link.textContent)).toEqual([
		"Daily",
		"Blitz",
		"History",
		"Codex",
	]);
});

test("Blitz, History, and Codex nav links are active only on their own route", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const cases = [
		["/portdle/blitz", "Blitz"],
		["/portdle/history", "History"],
		["/portdle/codex", "Codex"],
	] as const;
	for (const [path, name] of cases) {
		cleanup();
		await renderApp({ persist, path });
		const mainNav = screen.getByRole("navigation", { name: "Main" });
		expect(
			within(mainNav).getByRole("link", { name, current: "page" }),
		).toBeTruthy();
		expect(
			within(mainNav).queryByRole("link", { name: "Daily", current: "page" }),
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

test("each route shows its heading, and the old Help address lands on the Daily", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const cases = [
		["/portdle/", dailyOn("mixed").name],
		["/portdle/protocols", dailyOn("protocols").name],
		["/portdle/applications", dailyOn("applications").name],
		["/portdle/blitz", "Blitz"],
		["/portdle/history", "History"],
		["/portdle/codex", "Codex"],
		["/portdle/help", dailyOn("mixed").name],
	] as const;
	for (const [path, heading] of cases) {
		cleanup();
		await renderApp({ persist, path });
		expect(
			screen.getByRole("heading", { level: 1, name: heading }),
		).toBeTruthy();
	}
});

test("How-to lists seven rules, the last naming the Codex", async () => {
	await renderApp({});
	const dialog = screen.getByRole("dialog", { name: "How-to" });
	const rules = within(dialog).getAllByRole("listitem");
	expect(rules).toHaveLength(7);
	expect(rules.at(-1)?.textContent).toBe(
		"The Codex collects every service you meet.",
	);
});

test("navigating by nav link and by switcher lands on the right screen with no API present", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist });
	const mainNav = screen.getByRole("navigation", { name: "Main" });

	await user.click(within(mainNav).getByRole("link", { name: "Blitz" }));
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();

	await user.click(within(mainNav).getByRole("link", { name: "Daily" }));
	const dailySwitcher = screen.getByRole("navigation", {
		name: "Daily switcher",
	});
	await user.click(
		within(dailySwitcher).getByRole("link", { name: "Protocols" }),
	);
	expect(
		screen.getByRole("heading", { level: 1, name: dailyOn("protocols").name }),
	).toBeTruthy();

	await user.click(within(mainNav).getByRole("link", { name: "History" }));
	const historySwitcher = screen.getByRole("navigation", {
		name: "History switcher",
	});
	await user.click(
		within(historySwitcher).getByRole("link", { name: "Blitz" }),
	);
	expect(
		within(historySwitcher).getByRole("link", {
			name: "Blitz",
			current: "page",
		}),
	).toBeTruthy();
});

test("the router starts no view transition on the initial render, even with the API available", async () => {
	const { calls, restore } = stubViewTransitions();
	try {
		await renderApp({});
		expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
		expect(calls).toEqual([]);
	} finally {
		restore();
	}
});

test("a nav tap from Daily to Blitz starts a view transition with the screen type", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist });
	const { calls, restore } = stubViewTransitions();
	try {
		const mainNav = screen.getByRole("navigation", { name: "Main" });
		await user.click(within(mainNav).getByRole("link", { name: "Blitz" }));
		expect(calls).toEqual([["screen"]]);
	} finally {
		restore();
	}
});

test("a wordmark tap from Blitz starts a view transition with the screen type", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist, path: "/portdle/blitz" });
	const { calls, restore } = stubViewTransitions();
	try {
		await user.click(screen.getByRole("link", { name: "Portdle" }));
		expect(calls).toEqual([["screen"]]);
	} finally {
		restore();
	}
});

test("a nav tap to Daily from Protocols starts a view transition with the switcher type", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist, path: "/portdle/protocols" });
	const { calls, restore } = stubViewTransitions();
	try {
		const mainNav = screen.getByRole("navigation", { name: "Main" });
		await user.click(within(mainNav).getByRole("link", { name: "Daily" }));
		expect(calls).toEqual([["switcher"]]);
	} finally {
		restore();
	}
});

test("a Daily switcher tap starts a view transition with the switcher type", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist });
	const { calls, restore } = stubViewTransitions();
	try {
		const dailySwitcher = screen.getByRole("navigation", {
			name: "Daily switcher",
		});
		await user.click(
			within(dailySwitcher).getByRole("link", { name: "Protocols" }),
		);
		expect(calls).toEqual([["switcher"]]);
	} finally {
		restore();
	}
});

test("a History switcher tap starts a view transition with the switcher type", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist, path: "/portdle/history" });
	const { calls, restore } = stubViewTransitions();
	try {
		const historySwitcher = screen.getByRole("navigation", {
			name: "History switcher",
		});
		await user.click(
			within(historySwitcher).getByRole("link", { name: "Blitz" }),
		);
		expect(calls).toEqual([["switcher"]]);
	} finally {
		restore();
	}
});

test("with reduced motion stubbed to match, a nav tap starts no view transition", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist, reducedMotion: true });
	const { calls, restore } = stubViewTransitions();
	try {
		const mainNav = screen.getByRole("navigation", { name: "Main" });
		await user.click(within(mainNav).getByRole("link", { name: "Blitz" }));
		expect(
			screen.getByRole("heading", { level: 1, name: "Blitz" }),
		).toBeTruthy();
		expect(calls).toEqual([]);
	} finally {
		restore();
	}
});
