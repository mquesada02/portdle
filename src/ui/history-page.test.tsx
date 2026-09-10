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
	const items = within(historyList()).getAllByRole("listitem");
	expect(items.length).toBe(6);
	const mixedYesterday = dailyOn("mixed", YESTERDAY);
	const protocolsYesterday = dailyOn("protocols", YESTERDAY);
	const applicationsYesterday = dailyOn("applications", YESTERDAY);
	const mixedEpoch = dailyOn("mixed", EPOCH);
	const protocolsEpoch = dailyOn("protocols", EPOCH);
	const applicationsEpoch = dailyOn("applications", EPOCH);
	expect(items[0]?.textContent).toContain(YESTERDAY);
	expect(items[0]?.textContent).toContain("Mixed");
	expect(items[0]?.textContent).toContain(mixedYesterday.name);
	expect(items[0]?.textContent).toContain(String(mixedYesterday.port));
	expect(items[1]?.textContent).toContain("Protocols");
	expect(items[1]?.textContent).toContain(protocolsYesterday.name);
	expect(items[2]?.textContent).toContain("Applications");
	expect(items[2]?.textContent).toContain(applicationsYesterday.name);
	expect(items[3]?.textContent).toContain(EPOCH);
	expect(items[3]?.textContent).toContain(mixedEpoch.name);
	expect(items[4]?.textContent).toContain(protocolsEpoch.name);
	expect(items[5]?.textContent).toContain(applicationsEpoch.name);
	expect(historyList().textContent).not.toContain(UTC_TODAY);
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
	const items = within(historyList()).getAllByRole("listitem");
	expect(items.length).toBe(7);
	expect(items[0]?.textContent).toContain(UTC_TODAY);
	expect(items[0]?.textContent).toContain("Mixed");
	expect(items[0]?.textContent).toContain(mixedToday.name);
	expect(items[0]?.textContent).toContain(String(mixedToday.port));
	expect(items[1]?.textContent).toContain(YESTERDAY);
	expect(
		items.some(
			(item) =>
				item.textContent?.includes(UTC_TODAY) === true &&
				item.textContent.includes("Protocols"),
		),
	).toBe(false);
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
	const items = within(historyList()).getAllByRole("listitem");
	expect(items[0]?.textContent).toContain(UTC_TODAY);
	expect(items[0]?.textContent).toContain("Protocols");
	expect(items[0]?.textContent).toContain(protocolsToday.name);
	expect(items[0]?.textContent).toContain(String(protocolsToday.port));
});

test("playing Mixed today does not list Mixed today", async () => {
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	persist.writeDaily("mixed", UTC_TODAY, {
		status: "playing",
		guesses: [{ port: 80, result: "miss", identified: null }],
	});
	await renderHistory(persist);
	expect(historyList().textContent).not.toContain(UTC_TODAY);
});

test("corrupt Mixed persist today does not list Mixed today", async () => {
	const store = memoryStore();
	store.data.set(`portdle:v1:daily:mixed:${UTC_TODAY}`, "{not json");
	const persist = createPersist(store);
	persist.writeHowToSeen();
	await renderHistory(persist);
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
