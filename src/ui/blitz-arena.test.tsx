import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import type { BlitzRun } from "../engine/types";
import { createPersist } from "../persist/storage";
import { currentEntry, missThree } from "../test/blitz";
import { padToAnswer } from "../test/dailies";
import { createFakeRemote } from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	portDigits,
	stubMatchMedia,
	stubViewTransitions,
} from "../test/helpers";
import { App } from "./app";

async function renderBlitz(
	options: {
		persist?: ReturnType<typeof createPersist>;
		reducedMotion?: boolean;
	} = {},
) {
	stubMatchMedia(false, options.reducedMotion ?? false);
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

function fakeRun(overrides: Partial<BlitzRun> = {}): BlitzRun {
	return {
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		ended: "timeout",
		endedAt: "2026-09-09T12:00:00.000Z",
		score: 3,
		rounds: [
			{ id: "http", name: "HTTP", port: 80, outcome: "correct", wrong: null },
			{
				id: "chargen",
				name: "chargen",
				port: 19,
				outcome: "miss",
				wrong: { kind: "typed", port: 21, owner: null },
			},
		],
		...overrides,
	};
}

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
});

test("with no runs and no bests the arena shows the empty state and no Bests heading", async () => {
	await renderBlitz();
	expect(
		screen.getByText("No runs yet. Start one and it will show here."),
	).toBeTruthy();
	expect(screen.queryByRole("heading", { name: "Bests" })).toBeNull();
});

test("with bests seeded but no runs the empty state and Bests heading show together", async () => {
	const persist = createPersist(memoryStore());
	persist.writeBlitzBests({ "mixed|default|sprint": 4 });
	await renderBlitz({ persist });
	expect(
		screen.getByText("No runs yet. Start one and it will show here."),
	).toBeTruthy();
	expect(screen.getByRole("heading", { name: "Bests" })).toBeTruthy();
});

test("a seeded run and matching best: Last run shows its score and Sprint badge, Rounds discloses lines, Bests lists a Sprint row", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeBlitzRuns([fakeRun({ score: 3 })]);
	persist.writeBlitzBests({ "mixed|default|sprint": 5 });
	await renderBlitz({ persist });

	const lastRunHeading = screen.getByRole("heading", {
		level: 2,
		name: "Last run",
	});
	const lastRunSection = lastRunHeading.closest("section");
	if (!lastRunSection) {
		throw new Error("missing Last run section");
	}
	expect(within(lastRunSection).getByText("Score 3")).toBeTruthy();
	expect(within(lastRunSection).getByText("Sprint")).toBeTruthy();
	expect(within(lastRunSection).queryByText("Sprint (1m)")).toBeNull();

	await user.click(within(lastRunSection).getByText("Rounds (2)"));
	expect(within(lastRunSection).getAllByRole("listitem")).toHaveLength(2);

	const bestsHeading = screen.getByRole("heading", { level: 2, name: "Bests" });
	const bestsSection = bestsHeading.closest("section");
	if (!bestsSection) {
		throw new Error("missing Bests section");
	}
	expect(within(bestsSection).getByText("Score 5")).toBeTruthy();
	expect(within(bestsSection).getByText("Sprint")).toBeTruthy();
	expect(within(bestsSection).queryByText("Sprint (1m)")).toBeNull();
});

test("Bests ordering: the Mixed row renders before the Protocols row", async () => {
	const persist = createPersist(memoryStore());
	persist.writeBlitzBests({
		"protocols|default|sprint": 10,
		"mixed|inverted|survival": 20,
	});
	await renderBlitz({ persist });
	const rows = screen.getAllByRole("row");
	expect(rows).toHaveLength(2);
	const [first] = rows;
	if (!first) {
		throw new Error("missing Bests row");
	}
	expect(within(first).getByText("Mixed")).toBeTruthy();
});

test("finishing a run with a failing store and clicking Play again shows Progress may not save in the arena", async () => {
	const user = userEvent.setup();
	const data = new Map<string, string>();
	data.set("portdle:v1:howToSeen", JSON.stringify(true));
	const persist = createPersist({
		...memoryStore(data),
		setItem: () => {
			throw new Error("quota");
		},
	});
	await renderBlitz({ persist });
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	await user.click(screen.getByRole("button", { name: "Play again" }));
	const main = screen.getByRole("main");
	expect(within(main).getByRole("status").textContent).toBe(
		"Progress may not save.",
	);
});

test("New run opens a dialog named New run preselecting the seeded run's setup", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeBlitzRuns([
		fakeRun({
			category: "protocols",
			orientation: "inverted",
			mode: "survival",
		}),
	]);
	await renderBlitz({ persist });
	await user.click(screen.getByRole("button", { name: "New run" }));
	expect(screen.getByRole("dialog", { name: "New run" })).toBeTruthy();
	expect(
		(screen.getByRole("radio", { name: "Protocols" }) as HTMLInputElement)
			.checked,
	).toBe(true);
	expect(
		(screen.getByRole("radio", { name: "Inverted" }) as HTMLInputElement)
			.checked,
	).toBe(true);
	expect(
		(screen.getByRole("radio", { name: "Survival" }) as HTMLInputElement)
			.checked,
	).toBe(true);
});

test("clicking an orientation card's caption selects that orientation", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByText("See a port, pick the service."));
	expect(
		(screen.getByRole("radio", { name: "Inverted" }) as HTMLInputElement)
			.checked,
	).toBe(true);
});

test("New run preselects Mixed Default Sprint when there is no run", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	expect(
		(screen.getByRole("radio", { name: "Mixed" }) as HTMLInputElement).checked,
	).toBe(true);
	expect(
		(screen.getByRole("radio", { name: "Default" }) as HTMLInputElement)
			.checked,
	).toBe(true);
	expect(
		(screen.getByRole("radio", { name: "Sprint (1m)" }) as HTMLInputElement)
			.checked,
	).toBe(true);
});

test("Escape closes the dialog and returns focus to New run", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	const trigger = screen.getByRole("button", { name: "New run" });
	await user.click(trigger);
	expect(screen.getByRole("dialog", { name: "New run" })).toBeTruthy();
	await user.keyboard("{Escape}");
	expect(screen.queryByRole("dialog", { name: "New run" })).toBeNull();
	expect(document.activeElement).toBe(trigger);
});

test("a backdrop click closes the dialog and returns focus to New run", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	const trigger = screen.getByRole("button", { name: "New run" });
	await user.click(trigger);
	const dialog = screen.getByRole("dialog", { name: "New run" });
	await user.click(dialog);
	expect(screen.queryByRole("dialog", { name: "New run" })).toBeNull();
	expect(document.activeElement).toBe(trigger);
});

test("Cancel closes the dialog and returns focus to New run", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	const trigger = screen.getByRole("button", { name: "New run" });
	await user.click(trigger);
	await user.click(screen.getByRole("button", { name: "Cancel" }));
	expect(screen.queryByRole("dialog", { name: "New run" })).toBeNull();
	expect(document.activeElement).toBe(trigger);
});

test("Orientation shows both captions wired as each radio's accessible description", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	expect(screen.getByText("See a service, type its port.")).toBeTruthy();
	expect(screen.getByText("See a port, pick the service.")).toBeTruthy();
	const defaultRadio = screen.getByRole("radio", { name: "Default" });
	const invertedRadio = screen.getByRole("radio", { name: "Inverted" });
	const defaultDescribedBy = defaultRadio.getAttribute("aria-describedby");
	const invertedDescribedBy = invertedRadio.getAttribute("aria-describedby");
	expect(defaultDescribedBy).toBeTruthy();
	expect(invertedDescribedBy).toBeTruthy();
	expect(document.getElementById(defaultDescribedBy ?? "")?.textContent).toBe(
		"See a service, type its port.",
	);
	expect(document.getElementById(invertedDescribedBy ?? "")?.textContent).toBe(
		"See a port, pick the service.",
	);
});

test("Start begins a run with the HUD reading Round 1", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	expect(screen.queryByRole("dialog", { name: "New run" })).toBeNull();
	expect(screen.getByText("Round 1")).toBeTruthy();
});

test("Play again lands on the arena whose Last run shows the just-finished score", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const first = currentEntry();
	await user.type(portDigits(), padToAnswer(first.port, first));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	await user.click(screen.getByRole("button", { name: "Play again" }));
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();
	const lastRunHeading = screen.getByRole("heading", {
		level: 2,
		name: "Last run",
	});
	const lastRunSection = lastRunHeading.closest("section");
	if (!lastRunSection) {
		throw new Error("missing Last run section");
	}
	expect(within(lastRunSection).getByText("Score 1")).toBeTruthy();
});

test("starting a run from the arena starts a view transition with the phase type", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	const { calls, restore } = stubViewTransitions();
	try {
		await user.click(screen.getByRole("button", { name: "New run" }));
		await user.click(screen.getByRole("button", { name: "Start" }));
		expect(calls).toEqual([["phase"]]);
	} finally {
		restore();
	}
});

test("opening and closing the setup dialog starts no view transition", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	const { calls, restore } = stubViewTransitions();
	try {
		await user.click(screen.getByRole("button", { name: "New run" }));
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(calls).toEqual([]);
	} finally {
		restore();
	}
});

test("Play again starts a view transition with the phase type", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const first = currentEntry();
	await user.type(portDigits(), padToAnswer(first.port, first));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	const { calls, restore } = stubViewTransitions();
	try {
		await user.click(screen.getByRole("button", { name: "Play again" }));
		expect(calls).toEqual([["phase"]]);
	} finally {
		restore();
	}
});

test("with reduced motion stubbed to match, starting a run from the arena starts no view transition", async () => {
	const user = userEvent.setup();
	await renderBlitz({ reducedMotion: true });
	const { calls, restore } = stubViewTransitions();
	try {
		await user.click(screen.getByRole("button", { name: "New run" }));
		await user.click(screen.getByRole("button", { name: "Start" }));
		expect(screen.getByText("Round 1")).toBeTruthy();
		expect(calls).toEqual([]);
	} finally {
		restore();
	}
});

test("with reduced motion stubbed to match, Play again starts no view transition", async () => {
	const user = userEvent.setup();
	await renderBlitz({ reducedMotion: true });
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const first = currentEntry();
	await user.type(portDigits(), padToAnswer(first.port, first));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	const { calls, restore } = stubViewTransitions();
	try {
		await user.click(screen.getByRole("button", { name: "Play again" }));
		expect(
			screen.getByRole("heading", { level: 1, name: "Blitz" }),
		).toBeTruthy();
		expect(calls).toEqual([]);
	} finally {
		restore();
	}
});

async function endRunByLives(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
}

function tapBlitzNav(user: ReturnType<typeof userEvent.setup>) {
	return user.click(screen.getByRole("link", { name: "Blitz" }));
}

test("a nav tap on Blitz from the end card returns to the Arena with the phase motion", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await endRunByLives(user);
	const { calls, restore } = stubViewTransitions();
	try {
		await tapBlitzNav(user);
		expect(screen.getByRole("button", { name: "New run" })).toBeTruthy();
		expect(screen.queryByText("Out of lives")).toBeNull();
		expect(calls).toContainEqual(["phase"]);
	} finally {
		restore();
	}
});

test("a nav tap on Blitz returns to the Arena from every end card, not only the first", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await endRunByLives(user);
	await tapBlitzNav(user);
	expect(screen.getByRole("button", { name: "New run" })).toBeTruthy();
	await endRunByLives(user);
	await tapBlitzNav(user);
	expect(screen.getByRole("button", { name: "New run" })).toBeTruthy();
});

test("a nav tap on Blitz during a run changes nothing, even after the run ends", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const { calls, restore } = stubViewTransitions();
	try {
		await tapBlitzNav(user);
		expect(screen.getByText("Round 1")).toBeTruthy();
		expect(screen.getByText("Score 0")).toBeTruthy();
		expect(calls).not.toContainEqual(["phase"]);
	} finally {
		restore();
	}
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "New run" })).toBeNull();
});

test("a nav tap on Blitz at rest starts no phase transition", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	const { calls, restore } = stubViewTransitions();
	try {
		await tapBlitzNav(user);
		expect(screen.getByRole("button", { name: "New run" })).toBeTruthy();
		expect(calls).not.toContainEqual(["phase"]);
	} finally {
		restore();
	}
});
