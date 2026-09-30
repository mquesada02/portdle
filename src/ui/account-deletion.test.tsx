import { createMemoryHistory } from "@tanstack/react-router";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { createPersist } from "../persist/storage";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
import {
	createFakeRemote,
	emptyRows,
	type FakeRemote,
} from "../test/fake-remote";
import { memoryStore, portDigits, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

const SIGNED_IN = {
	status: "signedIn",
	accountId: "u1",
	displayName: "Ada L.",
	nameConfirmed: true,
} as const;

afterEach(() => {
	cleanup();
});

async function renderApp(
	remote: FakeRemote,
	options: { path?: string; howToSeen?: boolean } = {},
) {
	stubMatchMedia();
	const store = memoryStore();
	const persist = createPersist(store);
	if (options.howToSeen !== false) {
		persist.writeHowToSeen();
	}
	persist.writeTheme("dark");
	persist.writeCodex({ http: { state: "correct", fresh: false } });
	persist.writeDaily("mixed", "2026-09-09", {
		status: "playing",
		guesses: [{ port: 1, result: "miss", identified: null }],
	});
	const history = createMemoryHistory({
		initialEntries: [options.path ?? "/portdle/"],
	});
	render(
		<App
			persist={persist}
			remote={remote}
			history={history}
			utcToday="2026-09-09"
		/>,
	);
	await screen.findByRole("navigation", { name: "Main" });
	return { persist, store, history };
}

function accountButton() {
	return screen.getByRole("button", { name: "Account" });
}

async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>) {
	await user.click(accountButton());
	await user.click(
		await screen.findByRole("button", { name: "Delete account" }),
	);
	return screen.getByRole("dialog", { name: "Delete account" });
}

function dialogButton(dialog: HTMLElement, name: string) {
	return within(dialog).getByRole("button", { name }) as HTMLButtonElement;
}

const confirmButton = (dialog: HTMLElement) =>
	dialogButton(dialog, "Delete account");
const cancelButton = (dialog: HTMLElement) => dialogButton(dialog, "Cancel");

test("Delete account is absent when signed out and present when signed in", async () => {
	const user = userEvent.setup();
	await renderApp(createFakeRemote());
	await user.click(accountButton());
	await screen.findByRole("button", { name: "Sign in with Google" });
	expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
	cleanup();
	await renderApp(createFakeRemote(SIGNED_IN));
	await user.click(accountButton());
	expect(
		await screen.findByRole("button", { name: "Delete account" }),
	).toBeTruthy();
});

test("Delete account opens a confirm dialog that says what goes, and closes the menu", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp(remote);
	const dialog = await openDeleteDialog(user);
	expect(dialog.textContent).toContain("removes your account");
	expect(dialog.textContent).toContain("synced data");
	expect(dialog.textContent).toContain("Leaderboard rows");
	expect(dialog.textContent).toContain("clears this device");
	expect(document.getElementById("account-menu")).toBeNull();
	expect(remote.deleteCalls).toBe(0);
});

test("Cancel, Escape, and a backdrop click each close the dialog, delete nothing, and focus the Account button", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	const { persist } = await renderApp(remote);
	for (const cancel of [
		(dialog: HTMLElement) => user.click(cancelButton(dialog)),
		(dialog: HTMLElement) => {
			fireEvent.keyDown(dialog, { key: "Escape" });
		},
		(dialog: HTMLElement) => {
			fireEvent.click(dialog);
		},
	]) {
		const dialog = await openDeleteDialog(user);
		await cancel(dialog);
		expect(screen.queryByRole("dialog", { name: "Delete account" })).toBeNull();
		expect(document.activeElement).toBe(accountButton());
	}
	expect(remote.deleteCalls).toBe(0);
	expect(persist.readCodex().http?.state).toBe("correct");
});

test("confirming deletes the account, clears the device, and opens a fresh signed-out Daily", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	remote.rows.codex = { dns: "correct" };
	const { persist, store, history } = await renderApp(remote, {
		path: "/portdle/codex",
	});
	const dialog = await openDeleteDialog(user);
	await user.click(confirmButton(dialog));
	await waitFor(() => expect(remote.deleteCalls).toBe(1));
	await screen.findByRole("dialog", { name: "How-to" });
	expect(history.location.pathname).toBe("/portdle/");
	expect(screen.queryByRole("dialog", { name: "Delete account" })).toBeNull();
	expect(persist.readCodex()).toEqual({});
	expect(persist.readTheme()).toBe("system");
	expect(persist.readHowToSeen()).toBe(false);
	expect(persist.readDaily("mixed", "2026-09-09")).toBeNull();
	expect(persist.readSyncAccount()).toBeNull();
	// The remounted shell writes only the last seen UTC day.
	expect(store.data.size).toBeGreaterThan(0);
	for (const key of store.data.keys()) {
		expect(key).toMatch(/last.?seen/i);
	}
	expect(remote.rows).toEqual(emptyRows());
	await user.click(accountButton());
	expect(
		await screen.findByRole("button", { name: "Sign in with Google" }),
	).toBeTruthy();
	// Nothing on screen writes the cleared data back.
	await new Promise((resolve) => setTimeout(resolve, 20));
	expect(persist.readCodex()).toEqual({});
	expect(persist.readDaily("mixed", "2026-09-09")).toBeNull();
});

test("a failed delete shows a one-line error and changes nothing", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	remote.rows.codex = { dns: "correct" };
	remote.failDeleteAccount = true;
	const { persist } = await renderApp(remote);
	const dialog = await openDeleteDialog(user);
	await user.click(confirmButton(dialog));
	const alert = await screen.findByText(
		"Could not delete your account. Try again.",
	);
	expect(alert.getAttribute("role")).toBe("alert");
	expect(screen.getByRole("dialog", { name: "Delete account" })).toBeTruthy();
	expect(confirmButton(dialog).disabled).toBe(false);
	expect(cancelButton(dialog).disabled).toBe(false);
	expect(persist.readCodex().http?.state).toBe("correct");
	expect(persist.readTheme()).toBe("dark");
	expect(remote.state.status).toBe("signedIn");
	expect(remote.rows.codex.dns).toBe("correct");
	remote.failDeleteAccount = false;
	await user.click(confirmButton(dialog));
	await waitFor(() => expect(persist.readCodex()).toEqual({}));
});

test("while a delete runs both buttons are disabled and Escape and a backdrop click do not close the dialog", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp(remote);
	const dialog = await openDeleteDialog(user);
	const release = remote.holdDeleteAccount();
	await user.click(confirmButton(dialog));
	await waitFor(() => expect(confirmButton(dialog).disabled).toBe(true));
	expect(cancelButton(dialog).disabled).toBe(true);
	fireEvent.keyDown(dialog, { key: "Escape" });
	fireEvent.click(dialog);
	expect(screen.getByRole("dialog", { name: "Delete account" })).toBeTruthy();
	release();
	await screen.findByRole("dialog", { name: "How-to" });
	expect(remote.deleteCalls).toBe(1);
});

test("Escape and a backdrop click in the dialog do not close the How-to under it", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp(remote, { howToSeen: false });
	for (const cancel of [
		(dialog: HTMLElement) => fireEvent.keyDown(dialog, { key: "Escape" }),
		(dialog: HTMLElement) => fireEvent.click(dialog),
	]) {
		const dialog = await openDeleteDialog(user);
		cancel(dialog);
		expect(screen.queryByRole("dialog", { name: "Delete account" })).toBeNull();
		expect(screen.getByRole("dialog", { name: "How-to" })).toBeTruthy();
	}
});

test("after a delete the Daily starts empty and a guess stores one guess, not the old screen's", async () => {
	const user = userEvent.setup();
	const answer = dailyOn("mixed");
	const remote = createFakeRemote(SIGNED_IN);
	const { persist } = await renderApp(remote);
	expect(screen.getByText("1 / 6")).toBeTruthy();
	const dialog = await openDeleteDialog(user);
	await user.click(confirmButton(dialog));
	await screen.findByRole("dialog", { name: "How-to" });
	await user.click(screen.getByRole("button", { name: "Got it" }));
	expect(screen.getByText("0 / 6")).toBeTruthy();
	await user.type(portDigits(), padToAnswer(80, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("1 / 6")).toBeTruthy();
	expect(persist.readDaily("mixed", UTC_TODAY)?.guesses).toHaveLength(1);
});

test("Delete account is absent while the account loads and when it failed to load", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	const release = remote.holdGetAccount();
	await renderApp(remote);
	await user.click(accountButton());
	expect(screen.getByText("Loading account.")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
	release();
	await screen.findByRole("button", { name: "Delete account" });
	cleanup();
	const failing = createFakeRemote(SIGNED_IN);
	failing.failGetAccount = true;
	await renderApp(failing);
	await user.click(accountButton());
	await screen.findByText("Could not load your account.");
	expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
});

test("an account already gone counts as deleted: the device is cleared and signed out", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	const { persist } = await renderApp(remote);
	const dialog = await openDeleteDialog(user);
	remote.gone = true;
	await user.click(confirmButton(dialog));
	await screen.findByRole("dialog", { name: "How-to" });
	expect(remote.signOutCalls).toBe(1);
	expect(persist.readCodex()).toEqual({});
});

test("another device signs itself out after a deletion elsewhere and keeps its local data", async () => {
	const user = userEvent.setup();
	const rows = emptyRows();
	rows.codex = { http: "correct" };
	const deleter = createFakeRemote(SIGNED_IN, rows);
	const other = createFakeRemote(SIGNED_IN, rows);
	const { persist } = await renderApp(other);
	await waitFor(() => expect(other.pullCalls).toBe(1));
	await deleter.deleteAccount();
	other.gone = true;
	fireEvent.focus(window);
	await waitFor(() => expect(other.signOutCalls).toBe(1));
	await user.click(accountButton());
	expect(
		await screen.findByRole("button", { name: "Sign in with Google" }),
	).toBeTruthy();
	expect(persist.readCodex().http?.state).toBe("correct");
	expect(persist.readTheme()).toBe("dark");
});

test("the dialog closes when the account is reported gone while it is open", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp(remote);
	await openDeleteDialog(user);
	remote.gone = true;
	fireEvent.focus(window);
	await waitFor(() =>
		expect(screen.queryByRole("dialog", { name: "Delete account" })).toBeNull(),
	);
});
