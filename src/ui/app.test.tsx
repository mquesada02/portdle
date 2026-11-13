import { createMemoryHistory } from "@tanstack/react-router";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { HYDRATED_ATTRIBUTE } from "../hydrated-attribute";
import { createPersist } from "../persist/storage";
import { dailyOn } from "../test/dailies";
import { createFakeRemote } from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	stubMatchMedia,
	stubViewTransitions,
} from "../test/helpers";
import { App, prepareApp } from "./app";
import { DEFAULT_TITLE, HEAD, type Head } from "./head";

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
	const remote = createFakeRemote();
	if (options.utcToday !== undefined) {
		remote.today = options.utcToday;
	}
	render(<App persist={persist} remote={remote} history={history} />);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	return persist;
}

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
	document.documentElement.removeAttribute(HYDRATED_ATTRIBUTE);
	for (const tag of document.head.querySelectorAll(
		'meta[name="description"], link[rel="canonical"]',
	)) {
		tag.remove();
	}
});

// The head that the prerender wrote into the file of the first route.
function seedPrerenderedHead(): Head {
	const first = HEAD["/"] as Head;
	document.head.insertAdjacentHTML(
		"beforeend",
		`<meta name="description" content="${first.description}"><link rel="canonical" href="${first.canonical}">`,
	);
	return first;
}

const headValues = () => ({
	descriptions: [
		...document.head.querySelectorAll('meta[name="description"]'),
	].map((tag) => tag.getAttribute("content")),
	canonicals: [...document.head.querySelectorAll('link[rel="canonical"]')].map(
		(tag) => tag.getAttribute("href"),
	),
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

test("How-to links to the privacy page in a new tab and keeps Got it first", async () => {
	await renderApp({});
	const dialog = screen.getByRole("dialog", { name: "How-to" });
	const link = within(dialog).getByRole("link", { name: "Privacy" });
	expect(link.getAttribute("href")).toBe(
		`${import.meta.env.BASE_URL}privacy.html`,
	);
	expect(link.getAttribute("target")).toBe("_blank");
	expect(link.getAttribute("rel")).toContain("noopener");
	const first = dialog.querySelector("button, a[href]");
	expect(first?.textContent).toBe("Got it");
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

test("theme control still flips and stores the theme without the View Transitions API", async () => {
	const user = userEvent.setup();
	const original = document.startViewTransition;
	// @ts-expect-error: the API is absent in the browsers this test stands for
	document.startViewTransition = undefined;
	try {
		const persist = await renderApp({ prefersDark: false });
		await user.click(
			screen.getByRole("button", { name: "Toggle color theme" }),
		);
		expect(persist.readTheme()).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	} finally {
		if (original === undefined) {
			delete (document as Partial<Document>).startViewTransition;
		} else {
			document.startViewTransition = original;
		}
	}
});

test("theme control runs its change as a theme view transition", async () => {
	const user = userEvent.setup();
	const { calls, restore } = stubViewTransitions();
	try {
		const persist = await renderApp({ prefersDark: false });
		await user.click(
			screen.getByRole("button", { name: "Toggle color theme" }),
		);
		expect(calls).toEqual([["theme"]]);
		expect(persist.readTheme()).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	} finally {
		restore();
	}
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
		...memoryStore(),
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

// The Archive changes the frame around the switcher content: its heading and
// its back link replace the switcher (#246).
test("the Daily's Archive link starts a view transition with the screen type", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({ persist });
	const archiveLink = await screen.findByRole("link", { name: "Archive" });
	const { calls, restore } = stubViewTransitions();
	try {
		await user.click(archiveLink);
		expect(calls).toEqual([["screen"]]);
	} finally {
		restore();
	}
});

test("an Archive board's back link starts a view transition with the screen type", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderApp({
		persist,
		path: "/portdle/archive/board?category=mixed&date=2026-09-10",
	});
	const { calls, restore } = stubViewTransitions();
	try {
		await user.click(screen.getByRole("link", { name: "Back to the Archive" }));
		expect(calls).toEqual([["screen"]]);
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

test.each(Object.entries(HEAD))(
	"a first load of %s sets the tab title from the head table",
	async (id, head) => {
		const path = id
			.replace("$category", "mixed")
			.replace("$date", "2026-09-10");
		await renderApp({ path: `/portdle${path}` });
		expect(document.title).toBe(head.title);
	},
);

test("in-app navigation sets the tab title from the head table", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	// A day after the Schedule's first day, so the Archive lists a board.
	await renderApp({ persist, utcToday: "2026-09-11" });
	const link = (nav: string, name: string) =>
		within(screen.getByRole("navigation", { name: nav })).getByRole("link", {
			name,
		});
	const visited: string[] = [];
	async function go(
		id: string,
		click: () => HTMLElement | Promise<HTMLElement>,
	) {
		await user.click(await click());
		expect(document.title, id).toBe(HEAD[id]?.title);
		visited.push(id);
	}
	await go("/protocols", () => link("Daily switcher", "Protocols"));
	await go("/applications", () => link("Daily switcher", "Applications"));
	await go("/", () => link("Daily switcher", "Mixed"));
	await go("/archive", () => screen.getByRole("link", { name: "Archive" }));
	await go("/archive/board", async () => {
		const [first] = await within(
			await screen.findByRole("list", { name: "Archive" }),
		).findAllByRole("link");
		if (!first) {
			throw new Error("no board link");
		}
		return first;
	});
	await go("/blitz", () => link("Main", "Blitz"));
	await go("/codex", () => link("Main", "Codex"));
	await go("/history", () => link("Main", "History"));
	await go("/history/blitz", () => link("History switcher", "Blitz"));
	expect(visited.sort()).toEqual(Object.keys(HEAD).sort());
});

test("in-app navigation keeps one description and at most one canonical link", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const first = seedPrerenderedHead();
	await renderApp({ persist, utcToday: "2026-09-11" });
	expect(headValues()).toEqual({
		descriptions: [first.description],
		canonicals: [first.canonical],
	});
	const nav = (name: string) =>
		within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", {
			name,
		});
	await user.click(screen.getByRole("link", { name: "Archive" }));
	const [board] = await within(
		await screen.findByRole("list", { name: "Archive" }),
	).findAllByRole("link");
	await user.click(board as HTMLElement);
	// The board keeps the canonical link with its params, and only that one.
	const { descriptions, canonicals } = headValues();
	expect(descriptions).toEqual([HEAD["/archive/board"]?.description]);
	expect(canonicals).toHaveLength(1);
	expect(canonicals[0]).toContain("/archive/board?category=");
	await user.click(screen.getByRole("link", { name: "Back to the Archive" }));
	expect(headValues().canonicals).toEqual([HEAD["/archive"]?.canonical]);
	await user.click(nav("Blitz"));
	expect(headValues()).toEqual({
		descriptions: [HEAD["/blitz"]?.description],
		canonicals: [HEAD["/blitz"]?.canonical],
	});
});

test("an unknown path has the default title and no description or canonical link", async () => {
	seedPrerenderedHead();
	await renderApp({ path: "/portdle/nowhere" });
	expect(headValues()).toEqual({ descriptions: [], canonicals: [] });
});

test("the old board path shows the default not-found screen", async () => {
	await renderApp({ path: "/portdle/archive/mixed/2026-09-10" });
	expect(screen.getByText("Not Found")).toBeTruthy();
	expect(screen.queryByText("No Daily on this day.")).toBeNull();
});

test("an unknown path keeps the default tab title", async () => {
	document.title = "Stale";
	await renderApp({ path: "/portdle/nowhere" });
	expect(document.title).toBe(DEFAULT_TITLE);
});

test("App with a prepared app renders its router, and its remount reaches App", async () => {
	stubMatchMedia(false, false);
	const prepared = prepareApp({
		persist: createPersist(memoryStore()),
		remote: createFakeRemote(),
		history: createMemoryHistory({ initialEntries: ["/portdle/blitz"] }),
	});
	const { remount } = prepared.router.options.context;
	// Before App sets its own, a remount call does nothing.
	expect(() => remount()).not.toThrow();
	const setRemount = vi.spyOn(prepared, "setRemount");
	await prepared.router.load();
	render(<App prepared={prepared} />);
	const nav = await screen.findByRole("navigation", { name: "Main" });
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();
	expect(setRemount).toHaveBeenCalled();
	await act(async () => {
		remount();
	});
	expect(screen.getByRole("navigation", { name: "Main" })).not.toBe(nav);
});

test("<html> carries the hydrated attribute once the app has rendered", async () => {
	expect(document.documentElement.hasAttribute(HYDRATED_ATTRIBUTE)).toBe(false);
	await renderApp({});
	expect(document.documentElement.getAttribute(HYDRATED_ATTRIBUTE)).toBe(
		"true",
	);
});
