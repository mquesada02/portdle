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
import type { DailyPersist } from "../engine/types";
import { createPersist } from "../persist/storage";
import type { AccountState, DailyGlobalStats } from "../remote/remote";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
import {
	createFakeRemote,
	dailyStatsId,
	type FakeRemote,
} from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	portDigits,
	stubMatchMedia,
} from "../test/helpers";
import { App } from "./app";

const mixedAnswer = dailyOn("mixed");

const SIGNED_IN: AccountState = {
	status: "signedIn",
	accountId: "u1",
	displayName: "Ada L.",
	nameConfirmed: true,
};

const TOTALS: DailyGlobalStats = {
	players: 8,
	wins: 6,
	losses: 2,
	byTries: [1, 0, 3, 2, 0, 0],
};

function wonIn(tries: number, late?: boolean): DailyPersist {
	return {
		status: "won",
		guesses: Array.from({ length: tries }, (_, index) => ({
			port: index + 1,
			result: index === tries - 1 ? "correct" : "miss",
			identified: null,
		})),
		...(late === undefined ? {} : { late }),
	};
}

async function renderDaily(options: {
	remote: FakeRemote;
	persist?: ReturnType<typeof createPersist>;
}) {
	stubMatchMedia();
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	render(<App persist={persist} remote={options.remote} history={history} />);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	return persist;
}

async function winMixed(user: ReturnType<typeof userEvent.setup>) {
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
}

function block() {
	return screen.getByRole("heading", { name: "Global stats" })
		.parentElement as HTMLElement;
}

function stat(label: string): string | undefined {
	return (
		within(block()).getByText(label).nextElementSibling?.textContent ??
		undefined
	);
}

afterEach(() => {
	cleanup();
});

test("signed out: finishing shows the totals with the own bar highlighted", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	remote.dailyStats[dailyStatsId("mixed", UTC_TODAY)] = TOTALS;
	await renderDaily({ remote });
	expect(screen.queryByRole("heading", { name: "Global stats" })).toBeNull();
	await winMixed(user);
	await within(block()).findByText("8");
	expect(stat("Players")).toBe("8");
	expect(stat("Solve rate")).toBe("75%");
	const rows = within(block()).getAllByRole("listitem");
	expect(rows.map((row) => row.textContent)).toEqual([
		"113%",
		"20%",
		"338%",
		"425%",
		"50%",
		"60%",
		"Lost25%",
	]);
	expect(
		rows.filter((row) => row.getAttribute("aria-current") === "true"),
	).toEqual([rows[0]]);
	expect(remote.dailyStatsCalls).toBe(1);
});

test("a lost result highlights the Lost row", async () => {
	const remote = createFakeRemote();
	remote.dailyStats[dailyStatsId("mixed", UTC_TODAY)] = TOTALS;
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, {
		status: "lost",
		guesses: Array.from({ length: 6 }, (_, index) => ({
			port: index + 1,
			result: "miss" as const,
			identified: null,
		})),
		late: false,
	});
	await renderDaily({ remote, persist });
	await within(block()).findByText("8");
	const current = within(block())
		.getAllByRole("listitem")
		.filter((row) => row.getAttribute("aria-current") === "true");
	expect(current.map((row) => row.textContent)).toEqual(["Lost25%"]);
});

test("an unfinished Daily shows no block and makes no read", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	await renderDaily({ remote });
	await user.type(portDigits(), padToAnswer(1, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.queryByRole("heading", { name: "Global stats" })).toBeNull();
	expect(remote.dailyStatsCalls).toBe(0);
});

test("a reopened finished board shows the block again", async () => {
	const remote = createFakeRemote();
	remote.dailyStats[dailyStatsId("mixed", UTC_TODAY)] = TOTALS;
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, wonIn(3, false));
	await renderDaily({ remote, persist });
	await within(block()).findByText("8");
	expect(
		within(block())
			.getAllByRole("listitem")
			.filter((row) => row.getAttribute("aria-current") === "true")
			.map((row) => row.textContent),
	).toEqual(["338%"]);
	expect(screen.queryByText("Late play, not counted")).toBeNull();
});

test("signed in: pending changes are pushed before the read", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	remote.dailyStats[dailyStatsId("mixed", UTC_TODAY)] = TOTALS;
	await renderDaily({ remote });
	await winMixed(user);
	await within(block()).findByText("8");
	expect(remote.pushesAtStatsRead[0]).toBeGreaterThanOrEqual(1);
	expect(remote.rows.dailies[`mixed|${UTC_TODAY}`]?.status).toBe("won");
});

test("a late play shows the note and keeps the own highlight", async () => {
	const remote = createFakeRemote();
	remote.dailyStats[dailyStatsId("mixed", UTC_TODAY)] = TOTALS;
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, wonIn(4, true));
	await renderDaily({ remote, persist });
	await within(block()).findByText("8");
	expect(within(block()).getByText("Late play, not counted")).toBeTruthy();
	expect(
		within(block())
			.getAllByRole("listitem")
			.filter((row) => row.getAttribute("aria-current") === "true")
			.map((row) => row.textContent),
	).toEqual(["425%"]);
});

test("with no players the count shows, the solve rate is a dash, and the own bar stays", async () => {
	const remote = createFakeRemote();
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, wonIn(2, false));
	await renderDaily({ remote, persist });
	await within(block()).findByText("0");
	expect(stat("Players")).toBe("0");
	expect(stat("Solve rate")).toBe("-");
	const rows = within(block()).getAllByRole("listitem");
	expect(rows.every((row) => row.textContent?.endsWith("0%"))).toBe(true);
	expect(rows[1]?.getAttribute("aria-current")).toBe("true");
});

test("a loading line shows until the read answers", async () => {
	const remote = createFakeRemote();
	const release = remote.holdDailyStats();
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, wonIn(2, false));
	await renderDaily({ remote, persist });
	await screen.findByText("Loading global stats…");
	release();
	await waitFor(() =>
		expect(screen.queryByText("Loading global stats…")).toBeNull(),
	);
	expect(stat("Players")).toBe("0");
});

test("a failed read shows one error line and leaves the Reveal and Share", async () => {
	const remote = createFakeRemote();
	remote.failDailyStats = true;
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, wonIn(2, false));
	await renderDaily({ remote, persist });
	expect((await screen.findByRole("alert")).textContent).toBe(
		"Could not load the global stats.",
	);
	expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
	expect(screen.getByText("Played")).toBeTruthy();
});

test("a read that answers after the player left leaves the new screen without a block", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	const release = remote.holdDailyStats();
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, wonIn(2, false));
	await renderDaily({ remote, persist });
	await screen.findByText("Loading global stats…");
	await user.click(screen.getByRole("link", { name: "Protocols" }));
	release();
	await waitFor(() =>
		expect(screen.queryByText("Loading global stats…")).toBeNull(),
	);
	expect(screen.queryByRole("heading", { name: "Global stats" })).toBeNull();
	expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
});
