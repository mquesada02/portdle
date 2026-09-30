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
