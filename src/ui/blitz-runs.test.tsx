import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { applications, protocols } from "../catalogs/production";
import type { BlitzRun, CatalogEntry } from "../engine/types";
import { createPersist } from "../persist/storage";
import { padToAnswer, UTC_TODAY } from "../test/dailies";
import { memoryStore, portDigits, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

const catalog = [...protocols, ...applications];

function currentEntry(): CatalogEntry {
	const name = screen.getByRole("heading", { level: 1 }).textContent;
	const entry = catalog.find((candidate) => candidate.name === name);
	if (!entry) {
		throw new Error(`missing entry ${name}`);
	}
	return entry;
}

async function renderBlitz(
	options: { persist?: ReturnType<typeof createPersist> } = {},
) {
	stubMatchMedia();
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({
		initialEntries: ["/portdle/blitz"],
	});
	render(<App persist={persist} history={history} utcToday={UTC_TODAY} />);
	await screen.findByRole("navigation", { name: "Main" });
	return persist;
}

async function missThree(user: ReturnType<typeof userEvent.setup>) {
	for (let i = 0; i < 3; i += 1) {
		const answer = currentEntry();
		const missPort = answer.port === 80 ? 19 : 80;
		await user.clear(portDigits());
		await user.type(portDigits(), padToAnswer(missPort, answer));
		await user.click(screen.getByRole("button", { name: "Submit" }));
	}
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
