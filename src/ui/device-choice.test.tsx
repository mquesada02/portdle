import { createMemoryHistory } from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { createPersist, type Persist } from "../persist/storage";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import { memoryStore, portDigits, stubMatchMedia } from "../test/helpers";
import { App } from "./app";
import {
	DEVICE_CHOICE_ADD,
	DEVICE_CHOICE_START,
	DEVICE_CHOICE_TITLE,
} from "./device-choice-copy";

const CONFIRMED = {
	status: "signedIn",
	accountId: "acc-b",
	displayName: "Bea",
	nameConfirmed: true,
} as const;
const UNCONFIRMED = { ...CONFIRMED, nameConfirmed: false } as const;
const mixedAnswer = dailyOn("mixed");
const OTHER_PORT = mixedAnswer.port === 1 ? 2 : 1;

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

// A device that last synced with account A and holds A's progress.
function deviceOfAccountA(store = memoryStore()) {
	const persist = createPersist(store);
	persist.writeHowToSeen();
	persist.writeSyncAccount("acc-a");
	persist.writeCodex({ http: { state: "correct", fresh: false } });
	return { store, persist };
}

function mountApp(persist: Persist, remote: FakeRemote) {
	stubMatchMedia();
	return render(
		<App
			persist={persist}
			remote={remote}
			history={createMemoryHistory({ initialEntries: ["/portdle/"] })}
			utcToday={UTC_TODAY}
		/>,
	);
}

async function findChoice() {
	return (await screen.findByRole(
		"dialog",
		{ name: DEVICE_CHOICE_TITLE },
		{ timeout: 3000 },
	)) as HTMLDialogElement;
}

const confirmDialog = () =>
	screen.queryByRole("dialog", { name: "Confirm your display name" });

test.each([
	["an unconfirmed name", UNCONFIRMED],
	["a confirmed name", CONFIRMED],
])(
	"a different account with %s asks first, and nothing is pulled or pushed",
	async (_name, account) => {
		const { persist } = deviceOfAccountA();
		const remote = createFakeRemote(account);
		mountApp(persist, remote);
		const dialog = await findChoice();
		expect(dialog.hasAttribute("open")).toBe(true);
		expect(
			screen.getByRole("button", { name: DEVICE_CHOICE_ADD }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: DEVICE_CHOICE_START }),
		).toBeTruthy();
		// Sync's first run makes the only account read at open. A focus during
		// that run is skipped, so focus until a second read shows the first run
		// has finished its pending check.
		await waitFor(() => {
			window.dispatchEvent(new Event("focus"));
			expect(remote.getAccountCalls).toBeGreaterThanOrEqual(2);
		});
		expect(remote.pullCalls).toBe(0);
		expect(remote.pushCalls).toHaveLength(0);
		expect(persist.readCodex().http?.state).toBe("correct");
		expect(confirmDialog()).toBeNull();
	},
);

test("the choice cannot be dismissed with Escape, a backdrop click, or a forced close", async () => {
	const { persist } = deviceOfAccountA();
	mountApp(persist, createFakeRemote(CONFIRMED));
	const dialog = await findChoice();
	const user = userEvent.setup();
	await user.keyboard("{Escape}");
	fireEvent.keyDown(dialog, { key: "Escape" });
	fireEvent.click(dialog);
	expect(dialog.hasAttribute("open")).toBe(true);
	act(() => {
		dialog.close();
		dialog.dispatchEvent(new Event("close"));
	});
	await waitFor(() => expect(dialog.hasAttribute("open")).toBe(true));
});

test("Escape on the choice does not close the How-to under it", async () => {
	const fresh = createPersist(memoryStore());
	fresh.writeSyncAccount("acc-a");
	fresh.writeCodex({ http: { state: "correct", fresh: false } });
	mountApp(fresh, createFakeRemote(CONFIRMED));
	const howTo = await screen.findByRole("dialog", { name: "How-to" });
	const choice = await findChoice();
	// The test setup's showModal only focuses the dialog element, so focus a
	// button for the key press to start inside the choice.
	const add = screen.getByRole("button", { name: DEVICE_CHOICE_ADD });
	act(() => add.focus());
	expect(choice.contains(document.activeElement)).toBe(true);
	const user = userEvent.setup();
	await user.keyboard("{Escape}");
	fireEvent.keyDown(choice, { key: "Escape" });
	expect(howTo.hasAttribute("open")).toBe(true);
	expect(choice.hasAttribute("open")).toBe(true);
	expect(fresh.readHowToSeen()).toBe(false);
});

test("the choice returns on every app load until the player chooses", async () => {
	const { store, persist } = deviceOfAccountA();
	const remote = createFakeRemote(CONFIRMED);
	const first = mountApp(persist, remote);
	await findChoice();
	first.unmount();
	mountApp(createPersist(store), remote);
	await findChoice();
	expect(remote.pushCalls).toHaveLength(0);
});

test("Add this device's progress keeps the rows, imports them, and does not ask again", async () => {
	const user = userEvent.setup();
	const { store, persist } = deviceOfAccountA();
	const remote = createFakeRemote(CONFIRMED);
	remote.rows.codex = { dns: "missed" };
	const view = mountApp(persist, remote);
	await findChoice();
	await user.click(screen.getByRole("button", { name: DEVICE_CHOICE_ADD }));
	await waitFor(() => expect(remote.rows.codex.http).toBe("correct"));
	expect(persist.readCodex().dns?.state).toBe("missed");
	expect(persist.readSyncAccount()).toBe("acc-b");
	expect(
		screen.queryByRole("dialog", { name: DEVICE_CHOICE_TITLE }),
	).toBeNull();
	view.unmount();
	mountApp(createPersist(store), remote);
	await screen.findByRole("button", { name: "Account" });
	expect(
		screen.queryByRole("dialog", { name: DEVICE_CHOICE_TITLE }),
	).toBeNull();
});

test("Add with an unconfirmed name shows the name confirm next and imports after Continue", async () => {
	const user = userEvent.setup();
	const { persist } = deviceOfAccountA();
	const remote = createFakeRemote(UNCONFIRMED);
	mountApp(persist, remote);
	await findChoice();
	await user.click(screen.getByRole("button", { name: DEVICE_CHOICE_ADD }));
	await screen.findByRole("dialog", { name: "Confirm your display name" });
	expect(remote.pushCalls).toHaveLength(0);
	await user.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() => expect(remote.rows.codex.http).toBe("correct"));
});

test("Add then Sign out at the name confirm leaves the device marked, and a third account asks again", async () => {
	const user = userEvent.setup();
	const { store, persist } = deviceOfAccountA();
	const remote = createFakeRemote(UNCONFIRMED);
	const view = mountApp(persist, remote);
	await findChoice();
	await user.click(screen.getByRole("button", { name: DEVICE_CHOICE_ADD }));
	await screen.findByRole("dialog", { name: "Confirm your display name" });
	await user.click(screen.getByRole("button", { name: "Sign out" }));
	await waitFor(() => expect(confirmDialog()).toBeNull());
	expect(persist.readSyncAccount()).toBe("acc-b");
	view.unmount();
	mountApp(
		createPersist(store),
		createFakeRemote({ ...CONFIRMED, accountId: "acc-c" }),
	);
	await findChoice();
});

test("Start from your account only clears the device, pulls the account, and remounts without cleared guesses", async () => {
	const user = userEvent.setup();
	const { persist } = deviceOfAccountA();
	persist.writeTheme("dark");
	persist.writeDaily("mixed", UTC_TODAY, {
		status: "playing",
		guesses: [{ port: OTHER_PORT, result: "miss", identified: null }],
	});
	persist.writeBlitzBests({ "mixed|default|sprint": { score: 9 } });
	const remote = createFakeRemote(CONFIRMED);
	remote.rows.codex = { dns: "missed" };
	mountApp(persist, remote);
	await findChoice();
	await user.click(screen.getByRole("button", { name: DEVICE_CHOICE_START }));
	await waitFor(() =>
		expect(
			screen.queryByRole("dialog", { name: DEVICE_CHOICE_TITLE }),
		).toBeNull(),
	);
	// Cleared: the device's rows are gone, the account's rows are in.
	expect(persist.readCodex().http).toBeUndefined();
	expect(persist.readBlitzBests()).toEqual({});
	expect(persist.readDaily("mixed", UTC_TODAY)).toBeNull();
	expect(persist.readCodex().dns?.state).toBe("missed");
	expect(persist.readSyncAccount()).toBe("acc-b");
	expect(remote.pushCalls).toHaveLength(0);
	// Remounted: the theme and the How-to dialog follow the cleared store.
	await screen.findByRole("dialog", { name: "How-to" });
	expect(persist.readTheme()).toBe("system");
	// A guess on the remounted Daily does not bring back the cleared guess.
	await user.click(screen.getByRole("button", { name: "Got it" }));
	await user.type(portDigits(), padToAnswer(OTHER_PORT, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	await waitFor(() =>
		expect(persist.readDaily("mixed", UTC_TODAY)?.guesses).toHaveLength(1),
	);
});

test("Start with an unconfirmed name clears, remounts, shows the name confirm, and pushes nothing before Continue", async () => {
	const user = userEvent.setup();
	const { persist } = deviceOfAccountA();
	const remote = createFakeRemote(UNCONFIRMED);
	mountApp(persist, remote);
	await findChoice();
	await user.click(screen.getByRole("button", { name: DEVICE_CHOICE_START }));
	await screen.findByRole("dialog", { name: "Confirm your display name" });
	expect(persist.readCodex().http).toBeUndefined();
	expect(remote.pullCalls).toBe(0);
	expect(remote.pushCalls).toHaveLength(0);
	await user.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() => expect(remote.pullCalls).toBe(1));
});

test("a failed pull after Start is silent and the app still remounts on the cleared device", async () => {
	const user = userEvent.setup();
	const { persist } = deviceOfAccountA();
	const remote = createFakeRemote(CONFIRMED);
	remote.failPull = true;
	mountApp(persist, remote);
	await findChoice();
	await user.click(screen.getByRole("button", { name: DEVICE_CHOICE_START }));
	await waitFor(() =>
		expect(
			screen.queryByRole("dialog", { name: DEVICE_CHOICE_TITLE }),
		).toBeNull(),
	);
	expect(persist.readCodex().http).toBeUndefined();
	await screen.findByRole("dialog", { name: "How-to" });
	remote.failPull = false;
	remote.rows.codex = { dns: "correct" };
	await act(async () => {
		window.dispatchEvent(new Event("focus"));
	});
	await waitFor(() => expect(persist.readCodex().dns?.state).toBe("correct"));
});

test("an account gone during the pull after Start still remounts and leaves the device signed out", async () => {
	const user = userEvent.setup();
	const { persist } = deviceOfAccountA();
	const remote = createFakeRemote(CONFIRMED);
	mountApp(persist, remote);
	await findChoice();
	remote.gone = true;
	await user.click(screen.getByRole("button", { name: DEVICE_CHOICE_START }));
	await waitFor(() =>
		expect(
			screen.queryByRole("dialog", { name: DEVICE_CHOICE_TITLE }),
		).toBeNull(),
	);
	expect(persist.readCodex().http).toBeUndefined();
	expect(remote.state.status).toBe("signedOut");
});

test("a device that never synced, the same account, and preferences only ask nothing", async () => {
	const neverSynced = createPersist(memoryStore());
	neverSynced.writeHowToSeen();
	neverSynced.writeCodex({ http: { state: "correct", fresh: false } });
	const remote = createFakeRemote(CONFIRMED);
	mountApp(neverSynced, remote);
	await waitFor(() => expect(remote.rows.codex.http).toBe("correct"));
	expect(
		screen.queryByRole("dialog", { name: DEVICE_CHOICE_TITLE }),
	).toBeNull();
	cleanup();

	const same = createPersist(memoryStore());
	same.writeHowToSeen();
	same.writeSyncAccount("acc-b");
	same.writeCodex({ http: { state: "correct", fresh: false } });
	mountApp(same, createFakeRemote(CONFIRMED));
	await screen.findByRole("button", { name: "Account" });
	expect(
		screen.queryByRole("dialog", { name: DEVICE_CHOICE_TITLE }),
	).toBeNull();
	cleanup();

	const prefsOnly = createPersist(memoryStore());
	prefsOnly.writeHowToSeen();
	prefsOnly.writeSyncAccount("acc-a");
	prefsOnly.writeTheme("dark");
	mountApp(prefsOnly, createFakeRemote(CONFIRMED));
	await screen.findByRole("button", { name: "Account" });
	expect(
		screen.queryByRole("dialog", { name: DEVICE_CHOICE_TITLE }),
	).toBeNull();
});

test.each(["writeSyncChanges", "writeSyncAccount"] as const)(
	"a failed %s on Add shows an error and keeps the dialog",
	async (write) => {
		const user = userEvent.setup();
		const { persist } = deviceOfAccountA();
		const remote = createFakeRemote(CONFIRMED);
		mountApp(persist, remote);
		await findChoice();
		vi.spyOn(persist, write).mockReturnValue({ ok: false });
		await user.click(screen.getByRole("button", { name: DEVICE_CHOICE_ADD }));
		expect(
			await screen.findByText("Could not save your choice. Try again."),
		).toBeTruthy();
		expect(
			screen.getByRole("dialog", { name: DEVICE_CHOICE_TITLE }),
		).toBeTruthy();
		expect(persist.readSyncAccount()).toBe("acc-a");
		expect(remote.pullCalls).toBe(0);
		expect(remote.pushCalls).toHaveLength(0);
	},
);

test.each([
	["Add", DEVICE_CHOICE_ADD],
	["Start", DEVICE_CHOICE_START],
])(
	"a dialog left open by another tab's choice does nothing on %s",
	async (_name, label) => {
		const user = userEvent.setup();
		const { persist } = deviceOfAccountA();
		const remote = createFakeRemote(CONFIRMED);
		mountApp(persist, remote);
		await findChoice();
		// Another tab chose "Add" and marked the device as this account's.
		persist.writeSyncAccount("acc-b");
		await user.click(screen.getByRole("button", { name: label }));
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: DEVICE_CHOICE_TITLE }),
			).toBeNull(),
		);
		expect(persist.readCodex().http?.state).toBe("correct");
		expect(remote.pullCalls).toBe(0);
		expect(remote.pushCalls).toHaveLength(0);
	},
);

test("the choice opens over an open How-to", async () => {
	const fresh = createPersist(memoryStore());
	fresh.writeSyncAccount("acc-a");
	fresh.writeCodex({ http: { state: "correct", fresh: false } });
	mountApp(fresh, createFakeRemote(CONFIRMED));
	const howTo = await screen.findByRole("dialog", { name: "How-to" });
	const choice = await findChoice();
	expect(howTo.hasAttribute("open")).toBe(true);
	expect(choice.hasAttribute("open")).toBe(true);
});
