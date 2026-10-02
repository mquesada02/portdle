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
import { afterEach, expect, test, vi } from "vitest";
import type { BlitzRun } from "../engine/types";
import { createPersist } from "../persist/storage";
import type { AccountState, LeaderboardRow } from "../remote/remote";
import { missThree } from "../test/blitz";
import {
	createFakeRemote,
	type FakeRemote,
	leaderboardId,
} from "../test/fake-remote";
import {
	memoryStore,
	SERVER_MESSAGE,
	stubMatchMedia,
	stubViewTransitions,
} from "../test/helpers";
import { App } from "./app";

const SIGNED_IN: AccountState = {
	status: "signedIn",
	accountId: "u1",
	displayName: "Ada L.",
	nameConfirmed: true,
};

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

function row(rank: number, name: string, score: number, id = `p${rank}`) {
	return {
		accountId: id,
		displayName: name,
		score,
		timeToScoreMs: 1000 * rank,
		rank,
	} satisfies LeaderboardRow;
}

const ALL_TIME_MIXED_DEFAULT_SPRINT = leaderboardId({
	window: "allTime",
	category: "mixed",
	orientation: "default",
	mode: "sprint",
});

async function mountBlitz(
	remote?: FakeRemote,
	seed?: (persist: ReturnType<typeof createPersist>) => void,
) {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	seed?.(persist);
	const history = createMemoryHistory({ initialEntries: ["/portdle/blitz"] });
	render(<App persist={persist} remote={remote} history={history} />);
	await screen.findByRole("navigation", { name: "Main" });
	if (remote?.state.status === "signedIn") {
		await waitFor(() => expect(persist.readSyncAccount()).toBe("u1"));
	}
	return persist;
}

async function openLeaderboards(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("tab", { name: "Leaderboards" }));
}

test("without a Remote the Blitz screen has no tabs and its Play side shows the error panel", async () => {
	await mountBlitz();
	expect(screen.queryByRole("tablist")).toBeNull();
	expect(await screen.findByText(SERVER_MESSAGE)).toBeTruthy();
	expect(screen.queryByRole("button", { name: "New run" })).toBeNull();
});

test("with a Remote the idle arena has a Play tab selected and the arena in it", async () => {
	await mountBlitz(createFakeRemote());
	expect(
		screen.getByRole("tab", { name: "Play" }).getAttribute("aria-selected"),
	).toBe("true");
	const panel = screen.getByRole("tabpanel");
	expect(within(panel).getByRole("button", { name: "New run" })).toBeTruthy();
});

test("the Leaderboards tab replaces the arena and uses the switcher motion", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	const { calls, restore } = stubViewTransitions();
	try {
		await openLeaderboards(user);
		expect(screen.queryByRole("button", { name: "New run" })).toBeNull();
		expect(calls).toEqual([["switcher"]]);
		await user.click(screen.getByRole("tab", { name: "Play" }));
		expect(screen.getByRole("button", { name: "New run" })).toBeTruthy();
		expect(calls).toEqual([["switcher"], ["switcher"]]);
	} finally {
		restore();
	}
});

test("arrow keys move between the tabs", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	screen.getByRole("tab", { name: "Play" }).focus();
	await user.keyboard("{ArrowRight}");
	const leaderboards = screen.getByRole("tab", { name: "Leaderboards" });
	expect(leaderboards.getAttribute("aria-selected")).toBe("true");
	expect(document.activeElement).toBe(leaderboards);
	await user.keyboard("{ArrowRight}");
	expect(
		screen.getByRole("tab", { name: "Play" }).getAttribute("aria-selected"),
	).toBe("true");
});

test("the tabs are hidden during a run and on the end card", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	expect(screen.queryByRole("tablist")).toBeNull();
	await missThree(user);
	await screen.findByRole("button", { name: "Play again" });
	expect(screen.queryByRole("tablist")).toBeNull();
	await user.click(screen.getByRole("button", { name: "Play again" }));
	expect(screen.getByRole("tablist")).toBeTruthy();
});

test("the panel lists the top rows with rank, name, and score", async () => {
	const remote = createFakeRemote();
	remote.leaderboards[ALL_TIME_MIXED_DEFAULT_SPRINT] = [
		row(1, "Grace", 20),
		row(2, "Linus", 18),
	];
	const user = userEvent.setup();
	await mountBlitz(remote);
	await openLeaderboards(user);
	const grace = (await screen.findByText("Grace")).closest("tr");
	expect(grace?.textContent).toContain("1");
	expect(grace?.textContent).toContain("20");
	expect(screen.getByText("Linus").closest("tr")?.textContent).toContain("18");
	expect(screen.queryByText("You")).toBeNull();
	expect(remote.leaderboardCalls).toEqual([
		{
			window: "allTime",
			category: "mixed",
			orientation: "default",
			mode: "sprint",
		},
	]);
});

test("each pill row requests its own leaderboard", async () => {
	const remote = createFakeRemote();
	const user = userEvent.setup();
	await mountBlitz(remote);
	await openLeaderboards(user);
	await screen.findByText("Nobody has played this Leaderboard yet.");
	await user.click(screen.getByRole("radio", { name: "Weekly" }));
	await user.click(screen.getByRole("radio", { name: "Applications" }));
	await user.click(screen.getByRole("radio", { name: "Inverted" }));
	await user.click(screen.getByRole("radio", { name: "Survival" }));
	await waitFor(() =>
		expect(remote.leaderboardCalls.at(-1)).toEqual({
			window: "weekly",
			category: "applications",
			orientation: "inverted",
			mode: "survival",
		}),
	);
	const groups = screen
		.getAllByRole("group")
		.map((group) => group.querySelector("legend")?.textContent);
	expect(groups).toEqual([
		"Window",
		"Daily category",
		"Orientation",
		"Blitz mode",
	]);
});

test("a signed-in viewer inside the top 100 sees their row marked You", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	remote.leaderboards[ALL_TIME_MIXED_DEFAULT_SPRINT] = [
		row(1, "Grace", 20),
		row(2, "Ada L.", 18, "u1"),
	];
	const user = userEvent.setup();
	await mountBlitz(remote);
	await openLeaderboards(user);
	const ada = (await screen.findByText("Ada L.")).closest("tr");
	expect(within(ada as HTMLElement).getByText("You")).toBeTruthy();
	expect(screen.getAllByText("You")).toHaveLength(1);
});

test("a signed-in viewer outside the top 100 sees their row pinned below with their rank", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	remote.leaderboards[ALL_TIME_MIXED_DEFAULT_SPRINT] = [
		...Array.from({ length: 100 }, (_, index) =>
			row(index + 1, `Player ${index + 1}`, 500 - index),
		),
		row(137, "Ada L.", 3, "u1"),
		row(138, "Late", 2),
	];
	const user = userEvent.setup();
	await mountBlitz(remote);
	await openLeaderboards(user);
	await screen.findByText("Player 100");
	expect(screen.queryByText("Late")).toBeNull();
	const pinned = document.querySelector("tfoot");
	expect(pinned?.textContent).toContain("137");
	expect(pinned?.textContent).toContain("Ada L.");
	expect(document.querySelectorAll("tbody tr")).toHaveLength(100);
});

test("a loading line shows until the read answers", async () => {
	const remote = createFakeRemote();
	const release = remote.holdLeaderboard();
	const user = userEvent.setup();
	await mountBlitz(remote);
	await openLeaderboards(user);
	expect((await screen.findByRole("status")).textContent).toBe("Loading…");
	release();
	await screen.findByText("Nobody has played this Leaderboard yet.");
	expect(screen.getByRole("status").textContent).toBe("");
});

test("a failed read shows an error line, not the empty line", async () => {
	const remote = createFakeRemote();
	remote.failLeaderboard = true;
	const user = userEvent.setup();
	await mountBlitz(remote);
	await openLeaderboards(user);
	expect((await screen.findByRole("alert")).textContent).toBe(
		"Could not load this Leaderboard.",
	);
	expect(
		screen.queryByText("Nobody has played this Leaderboard yet."),
	).toBeNull();
});

test("opening the tab pushes pending changes before the read", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	const user = userEvent.setup();
	const persist = await mountBlitz(remote);
	persist.writeBlitzBests({ "mixed|default|sprint": { score: 7 } });
	await openLeaderboards(user);
	await waitFor(() => expect(remote.leaderboardCalls).toHaveLength(1));
	expect(remote.pushesAtRead[0]).toBeGreaterThanOrEqual(1);
	expect(remote.rows.bests["mixed|default|sprint"]).toEqual({ score: 7 });
});

test("a superseded read is ignored when it answers last", async () => {
	const remote = createFakeRemote();
	remote.leaderboards[ALL_TIME_MIXED_DEFAULT_SPRINT] = [row(1, "Stale", 5)];
	remote.leaderboards[
		leaderboardId({
			window: "weekly",
			category: "mixed",
			orientation: "default",
			mode: "sprint",
		})
	] = [row(1, "Fresh", 9)];
	const releaseFirst = remote.holdLeaderboard();
	const user = userEvent.setup();
	await mountBlitz(remote);
	await openLeaderboards(user);
	await waitFor(() => expect(remote.leaderboardCalls).toHaveLength(1));
	const releaseSecond = remote.holdLeaderboard();
	await user.click(screen.getByRole("radio", { name: "Weekly" }));
	await waitFor(() => expect(remote.leaderboardCalls).toHaveLength(2));
	releaseSecond();
	await screen.findByText("Fresh");
	releaseFirst();
	await new Promise((resolve) => setTimeout(resolve, 20));
	expect(screen.getByText("Fresh")).toBeTruthy();
	expect(screen.queryByText("Stale")).toBeNull();
});

test("a signed-out viewer sees no You marker", async () => {
	const remote = createFakeRemote();
	remote.leaderboards[ALL_TIME_MIXED_DEFAULT_SPRINT] = [
		row(1, "Grace", 20, "u1"),
	];
	const user = userEvent.setup();
	await mountBlitz(remote);
	await openLeaderboards(user);
	await screen.findByText("Grace");
	expect(screen.queryByText("You")).toBeNull();
});

test("the tabs, panel, and pill groups expose their roles and states", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	await openLeaderboards(user);
	const tab = screen.getByRole("tab", { name: "Leaderboards" });
	const panel = screen.getByRole("tabpanel", { name: "Leaderboards" });
	expect(tab.getAttribute("aria-selected")).toBe("true");
	expect(tab.getAttribute("aria-controls")).toBe(panel.id);
	expect(tab.getAttribute("tabindex")).toBe("0");
	const play = screen.getByRole("tab", { name: "Play" });
	expect(play.getAttribute("aria-selected")).toBe("false");
	expect(play.getAttribute("tabindex")).toBe("-1");
	for (const [group, checked] of [
		["Window", "All-time"],
		["Daily category", "Mixed"],
		["Orientation", "Default"],
		["Blitz mode", "Sprint (1m)"],
	] as const) {
		const radios = within(screen.getByRole("group", { name: group }))
			.getAllByRole("radio")
			.filter((radio) => (radio as HTMLInputElement).checked);
		expect(radios).toHaveLength(1);
		expect(
			within(screen.getByRole("group", { name: group })).getByRole("radio", {
				name: checked,
			}),
		).toBe(radios[0]);
	}
});

function checkedPills(): Record<string, string> {
	const result: Record<string, string> = {};
	for (const group of [
		"Window",
		"Daily category",
		"Orientation",
		"Blitz mode",
	]) {
		const checked = within(
			screen.getByRole("group", { name: group }),
		).getAllByRole("radio", { checked: true });
		result[group] = checked[0]?.closest("label")?.textContent ?? "";
	}
	return result;
}

function storedRun(overrides: Partial<BlitzRun> = {}): BlitzRun {
	return {
		category: "protocols",
		orientation: "inverted",
		mode: "marathon",
		ended: "timeout",
		endedAt: "2026-09-09T12:00:00.000Z",
		score: 3,
		rounds: [],
		...overrides,
	};
}

async function startRun(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
}

async function loseByLives(user: ReturnType<typeof userEvent.setup>) {
	await missThree(user);
	await screen.findByRole("button", { name: "Play again" });
}

test("the picker starts on the last run's Leaderboard with the window on All-time", async () => {
	const remote = createFakeRemote();
	const user = userEvent.setup();
	await mountBlitz(remote, (persist) => persist.writeBlitzRuns([storedRun()]));
	await openLeaderboards(user);
	await waitFor(() =>
		expect(remote.leaderboardCalls).toEqual([
			{
				window: "allTime",
				category: "protocols",
				orientation: "inverted",
				mode: "marathon",
			},
		]),
	);
	expect(checkedPills()).toEqual({
		Window: "All-time",
		"Daily category": "Protocols",
		Orientation: "Inverted",
		"Blitz mode": "Marathon (5m)",
	});
});

test("with no stored run the picker starts on Mixed, Default, and Sprint", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	await openLeaderboards(user);
	expect(checkedPills()).toEqual({
		Window: "All-time",
		"Daily category": "Mixed",
		Orientation: "Default",
		"Blitz mode": "Sprint (1m)",
	});
});

test("a pick in the picker is kept across a Play and Leaderboards tab change", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	await openLeaderboards(user);
	await user.click(screen.getByRole("radio", { name: "Weekly" }));
	await user.click(screen.getByRole("radio", { name: "Applications" }));
	await user.click(screen.getByRole("tab", { name: "Play" }));
	await openLeaderboards(user);
	expect(checkedPills()).toMatchObject({
		Window: "Weekly",
		"Daily category": "Applications",
	});
});

test("changing the setup dialog and cancelling leaves the picker's seed unchanged", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("radio", { name: "Applications" }));
	await user.click(screen.getByRole("button", { name: "Cancel" }));
	await openLeaderboards(user);
	expect(checkedPills()).toMatchObject({ "Daily category": "Mixed" });
});

test("a run that ends by lives resets the picker to that run's Leaderboard and keeps the window", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	await openLeaderboards(user);
	await user.click(screen.getByRole("radio", { name: "Weekly" }));
	await user.click(screen.getByRole("radio", { name: "Applications" }));
	await user.click(screen.getByRole("tab", { name: "Play" }));
	await startRun(user);
	await loseByLives(user);
	await user.click(screen.getByRole("button", { name: "Play again" }));
	await openLeaderboards(user);
	expect(checkedPills()).toEqual({
		Window: "Weekly",
		"Daily category": "Mixed",
		Orientation: "Default",
		"Blitz mode": "Sprint (1m)",
	});
});

test("a run that ends by timeout resets the picker to that run's whole Leaderboard and keeps the window", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	await openLeaderboards(user);
	await user.click(screen.getByRole("radio", { name: "Weekly" }));
	await user.click(screen.getByRole("radio", { name: "Protocols" }));
	await user.click(screen.getByRole("radio", { name: "Survival" }));
	await user.click(screen.getByRole("tab", { name: "Play" }));
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("radio", { name: "Applications" }));
	await user.click(screen.getByRole("radio", { name: "Inverted" }));
	await user.click(screen.getByRole("radio", { name: /^Marathon/ }));
	vi.useFakeTimers();
	fireEvent.click(screen.getByRole("button", { name: "Start" }));
	await vi.advanceTimersByTimeAsync(300_000);
	expect(screen.getByText("Time's up")).toBeTruthy();
	vi.useRealTimers();
	await user.click(screen.getByRole("button", { name: "Play again" }));
	await openLeaderboards(user);
	expect(checkedPills()).toEqual({
		Window: "Weekly",
		"Daily category": "Applications",
		Orientation: "Inverted",
		"Blitz mode": "Marathon (5m)",
	});
});

test("a nav tap on Blitz at rest leaves the Leaderboards tab selected", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	await openLeaderboards(user);
	await user.click(screen.getByRole("link", { name: "Blitz" }));
	expect(
		screen
			.getByRole("tab", { name: "Leaderboards" })
			.getAttribute("aria-selected"),
	).toBe("true");
});

test("with a Remote a nav tap on the end card returns to the Arena with its tabs", async () => {
	const user = userEvent.setup();
	await mountBlitz(createFakeRemote());
	await startRun(user);
	await loseByLives(user);
	await user.click(screen.getByRole("link", { name: "Blitz" }));
	expect(screen.getByRole("button", { name: "New run" })).toBeTruthy();
	expect(screen.getByRole("tablist")).toBeTruthy();
});
