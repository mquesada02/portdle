import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import type { BlitzRun } from "../engine/types";
import { createPersist } from "../persist/storage";
import { missThree } from "../test/blitz";
import { createFakeRemote } from "../test/fake-remote";
import { loaded, memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

async function renderBlitz(
	options: { persist?: ReturnType<typeof createPersist> } = {},
) {
	stubMatchMedia();
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({
		initialEntries: ["/portdle/blitz"],
	});
	render(
		<App persist={persist} remote={createFakeRemote()} history={history} />,
	);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	return persist;
}

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
});

test("a finished run writes one run record with the played rounds, score zero included", async () => {
	const user = userEvent.setup();
	const persist = await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	const runs = persist.readBlitzRuns();
	expect(runs).toHaveLength(1);
	const run = runs[0];
	if (!run) {
		throw new Error("missing run");
	}
	expect(run.category).toBe("mixed");
	expect(run.orientation).toBe("default");
	expect(run.mode).toBe("sprint");
	expect(run.ended).toBe("lives");
	expect(run.score).toBe(0);
	expect(run.rounds).toHaveLength(3);
	expect(run.rounds.every((round) => round.outcome === "miss")).toBe(true);
});

function fakeRun(endedAt: string): BlitzRun {
	return {
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		ended: "timeout",
		endedAt,
		score: 0,
		rounds: [],
	};
}

test("a fifty-first run evicts the oldest", async () => {
	const persist = createPersist(memoryStore());
	const seeded = Array.from({ length: 50 }, (_, index) =>
		fakeRun(`seed-${index}`),
	);
	persist.writeBlitzRuns(seeded);
	const user = userEvent.setup();
	await renderBlitz({ persist });
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	const runs = persist.readBlitzRuns();
	expect(runs).toHaveLength(50);
	expect(runs[0]?.endedAt).not.toMatch(/^seed-/);
	expect(runs.some((run) => run.endedAt === "seed-49")).toBe(false);
	expect(runs.some((run) => run.endedAt === "seed-0")).toBe(true);
});
