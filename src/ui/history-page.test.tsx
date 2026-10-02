import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import type { BlitzRun } from "../engine/types";
import { createPersist } from "../persist/storage";
import { dailyOn } from "../test/dailies";
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
	render(
		<App
			persist={persist}
			remote={remote}
			history={history}
			utcToday={UTC_TODAY}
		/>,
	);
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
		.getAllByRole("heading", { level: 2 })
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

test("History heading and past days newest first without today", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderHistory(persist);
	expect(
		screen.getByRole("heading", { level: 1, name: "History" }),
	).toBeTruthy();
	expect(dateHeadingNames()).toEqual([YESTERDAY, EPOCH]);
	const mixedYesterday = dailyOn("mixed", YESTERDAY);
	const protocolsYesterday = dailyOn("protocols", YESTERDAY);
	const applicationsYesterday = dailyOn("applications", YESTERDAY);
	const mixedEpoch = dailyOn("mixed", EPOCH);
	const protocolsEpoch = dailyOn("protocols", EPOCH);
	const applicationsEpoch = dailyOn("applications", EPOCH);
	const yesterdayRows = dateRows(YESTERDAY);
	expect(yesterdayRows.length).toBe(3);
	expect(yesterdayRows[0]?.textContent).toBe(
		`Mixed ${mixedYesterday.name} ${mixedYesterday.port}`,
	);
	expect(yesterdayRows[1]?.textContent).toContain("Protocols");
	expect(yesterdayRows[1]?.textContent).toContain(protocolsYesterday.name);
	expect(yesterdayRows[2]?.textContent).toContain("Applications");
	expect(yesterdayRows[2]?.textContent).toContain(applicationsYesterday.name);
	const epochRows = dateRows(EPOCH);
	expect(epochRows.length).toBe(3);
	expect(epochRows[0]?.textContent).toContain(mixedEpoch.name);
	expect(epochRows[1]?.textContent).toContain(protocolsEpoch.name);
	expect(epochRows[2]?.textContent).toContain(applicationsEpoch.name);
	expect(historyList().textContent).not.toContain(UTC_TODAY);
	expect(dateHeadingNames()).not.toContain(UTC_TODAY);
});

test("won Mixed today lists Mixed today and not unfinished categories", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const mixedToday = dailyOn("mixed", UTC_TODAY);
	persist.writeDaily("mixed", UTC_TODAY, {
		status: "won",
		guesses: [
			{
				port: mixedToday.port,
				result: "correct",
				identified: {
					id: mixedToday.id,
					name: mixedToday.name,
					port: mixedToday.port,
				},
			},
		],
	});
	await renderHistory(persist);
	expect(dateHeadingNames()).toEqual([UTC_TODAY, YESTERDAY, EPOCH]);
	const todayRows = dateRows(UTC_TODAY);
	expect(todayRows.length).toBe(1);
	expect(todayRows[0]?.textContent).toContain("Mixed");
	expect(todayRows[0]?.textContent).toContain(mixedToday.name);
	expect(todayRows[0]?.textContent).toContain(String(mixedToday.port));
	expect(
		todayRows.some((row) => row.textContent?.includes("Protocols") === true),
	).toBe(false);
	expect(dateRows(YESTERDAY).length).toBe(3);
});

test("lost Protocols today lists Protocols today", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const protocolsToday = dailyOn("protocols", UTC_TODAY);
	persist.writeDaily("protocols", UTC_TODAY, {
		status: "lost",
		guesses: [
			{ port: 1, result: "miss", identified: null },
			{ port: 2, result: "miss", identified: null },
			{ port: 3, result: "miss", identified: null },
			{ port: 4, result: "miss", identified: null },
			{ port: 5, result: "miss", identified: null },
			{ port: 6, result: "miss", identified: null },
		],
	});
	await renderHistory(persist);
	const todayRows = dateRows(UTC_TODAY);
	expect(todayRows.length).toBe(1);
	expect(todayRows[0]?.textContent).toContain("Protocols");
	expect(todayRows[0]?.textContent).toContain(protocolsToday.name);
	expect(todayRows[0]?.textContent).toContain(String(protocolsToday.port));
});

test("playing Mixed today does not list Mixed today", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	persist.writeDaily("mixed", UTC_TODAY, {
		status: "playing",
		guesses: [{ port: 80, result: "miss", identified: null }],
	});
	await renderHistory(persist);
	expect(dateHeadingNames()).not.toContain(UTC_TODAY);
	expect(historyList().textContent).not.toContain(UTC_TODAY);
});

test("corrupt Mixed persist today does not list Mixed today", async () => {
	const store = memoryStore();
	store.data.set(`portdle:v1:daily:mixed:${UTC_TODAY}`, "{not json");
	const persist = createPersist(store);
	persist.writeHowToSeen();
	await renderHistory(persist);
	expect(dateHeadingNames()).not.toContain(UTC_TODAY);
	expect(historyList().textContent).not.toContain(UTC_TODAY);
});

test("History list contains no links", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	await renderHistory(persist);
	expect(within(historyList()).queryAllByRole("link").length).toBe(0);
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

test("a failed past-rows read lists no Daily rows", async () => {
	const remote = createFakeRemote();
	remote.failSchedule = true;
	await renderHistory(undefined, "/portdle/history", remote);
	expect(
		screen.queryByRole("list", { name: "History" })?.children.length ?? 0,
	).toBe(0);
	expect(screen.queryByText("Loading...")).toBeNull();
});

test("History shows loading until the past rows arrive", async () => {
	const remote = createFakeRemote();
	const release = remote.holdSchedule();
	stubMatchMedia();
	remote.today = UTC_TODAY;
	render(
		<App
			persist={createPersist(memoryStore())}
			remote={remote}
			history={createMemoryHistory({ initialEntries: ["/portdle/history"] })}
			utcToday={UTC_TODAY}
		/>,
	);
	expect(await screen.findByText("Loading...")).toBeTruthy();
	release();
	await screen.findByRole("list", { name: YESTERDAY });
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
	await renderHistory(undefined, "/portdle/history", remote);
	expect(
		within(screen.getByRole("list", { name: YESTERDAY })).getByText(
			/Old Proto/,
		),
	).toBeTruthy();
	expect(
		within(screen.getByRole("list", { name: EPOCH })).getByText(/Moved App/),
	).toBeTruthy();
});
