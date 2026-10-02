import { createMemoryHistory } from "@tanstack/react-router";
import {
	act,
	cleanup,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import type { DailyCategory } from "../engine/types";
import { createPersist, type Persist } from "../persist/storage";
import {
	dailyOn,
	fixtureCatalog,
	padToAnswer,
	saveDaily,
} from "../test/dailies";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	portDigits,
	SERVER_MESSAGE,
	stubMatchMedia,
} from "../test/helpers";
import { App } from "./app";

const TODAY = "2026-09-11";
const YESTERDAY = "2026-09-10";
const EPOCH = "2026-09-09";

async function open(
	path: string,
	options: { remote?: FakeRemote; persist?: Persist } = {},
) {
	stubMatchMedia();
	const remote = options.remote ?? createFakeRemote();
	remote.today = TODAY;
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			remote={remote}
			history={createMemoryHistory({ initialEntries: [path] })}
		/>,
	);
	await screen.findByRole("navigation", { name: "Main" });
	return { remote, persist };
}

async function playWin(
	user: ReturnType<typeof userEvent.setup>,
	category: DailyCategory,
	date: string,
) {
	const answer = dailyOn(category, date);
	await user.type(portDigits(), padToAnswer(answer.port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
}

function captureShare(): string[] {
	const copied: string[] = [];
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: {
			writeText: async (text: string) => {
				copied.push(text);
			},
		},
	});
	return copied;
}

function stat(label: string): string | undefined {
	return screen.getByText(label).nextElementSibling?.textContent ?? undefined;
}

afterEach(() => {
	cleanup();
});

test("the list groups past days newest first, in category order, with number and state", async () => {
	const persist = createPersist(memoryStore());
	saveDaily(persist, "mixed", YESTERDAY, "won", 3);
	saveDaily(persist, "protocols", YESTERDAY, "lost", 6);
	saveDaily(persist, "applications", YESTERDAY, "playing", 2);
	await open("/portdle/archive", { persist });
	await loaded();
	expect(
		screen.getByRole("heading", { level: 1, name: "Archive" }),
	).toBeTruthy();
	const list = screen.getByRole("list", { name: "Archive" });
	expect(
		within(list)
			.getAllByRole("heading", { level: 2 })
			.map((heading) => heading.textContent),
	).toEqual([YESTERDAY, EPOCH]);
	expect(
		within(screen.getByRole("list", { name: YESTERDAY }))
			.getAllByRole("listitem")
			.map((row) => row.textContent),
	).toEqual([
		"Mixed#2 · Won 3/6",
		"Protocols#2 · Lost",
		"Applications#2 · In progress 2/6",
	]);
	expect(
		within(screen.getByRole("list", { name: EPOCH }))
			.getAllByRole("listitem")
			.map((row) => row.textContent),
	).toEqual([
		"Mixed#1 · Not played",
		"Protocols#1 · Not played",
		"Applications#1 · Not played",
	]);
});

test("the list has no today, no day without a row, and no answer", async () => {
	const remote = createFakeRemote();
	remote.scheduleRows = [
		{ category: "mixed", date: EPOCH, entryId: dailyOn("mixed", EPOCH).id },
		{ category: "mixed", date: TODAY, entryId: dailyOn("mixed", TODAY).id },
	];
	await open("/portdle/archive", { remote });
	await loaded();
	const list = screen.getByRole("list", { name: "Archive" });
	expect(
		within(list)
			.getAllByRole("heading", { level: 2 })
			.map((heading) => heading.textContent),
	).toEqual([EPOCH]);
	expect(within(list).getAllByRole("listitem")).toHaveLength(2);
	expect(list.textContent).not.toContain(dailyOn("mixed", EPOCH).name);
	expect(list.textContent).not.toContain(TODAY);
});

test("every row links to its board address", async () => {
	await open("/portdle/archive");
	await loaded();
	const links = within(
		screen.getByRole("list", { name: YESTERDAY }),
	).getAllByRole("link");
	expect(links.map((link) => link.getAttribute("href"))).toEqual([
		`/portdle/archive/mixed/${YESTERDAY}`,
		`/portdle/archive/protocols/${YESTERDAY}`,
		`/portdle/archive/applications/${YESTERDAY}`,
	]);
});

test("the Daily nav item is current on the list and on a board", async () => {
	const nav = () => screen.getByRole("navigation", { name: "Main" });
	await open("/portdle/archive");
	await loaded();
	expect(
		within(nav())
			.getByRole("link", { name: "Daily" })
			.getAttribute("aria-current"),
	).toBe("page");
	cleanup();
	await open(`/portdle/archive/mixed/${YESTERDAY}`);
	await loaded();
	expect(
		within(nav())
			.getByRole("link", { name: "Daily" })
			.getAttribute("aria-current"),
	).toBe("page");
});

test("the Daily screen links to the Archive only once loaded", async () => {
	const remote = createFakeRemote();
	const release = remote.holdDailies();
	await open("/portdle/", { remote });
	expect(screen.queryByRole("link", { name: "Archive" })).toBeNull();
	release();
	await loaded();
	expect(
		screen.getByRole("link", { name: "Archive" }).getAttribute("href"),
	).toBe("/portdle/archive");
});

test("the Daily screen shows no Archive link while its reads fail", async () => {
	const remote = createFakeRemote();
	remote.failDailies = true;
	await open("/portdle/", { remote });
	await screen.findByText(SERVER_MESSAGE);
	expect(screen.queryByRole("link", { name: "Archive" })).toBeNull();
});

test("addresses with no Daily show the note and a link back", async () => {
	const addresses = [
		"/portdle/archive/nope/2026-09-10",
		"/portdle/archive/mixed/2026-02-30",
		"/portdle/archive/mixed/2026-09-08",
		"/portdle/archive/mixed/2026-09-12",
	];
	for (const address of addresses) {
		await open(address);
		await loaded();
		expect(screen.getByText("No Daily on this day.")).toBeTruthy();
		expect(
			screen
				.getByRole("link", { name: "Back to the Archive" })
				.getAttribute("href"),
		).toBe("/portdle/archive");
		cleanup();
	}
	const remote = createFakeRemote();
	remote.scheduleRows = [];
	await open(`/portdle/archive/mixed/${YESTERDAY}`, { remote });
	await loaded();
	expect(screen.getByText("No Daily on this day.")).toBeTruthy();
});

test("an invalid address waits for the reads: a failed read shows the panel, not the note", async () => {
	const remote = createFakeRemote();
	remote.failSchedule = true;
	await open("/portdle/archive/nope/2026-09-10", { remote });
	expect(await screen.findByText(SERVER_MESSAGE)).toBeTruthy();
	expect(screen.queryByText("No Daily on this day.")).toBeNull();
});

test("a late play saves under its own date as late, shares with late, and leaves the streak", async () => {
	const user = userEvent.setup();
	const copied = captureShare();
	const persist = createPersist(memoryStore());
	saveDaily(persist, "mixed", TODAY, "won", 1, { late: false });
	await open(`/portdle/archive/mixed/${YESTERDAY}`, { persist });
	await loaded();
	await playWin(user, "mixed", YESTERDAY);
	const record = persist.readDaily("mixed", YESTERDAY);
	expect(record?.status).toBe("won");
	expect(record?.late).toBe(true);
	expect(persist.readDaily("mixed", TODAY)?.late).toBe(false);
	expect(persist.readDaily("mixed", EPOCH)).toBeNull();
	expect(screen.getByText("Late play, not counted")).toBeTruthy();
	expect(stat("Played")).toBe("2");
	expect(stat("Streak")).toBe("1");
	await user.click(screen.getByRole("button", { name: "Share" }));
	expect(copied[0]?.split("\n")[0]).toBe("Portdle #2 · Mixed · 1/6 · late");
});

test("a late play appears in History after it finishes", async () => {
	const user = userEvent.setup();
	await open(`/portdle/archive/mixed/${YESTERDAY}`);
	await loaded();
	await playWin(user, "mixed", YESTERDAY);
	await user.click(
		within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", {
			name: "History",
		}),
	);
	const list = await screen.findByRole("list", { name: YESTERDAY });
	expect(list.textContent).toContain("Mixed#2 · Won 1/6");
});

test("an unfinished on-day Daily finished from the Archive stays on-day", async () => {
	const user = userEvent.setup();
	const copied = captureShare();
	const persist = createPersist(memoryStore());
	const answer = dailyOn("mixed", YESTERDAY);
	const wrongPort = answer.port === 1 ? 2 : 1;
	saveDaily(persist, "mixed", YESTERDAY, "playing", 1, {
		late: false,
		guesses: [{ port: wrongPort, result: "miss", identified: null }],
	});
	await open(`/portdle/archive/mixed/${YESTERDAY}`, { persist });
	await loaded();
	await playWin(user, "mixed", YESTERDAY);
	expect(persist.readDaily("mixed", YESTERDAY)?.late).toBe(false);
	expect(screen.queryByText("Late play, not counted")).toBeNull();
	expect(stat("Streak")).toBe("1");
	await user.click(screen.getByRole("button", { name: "Share" }));
	expect(copied[0]?.split("\n")[0]).toBe("Portdle #2 · Mixed · 2/6");
});

test("today's unfinished Daily on its Archive address plays as on-day", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	await open(`/portdle/archive/mixed/${TODAY}`, { persist });
	await loaded();
	await playWin(user, "mixed", TODAY);
	expect(persist.readDaily("mixed", TODAY)?.late).toBe(false);
});

test("a finished Daily opens read-only with its Reveal and global stats", async () => {
	const persist = createPersist(memoryStore());
	saveDaily(persist, "protocols", TODAY, "lost", 6, { late: false });
	saveDaily(persist, "mixed", YESTERDAY, "won", 2, { late: false });
	for (const date of [YESTERDAY, TODAY]) {
		const category = date === TODAY ? "protocols" : "mixed";
		await open(`/portdle/archive/${category}/${date}`, { persist });
		await loaded();
		expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
		expect(screen.queryByRole("group", { name: "Port digits" })).toBeNull();
		expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
		expect(stat("Played")).toBe("1");
		expect(
			await screen.findByRole("heading", { name: "Global stats" }),
		).toBeTruthy();
		cleanup();
	}
});

test("a failed past-rows read shows the panel with the nav; Try again loads the list", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	remote.failSchedule = true;
	await open("/portdle/archive", { remote });
	expect(await screen.findByText(SERVER_MESSAGE)).toBeTruthy();
	expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
	expect(screen.queryByRole("list", { name: "Archive" })).toBeNull();
	remote.failSchedule = false;
	await user.click(screen.getByRole("button", { name: "Try again" }));
	expect(await screen.findByRole("list", { name: YESTERDAY })).toBeTruthy();
	expect(remote.scheduleCalls).toBe(2);
});

test("a failed past-rows read retries on focus", async () => {
	const remote = createFakeRemote();
	remote.failSchedule = true;
	await open("/portdle/archive", { remote });
	await screen.findByText(SERVER_MESSAGE);
	remote.failSchedule = false;
	act(() => {
		window.dispatchEvent(new Event("focus"));
	});
	expect(await screen.findByRole("list", { name: YESTERDAY })).toBeTruthy();
});

test("a held past-rows read shows the loading line", async () => {
	const remote = createFakeRemote();
	const release = remote.holdSchedule();
	await open("/portdle/archive", { remote });
	expect(screen.getByText("Loading...")).toBeTruthy();
	release();
	await loaded();
	expect(screen.getByRole("list", { name: YESTERDAY })).toBeTruthy();
});

test("a board whose entry the catalog lacks shows the panel; Try again reloads the catalog", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	const extra = {
		id: "brand-new",
		name: "Brand New",
		port: 4242,
		transport: "tcp" as const,
		description: "d",
		answerEligible: true,
	};
	remote.scheduleRows = [
		{ category: "protocols", date: YESTERDAY, entryId: extra.id },
	];
	await open(`/portdle/archive/protocols/${YESTERDAY}`, { remote });
	expect(await screen.findByText(SERVER_MESSAGE)).toBeTruthy();
	const catalog = fixtureCatalog();
	remote.catalog = {
		...catalog,
		protocols: [...catalog.protocols, extra],
	};
	await user.click(screen.getByRole("button", { name: "Try again" }));
	await waitFor(() => expect(remote.catalogCalls).toBe(2));
	expect(
		await screen.findByRole("group", { name: "Port digits" }),
	).toBeTruthy();
});
