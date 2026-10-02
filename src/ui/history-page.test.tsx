import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import type { BlitzRun } from "../engine/types";
import { createPersist } from "../persist/storage";
import { dailyOn, saveDaily } from "../test/dailies";
import { createFakeRemote } from "../test/fake-remote";
import { loaded, memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

const UTC_TODAY = "2026-09-11";
const YESTERDAY = "2026-09-10";
const EPOCH = "2026-09-09";

async function renderHistory(
	persist: ReturnType<typeof createPersist> = createPersist(memoryStore()),
	path = "/portdle/history",
	remote = createFakeRemote(),
) {
	stubMatchMedia();
	remote.today = UTC_TODAY;
	const history = createMemoryHistory({
		initialEntries: [path],
	});
	render(<App persist={persist} remote={remote} history={history} />);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
}

function fakeRun(overrides: Partial<BlitzRun> = {}): BlitzRun {
	return {
		category: "protocols",
		orientation: "default",
		mode: "sprint",
		ended: "timeout",
		endedAt: "2026-09-09T12:00:00.000Z",
		score: 3,
		rounds: [
			{ id: "http", name: "HTTP", port: 80, outcome: "correct", wrong: null },
			{
				id: "chargen",
				name: "chargen",
				port: 19,
				outcome: "miss",
				wrong: { kind: "typed", port: 21, owner: null },
			},
		],
		...overrides,
	};
}

function historyList() {
	return screen.getByRole("list", { name: "History" });
}

function dateHeadingNames() {
	return within(historyList())
		.queryAllByRole("heading", { level: 2 })
		.map((heading) => heading.textContent);
}

function dateRows(date: string) {
	return within(screen.getByRole("list", { name: date })).getAllByRole(
		"listitem",
	);
}

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
});

test("History lists only finished Dailies, newest first, with number, result, and answer", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	saveDaily(persist, "mixed", YESTERDAY, "won", 3);
	saveDaily(persist, "protocols", YESTERDAY, "playing", 2);
	saveDaily(persist, "applications", EPOCH, "won", 2);
	saveDaily(persist, "mixed", EPOCH, "lost", 6);
	await renderHistory(persist);
	expect(
		screen.getByRole("heading", { level: 1, name: "History" }),
	).toBeTruthy();
	expect(dateHeadingNames()).toEqual([YESTERDAY, EPOCH]);
	const mixedYesterday = dailyOn("mixed", YESTERDAY);
	expect(dateRows(YESTERDAY).map((row) => row.textContent)).toEqual([
		`Mixed#2 · Won 3/6 · ${mixedYesterday.name} ${mixedYesterday.port}`,
	]);
	const epochRows = dateRows(EPOCH);
	expect(epochRows[0]?.textContent).toContain("Mixed#1 · Lost · ");
	expect(epochRows[0]?.textContent).toContain(dailyOn("mixed", EPOCH).name);
	expect(epochRows[1]?.textContent).toContain("Applications#1 · Won 2/6 · ");
	expect(epochRows).toHaveLength(2);
});

test("a Daily finished today is listed and links to its Archive board", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	saveDaily(persist, "protocols", UTC_TODAY, "lost", 6);
	await renderHistory(persist);
	expect(dateHeadingNames()).toEqual([UTC_TODAY]);
	const [row] = dateRows(UTC_TODAY);
	expect(row?.textContent).toContain("Protocols#3 · Lost · ");
	expect(row?.textContent).toContain(dailyOn("protocols", UTC_TODAY).name);
	expect(
		within(row as HTMLElement)
			.getByRole("link")
			.getAttribute("href"),
	).toBe(`/portdle/archive/protocols/${UTC_TODAY}`);
});

test("a finished Daily with no Schedule row stays listed and links to the no-Daily note", async () => {
	const remote = createFakeRemote();
	remote.scheduleRows = [];
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	saveDaily(persist, "mixed", YESTERDAY, "won", 2);
	await renderHistory(persist, "/portdle/history", remote);
	const [row] = dateRows(YESTERDAY);
	expect(row?.textContent).toBe("Mixed#2 · Won 2/6");
	await userEvent.setup().click(within(row as HTMLElement).getByRole("link"));
	expect(await screen.findByText("No Daily on this day.")).toBeTruthy();
});

test("an unfinished or unplayed Daily is not listed, today or before", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	saveDaily(persist, "mixed", UTC_TODAY, "playing", 1);
	saveDaily(persist, "mixed", YESTERDAY, "playing", 4);
	await renderHistory(persist);
	expect(dateHeadingNames()).toEqual([]);
});

test("corrupt Mixed persist today does not list Mixed today", async () => {
	const store = memoryStore();
	store.data.set(`portdle:v1:daily:mixed:${UTC_TODAY}`, "{not json");
	const persist = createPersist(store);
	persist.writeHowToSeen();
	await renderHistory(persist);
	expect(dateHeadingNames()).toEqual([]);
});

test("the Daily segment links to the Archive, the Blitz segment does not", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderHistory(persist);
	expect(
		screen.getByRole("link", { name: "Archive" }).getAttribute("href"),
	).toBe("/portdle/archive");
	cleanup();
	await renderHistory(persist, "/portdle/history/blitz");
	expect(screen.queryByRole("link", { name: "Archive" })).toBeNull();
});

test("first History visit still shows How-to", async () => {
	await renderHistory(createPersist(memoryStore()));
	expect(screen.getByRole("dialog", { name: "How-to" })).toBeTruthy();
	expect(
		screen.getByRole("heading", { level: 1, name: "History" }),
	).toBeTruthy();
});

test("/history shows the History switcher with Daily selected", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderHistory(persist);
	expect(
		screen.getByRole("navigation", { name: "History switcher" }),
	).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Daily", current: "page" }),
	).toBeTruthy();
	expect(
		screen.queryByRole("link", { name: "Blitz", current: "page" }),
	).toBeNull();
});

test("/history/blitz shows the History switcher with Blitz selected", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderHistory(persist, "/portdle/history/blitz");
	expect(
		screen.getByRole("heading", { level: 1, name: "History" }),
	).toBeTruthy();
	expect(
		screen.getByRole("navigation", { name: "History switcher" }),
	).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Blitz", current: "page" }),
	).toBeTruthy();
	expect(
		screen.queryByRole("link", { name: "Daily", current: "page" }),
	).toBeNull();
	expect(screen.getByRole("list", { name: "History" })).toBeTruthy();
});

test("the nav's History link is current on both /history and /history/blitz", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	for (const path of ["/portdle/history", "/portdle/history/blitz"] as const) {
		cleanup();
		await renderHistory(persist, path);
		expect(
			screen.getByRole("link", { name: "History", current: "page" }),
		).toBeTruthy();
	}
});

test("with no stored runs the Blitz segment reads No runs yet", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderHistory(persist, "/portdle/history/blitz");
	expect(screen.getByText("No runs yet.")).toBeTruthy();
});

test("a seeded Blitz run shows its setup badges reason and score", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const run = fakeRun();
	persist.writeBlitzRuns([run]);
	await renderHistory(persist, "/portdle/history/blitz");
	const list = screen.getByRole("list", { name: "History" });
	const dateHeading = within(list).getByRole("heading", { level: 2 });
	expect(dateHeading.textContent).toBe(run.endedAt.slice(0, 10));
	expect(list.textContent).toContain("Protocols");
	expect(list.textContent).toContain("Default");
	expect(list.textContent).toContain("Sprint");
	expect(list.textContent).not.toContain("Sprint (1m)");
	expect(list.textContent).toContain("Time's up");
	expect(list.textContent).toContain("Score 3");
});

test("a seeded Blitz run's Rounds disclosure reveals its round log in play order", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const run = fakeRun();
	persist.writeBlitzRuns([run]);
	await renderHistory(persist, "/portdle/history/blitz");
	const summary = screen.getByText("Rounds (2)");
	await user.click(summary);
	const details = summary.closest("details");
	if (!details) {
		throw new Error("missing details element");
	}
	const lines = within(details).getAllByRole("listitem");
	expect(lines).toHaveLength(2);
	const [first, second] = lines;
	if (!first || !second) {
		throw new Error("missing round log lines");
	}
	expect(within(first).getByRole("img", { name: "correct" })).toBeTruthy();
	expect(first.textContent).toContain("HTTP");
	expect(within(second).getByRole("img", { name: "miss" })).toBeTruthy();
	expect(second.textContent).toContain("chargen");
	expect(second.textContent).toContain("you typed 21");
});

test("Blitz segment contains no links", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	persist.writeBlitzRuns([fakeRun()]);
	await renderHistory(persist, "/portdle/history/blitz");
	const list = screen.getByRole("list", { name: "History" });
	expect(within(list).queryAllByRole("link").length).toBe(0);
});

test("a failed past-rows read lists no Daily rows when nothing is saved", async () => {
	const remote = createFakeRemote();
	remote.failSchedule = true;
	await renderHistory(undefined, "/portdle/history", remote);
	expect(
		screen.queryByRole("list", { name: "History" })?.children.length ?? 0,
	).toBe(0);
	expect(screen.queryByText("Loading...")).toBeNull();
});

test("History lists the saved rows until the past rows arrive, with no loading line", async () => {
	const remote = createFakeRemote();
	const release = remote.holdSchedule();
	stubMatchMedia();
	remote.today = UTC_TODAY;
	const persist = createPersist(memoryStore());
	saveDaily(persist, "mixed", YESTERDAY, "won", 3);
	render(
		<App
			persist={persist}
			remote={remote}
			history={createMemoryHistory({ initialEntries: ["/portdle/history"] })}
		/>,
	);
	const list = await screen.findByRole("list", { name: YESTERDAY });
	expect(list.textContent).toBe("Mixed#2 · Won 3/6");
	expect(screen.queryByText("Loading...")).toBeNull();
	release();
	await screen.findByText(new RegExp(dailyOn("mixed", YESTERDAY).name));
});

test("answers resolve by id in the whole catalog: a retired entry and an entry of another kind", async () => {
	const remote = createFakeRemote();
	remote.catalog = {
		protocols: [
			{
				id: "old",
				name: "Old Proto",
				port: 1111,
				transport: "tcp",
				description: "d",
				answerEligible: true,
				retired: true,
			},
		],
		applications: [
			{
				id: "moved",
				name: "Moved App",
				port: 2222,
				transport: "tcp",
				description: "d",
				answerEligible: true,
			},
		],
	};
	remote.scheduleRows = [
		{ category: "protocols", date: YESTERDAY, entryId: "old" },
		{ category: "protocols", date: EPOCH, entryId: "moved" },
	];
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	saveDaily(persist, "protocols", YESTERDAY, "won", 1);
	saveDaily(persist, "protocols", EPOCH, "won", 1);
	await renderHistory(persist, "/portdle/history", remote);
	expect(
		within(screen.getByRole("list", { name: YESTERDAY })).getByText(
			/Old Proto/,
		),
	).toBeTruthy();
	expect(
		within(screen.getByRole("list", { name: EPOCH })).getByText(/Moved App/),
	).toBeTruthy();
});
