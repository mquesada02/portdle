import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { createPersist } from "../persist/storage";
import { dailyOn } from "../test/dailies";
import { memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

const UTC_TODAY = "2026-09-11";
const YESTERDAY = "2026-09-10";
const EPOCH = "2026-09-09";

async function renderHistory(
	persist: ReturnType<typeof createPersist> = createPersist(memoryStore()),
) {
	stubMatchMedia();
	const history = createMemoryHistory({
		initialEntries: ["/portdle/history"],
	});
	render(<App persist={persist} history={history} utcToday={UTC_TODAY} />);
	await screen.findByRole("navigation", { name: "Main" });
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
