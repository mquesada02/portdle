import { createMemoryHistory } from "@tanstack/react-router";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { digitLength } from "../engine/guess";
import type { CatalogEntry } from "../engine/types";
import { createPersist } from "../persist/storage";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	portDigits,
	stubMatchMedia,
} from "../test/helpers";
import { App } from "./app";
import { FOCUS_READ_THROTTLE_MS } from "./server-store";

const NEXT_DAY = "2026-09-10";
const AFTER_NEXT = "2026-09-11";
const today = dailyOn("mixed", UTC_TODAY);
const tomorrow = dailyOn("mixed", NEXT_DAY);

let deviceNow = 0;

afterEach(() => {
	deviceNow = 0;
	vi.restoreAllMocks();
	cleanup();
	document.documentElement.classList.remove("dark");
});

async function open(
	remote: FakeRemote,
	persist = createPersist(memoryStore()),
	path = "/",
) {
	stubMatchMedia();
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			remote={remote}
			history={createMemoryHistory({ initialEntries: [`/portdle${path}`] })}
			utcToday={UTC_TODAY}
		/>,
	);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	return persist;
}

// Moves the device clock forward and gives focus to the tab.
function focusLater(ms = FOCUS_READ_THROTTLE_MS) {
	deviceNow = Math.max(deviceNow, Date.now()) + ms;
	vi.spyOn(Date, "now").mockReturnValue(deviceNow);
	fireEvent.focus(window);
}

function heading(name: string) {
	return screen.getByRole("heading", { level: 1, name });
}

async function guess(user: ReturnType<typeof userEvent.setup>, port: number) {
	await user.click(portDigits());
	await user.keyboard(String(port));
	await user.click(screen.getByRole("button", { name: "Submit" }));
}

async function wrongGuess(
	user: ReturnType<typeof userEvent.setup>,
	answer: CatalogEntry,
) {
	const length = digitLength(answer.port);
	const port = answer.port === 1 ? 2 : 1;
	await user.click(portDigits());
	await user.keyboard(padToAnswer(port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(length).toBeGreaterThan(0);
}

test("the two Dailies differ, so the tests tell the days apart", () => {
	expect(today.name).not.toBe(tomorrow.name);
});

test("an untouched Daily moves to the new day on focus", async () => {
	const remote = createFakeRemote();
	await open(remote);
	expect(heading(today.name)).toBeTruthy();
	remote.today = NEXT_DAY;
	focusLater();
	expect(
		await screen.findByRole("heading", { level: 1, name: tomorrow.name }),
	).toBeTruthy();
});

test("a Daily with a committed try stays on its day, and the next visit shows the new day", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	const persist = await open(remote);
	await wrongGuess(user, today);
	expect(screen.getByText("1 / 6")).toBeTruthy();
	remote.today = NEXT_DAY;
	focusLater();
	await waitFor(() => expect(remote.dailiesCalls).toBe(2));
	await waitFor(() => expect(heading(today.name)).toBeTruthy());
	// The same board, with its try, and no remount.
	expect(screen.getByText("1 / 6")).toBeTruthy();
	expect(persist.readDaily("mixed", UTC_TODAY)?.guesses).toHaveLength(1);
	await user.click(screen.getByRole("link", { name: "Blitz" }));
	await user.click(screen.getByRole("link", { name: "Daily" }));
	expect(
		await screen.findByRole("heading", { level: 1, name: tomorrow.name }),
	).toBeTruthy();
});

test("a finished Daily's Reveal stays until the player leaves", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	await open(remote);
	await guess(user, today.port);
	remote.today = NEXT_DAY;
	focusLater();
	await waitFor(() => expect(remote.dailiesCalls).toBe(2));
	expect(heading(today.name)).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
});

test("a Daily mounted with a stored try stays on its day at the rollover", async () => {
	const remote = createFakeRemote();
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, {
		status: "playing",
		guesses: [{ port: 1, result: "miss", identified: null }],
	});
	await open(remote, persist);
	remote.today = NEXT_DAY;
	focusLater();
	await waitFor(() => expect(remote.dailiesCalls).toBe(2));
	expect(heading(today.name)).toBeTruthy();
});

test("a try held only in memory after a failed save still pins the Daily", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	const persist = createPersist(memoryStore());
	persist.writeDaily = () => ({ ok: false });
	await open(remote, persist);
	await wrongGuess(user, today);
	remote.today = NEXT_DAY;
	focusLater();
	await waitFor(() => expect(remote.dailiesCalls).toBe(2));
	expect(heading(today.name)).toBeTruthy();
	expect(screen.getByText("1 / 6")).toBeTruthy();
});

test("a typed but uncommitted digit string is dropped when an untouched Daily moves", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	await open(remote);
	await user.click(portDigits());
	await user.keyboard("1");
	remote.today = NEXT_DAY;
	focusLater();
	await screen.findByRole("heading", { level: 1, name: tomorrow.name });
	expect(portDigits().getAttribute("value") ?? "").toBe("");
});

test("an untouched Daily that moves to a day with a stored try stays there at the next rollover", async () => {
	const remote = createFakeRemote();
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", NEXT_DAY, {
		status: "playing",
		guesses: [{ port: 1, result: "miss", identified: null }],
	});
	await open(remote, persist);
	remote.today = NEXT_DAY;
	focusLater();
	await screen.findByRole("heading", { level: 1, name: tomorrow.name });
	remote.today = AFTER_NEXT;
	focusLater();
	await waitFor(() => expect(remote.dailiesCalls).toBe(3));
	expect(heading(tomorrow.name)).toBeTruthy();
});

test("the same day with another entry id moves nothing", async () => {
	const remote = createFakeRemote();
	await open(remote);
	remote.entryIds = {
		mixed: tomorrow.id,
		protocols: tomorrow.id,
		applications: tomorrow.id,
	};
	focusLater();
	await waitFor(() => expect(remote.dailiesCalls).toBe(2));
	expect(heading(today.name)).toBeTruthy();
});

test("a failed re-read leaves the loaded Daily working", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	await open(remote);
	remote.failDailies = true;
	focusLater();
	await waitFor(() => expect(remote.dailiesCalls).toBe(2));
	expect(heading(today.name)).toBeTruthy();
	expect(screen.queryByText("Could not load puzzles.")).toBeNull();
	await wrongGuess(user, today);
	expect(screen.getByText("1 / 6")).toBeTruthy();
});

test("a focus inside the throttle reads nothing", async () => {
	const remote = createFakeRemote();
	await open(remote);
	focusLater(FOCUS_READ_THROTTLE_MS - 5000);
	await new Promise((resolve) => setTimeout(resolve, 20));
	expect(remote.dailiesCalls).toBe(1);
});

test("a Blitz run carries on across a new day", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	await open(remote, undefined, "/blitz");
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const prompt = screen.getByRole("heading", { level: 1 }).textContent;
	remote.today = NEXT_DAY;
	focusLater();
	await waitFor(() => expect(remote.dailiesCalls).toBe(2));
	expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(prompt);
	expect(screen.queryByRole("button", { name: "New run" })).toBeNull();
});

test("the timer reads at the server's midnight, never by the device date", async () => {
	const remote = createFakeRemote();
	// The server says it is 0.7 s before midnight; the device says 2030.
	remote.serverNow = Date.parse(`${UTC_TODAY}T23:59:59.300Z`);
	vi.spyOn(Date, "now").mockReturnValue(Date.parse("2030-01-01T00:00:00Z"));
	await open(remote);
	expect(heading(today.name)).toBeTruthy();
	// The device clock never moves; the timer is a real 0.7 s.
	vi.restoreAllMocks();
	remote.today = NEXT_DAY;
	expect(
		await screen.findByRole(
			"heading",
			{ level: 1, name: tomorrow.name },
			{ timeout: 3000 },
		),
	).toBeTruthy();
	expect(remote.dailiesCalls).toBe(2);
});

test("a new catalog entry is read once when the new Daily needs it", async () => {
	const remote = createFakeRemote();
	await open(remote);
	remote.catalog = {
		...remote.catalog,
		protocols: [
			...remote.catalog.protocols,
			{
				id: "brand-new",
				name: "Brand New",
				port: 4242,
				transport: "tcp",
				description: "d",
				answerEligible: true,
			},
		],
	};
	remote.entryIds = {
		mixed: "brand-new",
		protocols: "brand-new",
		applications: "brand-new",
	};
	remote.today = NEXT_DAY;
	focusLater();
	expect(
		await screen.findByRole("heading", { level: 1, name: "Brand New" }),
	).toBeTruthy();
	expect(remote.catalogCalls).toBe(2);
});
