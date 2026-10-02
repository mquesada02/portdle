import { createMemoryHistory } from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { CatalogEntry } from "../engine/types";
import { createPersist } from "../persist/storage";
import { dailyOn, fixtureCatalog, UTC_TODAY } from "../test/dailies";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import {
	memoryStore,
	OFFLINE_MESSAGE,
	SERVER_MESSAGE,
	stubMatchMedia,
} from "../test/helpers";
import { App } from "./app";
import { READ_TIMEOUT_MS } from "./server-store";

let onLine = true;

beforeEach(() => {
	onLine = true;
	vi.spyOn(navigator, "onLine", "get").mockImplementation(() => onLine);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function setOnLine(value: boolean) {
	onLine = value;
	act(() => {
		window.dispatchEvent(new Event(value ? "online" : "offline"));
	});
}

function focusWindow() {
	act(() => {
		window.dispatchEvent(new Event("focus"));
	});
}

async function open(
	path: string,
	remote: FakeRemote = createFakeRemote(),
	persist = createPersist(memoryStore()),
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
	return persist;
}

const MIXED_NAME = dailyOn("mixed").name;

test("the panel says the player is offline, or that the server does not answer", async () => {
	onLine = false;
	const remote = createFakeRemote();
	remote.failCatalog = true;
	await open("/", remote);
	expect(await screen.findByText(OFFLINE_MESSAGE)).toBeTruthy();
	setOnLine(true);
	expect(await screen.findByText(SERVER_MESSAGE)).toBeTruthy();
	setOnLine(false);
	expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();
});

test("Try again reloads the failed reads and the Daily appears", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	remote.failDailies = true;
	await open("/", remote);
	await screen.findByText(SERVER_MESSAGE);
	remote.failDailies = false;
	await user.click(screen.getByRole("button", { name: "Try again" }));
	expect(
		await screen.findByRole("heading", { level: 1, name: MIXED_NAME }),
	).toBeTruthy();
	expect(remote.catalogCalls).toBe(1);
	expect(remote.dailiesCalls).toBe(2);
});

test.each([
	["online", () => setOnLine(true)],
	["focus", focusWindow],
	[
		"visibilitychange",
		() => {
			act(() => {
				document.dispatchEvent(new Event("visibilitychange"));
			});
		},
	],
])("a %s event retries while the panel shows", async (_name, trigger) => {
	const remote = createFakeRemote();
	remote.failCatalog = true;
	await open("/", remote);
	await screen.findByText(SERVER_MESSAGE);
	remote.failCatalog = false;
	trigger();
	expect(
		await screen.findByRole("heading", { level: 1, name: MIXED_NAME }),
	).toBeTruthy();
});

test("every focus retries while the panel shows", async () => {
	const remote = createFakeRemote();
	remote.failCatalog = true;
	await open("/", remote);
	await screen.findByText(SERVER_MESSAGE);
	focusWindow();
	await waitFor(() => expect(remote.catalogCalls).toBe(2));
	await screen.findByText(SERVER_MESSAGE);
	focusWindow();
	await waitFor(() => expect(remote.catalogCalls).toBe(3));
});

test("a retry shows the loading line, and a trigger during it adds no read", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	remote.failCatalog = true;
	await open("/", remote);
	await screen.findByText(SERVER_MESSAGE);
	remote.failCatalog = false;
	const release = remote.holdCatalog();
	await user.click(screen.getByRole("button", { name: "Try again" }));
	expect(screen.getByText("Loading...")).toBeTruthy();
	focusWindow();
	setOnLine(true);
	expect(remote.catalogCalls).toBe(2);
	release();
	await screen.findByRole("heading", { level: 1, name: MIXED_NAME });
});

test("a loaded screen survives a later failed read and nothing reloads", async () => {
	const remote = createFakeRemote();
	await open("/", remote);
	await screen.findByRole("heading", { level: 1, name: MIXED_NAME });
	remote.failCatalog = true;
	remote.failDailies = true;
	focusWindow();
	setOnLine(true);
	expect(screen.queryByText(SERVER_MESSAGE)).toBeNull();
	expect(screen.queryByText("Loading...")).toBeNull();
	expect(remote.catalogCalls).toBe(1);
	expect(remote.dailiesCalls).toBe(1);
});

test("a read held over 10 seconds fails, and its late result is dropped", async () => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	const remote = createFakeRemote();
	const releaseFirst = remote.holdCatalog();
	await open("/", remote);
	expect(await screen.findByText("Loading...")).toBeTruthy();
	await act(async () => {
		await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
	});
	expect(await screen.findByText(SERVER_MESSAGE)).toBeTruthy();
	const releaseSecond = remote.holdCatalog();
	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	expect(screen.getByText("Loading...")).toBeTruthy();
	await act(async () => {
		releaseFirst();
		await vi.advanceTimersByTimeAsync(0);
	});
	expect(screen.getByText("Loading...")).toBeTruthy();
	await act(async () => {
		releaseSecond();
		await vi.advanceTimersByTimeAsync(0);
	});
	expect(
		await screen.findByRole("heading", { level: 1, name: MIXED_NAME }),
	).toBeTruthy();
});

test("Blitz keeps both tabs: the panel is only in the Play tab", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	remote.failDailies = true;
	await open("/blitz", remote);
	await screen.findByText(SERVER_MESSAGE);
	expect(screen.getByRole("tab", { name: "Play" })).toBeTruthy();
	await user.click(screen.getByRole("tab", { name: "Leaderboards" }));
	expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
	await user.click(screen.getByRole("tab", { name: "Play" }));
	expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

test("the Codex shows the panel when the catalog fails, not when only the current Dailies fail", async () => {
	const remote = createFakeRemote();
	remote.failDailies = true;
	await open("/codex", remote);
	await screen.findByRole("heading", { level: 1, name: "Codex" });
	expect(screen.queryByText(SERVER_MESSAGE)).toBeNull();
	cleanup();
	const failing = createFakeRemote();
	failing.failCatalog = true;
	await open("/codex", failing);
	expect(await screen.findByText(SERVER_MESSAGE)).toBeTruthy();
});

test("the nav stays on the panel and History is reachable", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	remote.failCatalog = true;
	await open("/", remote);
	await screen.findByText(SERVER_MESSAGE);
	await user.click(
		within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", {
			name: "History",
		}),
	);
	expect(
		await screen.findByRole("heading", { level: 1, name: "History" }),
	).toBeTruthy();
});

test("a reload offline mid-game shows the panel, keeps the tries, and the game returns online", async () => {
	onLine = false;
	const remote = createFakeRemote();
	remote.failCatalog = true;
	remote.failDailies = true;
	const persist = createPersist(memoryStore());
	const record = {
		status: "playing" as const,
		guesses: [{ port: 1, result: "miss" as const, identified: null }],
	};
	persist.writeDaily("mixed", UTC_TODAY, record);
	await open("/", remote, persist);
	expect(await screen.findByText(OFFLINE_MESSAGE)).toBeTruthy();
	expect(persist.readDaily("mixed", UTC_TODAY)).toEqual(record);
	remote.failCatalog = false;
	remote.failDailies = false;
	setOnLine(true);
	expect(
		await screen.findByRole("heading", { level: 1, name: MIXED_NAME }),
	).toBeTruthy();
	expect(persist.readDaily("mixed", UTC_TODAY)).toEqual(record);
});

test("a build with no backend shows the panel, and Try again does nothing", async () => {
	const user = userEvent.setup();
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			history={createMemoryHistory({ initialEntries: ["/portdle/"] })}
			utcToday={UTC_TODAY}
		/>,
	);
	await user.click(await screen.findByRole("button", { name: "Try again" }));
	expect(screen.getByText(SERVER_MESSAGE)).toBeTruthy();
});

test("History lists saved finished Dailies without names, then fills them in on online", async () => {
	const remote = createFakeRemote();
	remote.failSchedule = true;
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", "2026-09-09", { status: "lost", guesses: [] });
	persist.writeDaily("protocols", "2026-09-09", {
		status: "playing",
		guesses: [],
	});
	await open("/history", remote, persist);
	const list = await screen.findByRole("list", { name: "2026-09-09" });
	expect(within(list).getAllByRole("listitem")).toHaveLength(1);
	expect(list.textContent).not.toContain(dailyOn("mixed", "2026-09-09").name);
	remote.failSchedule = false;
	remote.today = "2026-09-10";
	setOnLine(true);
	await screen.findByText(dailyOn("mixed", "2026-09-09").name);
	expect(remote.scheduleCalls).toBe(2);
});

test("History retries its failed Schedule read on focus", async () => {
	const remote = createFakeRemote();
	remote.failSchedule = true;
	await open("/history", remote);
	await waitFor(() => expect(remote.scheduleCalls).toBe(1));
	remote.failSchedule = false;
	focusWindow();
	await waitFor(() => expect(remote.scheduleCalls).toBe(2));
});

test("opening History retries a failed catalog read", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	remote.failCatalog = true;
	await open("/", remote);
	await screen.findByText(SERVER_MESSAGE);
	remote.failCatalog = false;
	await user.click(
		within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", {
			name: "History",
		}),
	);
	await waitFor(() => expect(remote.catalogCalls).toBe(2));
});

const LATE_ENTRY: CatalogEntry = {
	id: "late-entry",
	name: "Late Entry",
	port: 4242,
	transport: "tcp",
	description: "d",
	answerEligible: true,
};

// The current Dailies name an entry the loaded catalog does not hold.
function remoteMissingEntry(): FakeRemote {
	const remote = createFakeRemote();
	remote.entryIds = {
		mixed: LATE_ENTRY.id,
		protocols: LATE_ENTRY.id,
		applications: LATE_ENTRY.id,
	};
	return remote;
}

function catalogWithLateEntry() {
	const { protocols, applications } = fixtureCatalog();
	return { protocols: [...protocols, LATE_ENTRY], applications };
}

test("a Daily entry id missing from the loaded catalog: Try again reloads the catalog and the Daily resolves", async () => {
	const user = userEvent.setup();
	const remote = remoteMissingEntry();
	await open("/", remote);
	await screen.findByText(SERVER_MESSAGE);
	remote.catalog = catalogWithLateEntry();
	await user.click(screen.getByRole("button", { name: "Try again" }));
	expect(
		await screen.findByRole("heading", { level: 1, name: LATE_ENTRY.name }),
	).toBeTruthy();
	expect(remote.catalogCalls).toBe(2);
	expect(remote.dailiesCalls).toBe(1);
});

test.each([
	["online", () => setOnLine(true)],
	["focus", focusWindow],
])(
	"a missing Daily entry id reloads the catalog on %s, once",
	async (_name, trigger) => {
		const remote = remoteMissingEntry();
		await open("/", remote);
		await screen.findByText(SERVER_MESSAGE);
		remote.catalog = catalogWithLateEntry();
		const release = remote.holdCatalog();
		trigger();
		trigger();
		expect(remote.catalogCalls).toBe(2);
		release();
		expect(
			await screen.findByRole("heading", { level: 1, name: LATE_ENTRY.name }),
		).toBeTruthy();
	},
);

test("a catalog reload that still lacks the entry keeps the panel", async () => {
	const user = userEvent.setup();
	const remote = remoteMissingEntry();
	await open("/", remote);
	await screen.findByText(SERVER_MESSAGE);
	await user.click(screen.getByRole("button", { name: "Try again" }));
	await waitFor(() => expect(remote.catalogCalls).toBe(2));
	expect(await screen.findByText(SERVER_MESSAGE)).toBeTruthy();
	remote.failCatalog = true;
	await user.click(screen.getByRole("button", { name: "Try again" }));
	await waitFor(() => expect(remote.catalogCalls).toBe(3));
	expect(await screen.findByText(SERVER_MESSAGE)).toBeTruthy();
});
