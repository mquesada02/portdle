import { createMemoryHistory } from "@tanstack/react-router";
import {
	cleanup,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import type { BlitzRun, DailyPersist } from "../engine/types";
import { createPersist, type Persist } from "../persist/storage";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	portDigits,
	stubMatchMedia,
} from "../test/helpers";
import { App } from "./app";

// A pull that lands after a screen mounted must show on that screen, with no
// navigation (issue 346).

const SIGNED_IN = {
	status: "signedIn",
	accountId: "u1",
	displayName: "Ada L.",
	nameConfirmed: true,
} as const;

const mixedAnswer = dailyOn("mixed");

function won(port: number): DailyPersist {
	return {
		status: "won",
		guesses: [{ port, result: "correct", identified: null }],
	};
}

const RUN: BlitzRun = {
	category: "mixed",
	orientation: "default",
	mode: "sprint",
	ended: "lives",
	endedAt: "2026-09-09T10:00:00.000Z",
	score: 9,
	timeToScoreMs: 1000.5,
	rounds: [
		{ id: "http", name: "HTTP", port: 80, outcome: "correct", wrong: null },
	],
};

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
});

// Mounts the app on `path` with the account's pull held, waits for the screen,
// then lets the pull finish. `seed` writes this device's rows before the mount.
async function mountThenPull(
	remote: FakeRemote,
	path: string,
	beforePull: () => Promise<void>,
	seed: (persist: Persist) => void = () => {},
): Promise<Persist> {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	seed(persist);
	const release = remote.holdPull();
	render(
		<App
			persist={persist}
			remote={remote}
			history={createMemoryHistory({ initialEntries: [path] })}
		/>,
	);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	await beforePull();
	release();
	await waitFor(() => expect(persist.readSyncAccount()).toBe("u1"));
	return persist;
}

test("the open Daily shows a Daily finished on another device, with no navigation", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	remote.rows.dailies[`mixed|${UTC_TODAY}`] = won(mixedAnswer.port);
	await mountThenPull(remote, "/portdle/", async () => {
		expect(screen.getByRole("group", { name: "Port digits" })).toBeTruthy();
	});
	await waitFor(() => expect(screen.getByText("Played")).toBeTruthy());
	expect(screen.queryByRole("group", { name: "Port digits" })).toBeNull();
});

test("typed digits stay when a pull changes another Daily", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	remote.rows.dailies[`protocols|${UTC_TODAY}`] = won(
		dailyOn("protocols").port,
	);
	const persist = await mountThenPull(remote, "/portdle/", async () => {
		await user.type(portDigits(), "1");
	});
	expect(persist.readDaily("protocols", UTC_TODAY)?.status).toBe("won");
	expect((portDigits() as HTMLInputElement).value).toBe("1");
});

test("a finished Daily's stats count an earlier Daily pulled after it opened", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	remote.today = "2026-09-10";
	remote.rows.dailies[`mixed|${UTC_TODAY}`] = won(mixedAnswer.port);
	const played = () =>
		screen.getByText("Played").nextElementSibling?.textContent;
	await mountThenPull(remote, "/portdle/", async () => {
		const answer = dailyOn("mixed", "2026-09-10");
		await user.type(portDigits(), padToAnswer(answer.port, answer));
		await user.click(screen.getByRole("button", { name: "Submit" }));
		expect(played()).toBe("1");
	});
	await waitFor(() => expect(played()).toBe("2"));
});

test("the History Daily tab lists a Daily pulled after it opened", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	remote.rows.dailies[`mixed|${UTC_TODAY}`] = won(mixedAnswer.port);
	await mountThenPull(remote, "/portdle/history", async () => {
		expect(screen.queryByText(/Won 1\/6/)).toBeNull();
	});
	await waitFor(() => expect(screen.getByText(/Won 1\/6/)).toBeTruthy());
});

test("the History Blitz tab lists a run pulled after it opened", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	remote.rows.runs = [RUN];
	await mountThenPull(remote, "/portdle/history/blitz", async () => {
		await screen.findByText("No runs yet.");
	});
	await waitFor(() => expect(screen.getByText("Out of lives")).toBeTruthy());
});

test("the Archive shows the result of a Daily pulled after it opened", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	// The Archive lists only the days before server today.
	remote.today = "2026-09-10";
	remote.rows.dailies[`mixed|${UTC_TODAY}`] = won(mixedAnswer.port);
	await mountThenPull(remote, "/portdle/archive", async () => {
		await screen.findByRole("heading", { name: "Archive" });
		expect(screen.queryByText(/Won 1\/6/)).toBeNull();
	});
	await waitFor(() => expect(screen.getByText(/Won 1\/6/)).toBeTruthy());
});

test("the Codex counts an entry pulled after it opened", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	remote.rows.codex = { http: "correct" };
	await mountThenPull(remote, "/portdle/codex", async () => {
		await screen.findByText(/Seen 0 \/ \d+ · Correct 0/);
	});
	await waitFor(() =>
		expect(screen.getByText(/Seen 1 \/ \d+ · Correct 1/)).toBeTruthy(),
	);
});

test("a Codex entry fresh at open stays fresh after a pull adds another", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	remote.rows.codex = { http: "correct" };
	await mountThenPull(
		remote,
		"/portdle/codex",
		async () => {
			const ftp = await screen.findByRole("button", {
				name: "FTP 21 TCP Missed",
			});
			expect(ftp.className).toContain("animate-pop");
		},
		(persist) => persist.writeCodex({ ftp: { state: "missed", fresh: true } }),
	);
	const http = await screen.findByRole("button", {
		name: "HTTP 80 TCP Correct",
	});
	expect(http.className).not.toContain("animate-pop");
	expect(
		screen.getByRole("button", { name: "FTP 21 TCP Missed" }).className,
	).toContain("animate-pop");
});

test("Blitz shows the last run and the Best pulled after it opened", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	remote.rows.runs = [RUN];
	remote.rows.bests = { "mixed|default|sprint": { score: 9 } };
	await mountThenPull(remote, "/portdle/blitz", async () => {
		await screen.findByText("No runs yet. Start one and it will show here.");
	});
	await waitFor(() => expect(screen.getByText("Bests")).toBeTruthy());
	const main = screen.getByRole("main");
	expect(within(main).getAllByText("Score 9")).toHaveLength(2);
});

test("the theme chosen on another device applies when the pull lands", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	remote.rows.preferences = { theme: "dark" };
	await mountThenPull(remote, "/portdle/", async () => {
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});
	await waitFor(() =>
		expect(document.documentElement.classList.contains("dark")).toBe(true),
	);
});
