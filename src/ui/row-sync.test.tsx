import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { createPersist } from "../persist/storage";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import { memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

const CONFIRMED = {
	status: "signedIn",
	accountId: "u1",
	displayName: "Ada L.",
	nameConfirmed: true,
} as const;
const UNCONFIRMED = { ...CONFIRMED, nameConfirmed: false } as const;

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
	cleanup();
});

function mountApp(remote: FakeRemote) {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	render(
		<App
			persist={persist}
			remote={remote}
			history={history}
			utcToday="2026-09-09"
		/>,
	);
	return persist;
}

test("a signed-in player's app open pulls the account and merges it into the device", async () => {
	const remote = createFakeRemote(CONFIRMED);
	remote.rows.codex = { dns: "correct" };
	const persist = mountApp(remote);
	await waitFor(() => expect(persist.readCodex().dns?.state).toBe("correct"));
	expect(remote.pullCalls).toBe(1);
});

test("a local write reaches the account 1.5 seconds later", async () => {
	const remote = createFakeRemote(CONFIRMED);
	const persist = mountApp(remote);
	await waitFor(() => expect(remote.pullCalls).toBe(1));
	await waitFor(() => expect(persist.readSyncAccount()).toBe("u1"));
	// The first sync also imported the stored How-to seen flag.
	remote.pushCalls.length = 0;
	vi.useFakeTimers();
	persist.writeDaily("mixed", "2026-09-09", { status: "playing", guesses: [] });
	vi.advanceTimersByTime(1499);
	expect(remote.pushCalls).toHaveLength(0);
	vi.advanceTimersByTime(1);
	vi.useRealTimers();
	await waitFor(() =>
		expect(remote.rows.dailies["mixed|2026-09-09"]).toEqual({
			status: "playing",
			guesses: [],
		}),
	);
});

test("an unconfirmed name syncs nothing until Continue, then imports the device", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(UNCONFIRMED);
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	persist.writeCodex({ http: { state: "correct", fresh: false } });
	render(
		<App
			persist={persist}
			remote={remote}
			history={createMemoryHistory({ initialEntries: ["/portdle/"] })}
			utcToday="2026-09-09"
		/>,
	);
	await screen.findByRole("dialog", { name: "Confirm your display name" });
	expect(remote.pullCalls).toBe(0);
	expect(remote.pushCalls).toHaveLength(0);
	await user.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() => expect(remote.rows.codex).toEqual({ http: "correct" }));
});

test("the account menu's own read rejecting with AccountGoneError shows signed out, signs Sync out, and keeps the device's data", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(CONFIRMED);
	remote.gone = true;
	const persist = mountApp(remote);
	persist.writeCodex({ http: { state: "correct", fresh: false } });
	await waitFor(() => expect(remote.signOutCalls).toBeGreaterThan(0));
	await user.click(screen.getByRole("button", { name: "Account" }));
	expect(
		await screen.findByRole("button", { name: "Sign in with Google" }),
	).toBeTruthy();
	expect(screen.queryByText("Could not load your account.")).toBeNull();
	expect(persist.readCodex().http?.state).toBe("correct");
});

test("with no Remote nothing is pulled, pushed, or scheduled", () => {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			history={createMemoryHistory({ initialEntries: ["/portdle/"] })}
			utcToday="2026-09-09"
		/>,
	);
	expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
});

test("signing out stops syncing and keeps local data", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(CONFIRMED);
	const persist = mountApp(remote);
	await waitFor(() => expect(persist.readSyncAccount()).toBe("u1"));
	// The first sync also imported the stored How-to seen flag.
	remote.pushCalls.length = 0;
	await user.click(screen.getByRole("button", { name: "Account" }));
	await user.click(await screen.findByRole("button", { name: "Sign out" }));
	await screen.findByRole("button", { name: "Sign in with Google" });
	vi.useFakeTimers();
	persist.writeCodex({ http: { state: "correct", fresh: false } });
	vi.advanceTimersByTime(3000);
	vi.useRealTimers();
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(remote.pushCalls).toHaveLength(0);
	expect(remote.rows.codex).toEqual({});
});

test("app open reads the account once, and the menu shows that read", async () => {
	const remote = createFakeRemote(CONFIRMED);
	const persist = mountApp(remote);
	await waitFor(() => expect(persist.readSyncAccount()).toBe("u1"));
	await userEvent.click(await screen.findByRole("button", { name: "Account" }));
	expect(await screen.findByText("Ada L.")).toBeTruthy();
	expect(remote.getAccountCalls).toBe(1);
});

test("a signed-out open reads the account once", async () => {
	const remote = createFakeRemote();
	mountApp(remote);
	await userEvent.click(await screen.findByRole("button", { name: "Account" }));
	await screen.findByRole("button", { name: "Sign in with Google" });
	expect(remote.getAccountCalls).toBe(1);
});

test("an account already gone at open makes one read and one sign-out, and the menu is signed out", async () => {
	const remote = createFakeRemote(CONFIRMED);
	remote.gone = true;
	mountApp(remote);
	await userEvent.click(await screen.findByRole("button", { name: "Account" }));
	await screen.findByRole("button", { name: "Sign in with Google" });
	await waitFor(() => expect(remote.signOutCalls).toBe(1));
	expect(remote.getAccountCalls).toBe(1);
});

test("a display name changed on another device shows in the menu after the next pull", async () => {
	const remote = createFakeRemote(CONFIRMED);
	const persist = mountApp(remote);
	await waitFor(() => expect(persist.readSyncAccount()).toBe("u1"));
	await userEvent.click(screen.getByRole("button", { name: "Account" }));
	expect(await screen.findByText("Ada L.")).toBeTruthy();
	remote.state = { ...CONFIRMED, displayName: "Grace H." };
	// The open pull is recent, so the focus pull needs the throttle to lapse.
	const later = Date.now() + 30000;
	vi.spyOn(Date, "now").mockReturnValue(later);
	window.dispatchEvent(new Event("focus"));
	expect(await screen.findByText("Grace H.")).toBeTruthy();
	expect(screen.queryByText("Ada L.")).toBeNull();
});

test("a pulled theme shows the next time the shell mounts, not on the mounted shell", async () => {
	document.documentElement.classList.remove("dark");
	const remote = createFakeRemote(CONFIRMED);
	remote.rows.preferences = { theme: "dark" };
	const release = remote.holdPull();
	const persist = mountApp(remote);
	await screen.findByRole("button", { name: "Account" });
	release();
	await waitFor(() => expect(persist.readTheme()).toBe("dark"));
	expect(document.documentElement.classList.contains("dark")).toBe(false);
	cleanup();
	render(
		<App
			persist={persist}
			history={createMemoryHistory({ initialEntries: ["/portdle/"] })}
			utcToday="2026-09-09"
		/>,
	);
	await screen.findByRole("button", { name: "Toggle color theme" });
	expect(document.documentElement.classList.contains("dark")).toBe(true);
	document.documentElement.classList.remove("dark");
});

test("a pulled Codex sort shows the next time the Codex screen mounts, not on the mounted one", async () => {
	stubMatchMedia();
	const remote = createFakeRemote(CONFIRMED);
	remote.rows.preferences = { codexSort: "port" };
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/codex"] });
	const release = remote.holdPull();
	render(
		<App
			persist={persist}
			remote={remote}
			history={history}
			utcToday="2026-09-09"
		/>,
	);
	const name = await screen.findByRole("radio", { name: "Name" });
	release();
	await waitFor(() => expect(persist.readCodexSort()).toBe("port"));
	expect((name as HTMLInputElement).checked).toBe(true);
	cleanup();
	render(
		<App
			persist={persist}
			history={createMemoryHistory({ initialEntries: ["/portdle/codex"] })}
			utcToday="2026-09-09"
		/>,
	);
	const port = await screen.findByRole("radio", { name: "Port" });
	expect((port as HTMLInputElement).checked).toBe(true);
});
