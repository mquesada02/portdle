import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { createPersist } from "../persist/storage";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
import { createFakeRemote } from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	portDigits,
	stubMatchMedia,
} from "../test/helpers";
import { App } from "./app";

// Fixture: dailyOn("mixed") on UTC_TODAY is Nuxt, port 3000. A miss on port
// 80 ("0080" against "3000") gives present, placed, absent, placed, worked
// out by hand against the two-pass rule and cross-checked with computeMarks.
const mixedAnswer = dailyOn("mixed");

async function renderDaily() {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	render(
		<App
			persist={persist}
			remote={createFakeRemote()}
			history={history}
			utcToday={UTC_TODAY}
		/>,
	);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	return persist;
}

async function commitGuess(
	user: ReturnType<typeof userEvent.setup>,
	port: number,
) {
	await user.type(portDigits(), padToAnswer(port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
}

// The tracker strip's aggregate for a digit can render the same accessible
// text as one of the tiles that produced it (e.g. a row's own "0, placed"
// tile and the tracker's aggregated "0, placed" chip). Scope tile
// assertions to elements outside the tracker strip's fieldset so the two
// don't get confused for each other.
function tileMarks(name: string): HTMLElement[] {
	const tracker = screen.getByRole("group", { name: "Tracker strip" });
	return screen
		.getAllByRole("img", { name })
		.filter((element) => !tracker.contains(element));
}

afterEach(() => {
	cleanup();
});

test("a committed miss row's tiles expose the expected digit, mark accessible text", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await commitGuess(user, 80);

	expect(tileMarks("0, present")).toHaveLength(1);
	expect(tileMarks("0, placed")).toHaveLength(2);
	expect(tileMarks("8, absent")).toHaveLength(1);
});

test("the tracker strip shows the expected state per digit after two committed rows", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await commitGuess(user, 80);
	await commitGuess(user, 19);

	const tracker = screen.getByRole("group", { name: "Tracker strip" });
	const hasTrackerMark = (name: string) =>
		screen.getAllByRole("img", { name }).some((el) => tracker.contains(el));

	expect(hasTrackerMark("0, placed")).toBe(true);
	expect(hasTrackerMark("1, absent")).toBe(true);
	expect(hasTrackerMark("8, absent")).toBe(true);
	expect(hasTrackerMark("9, absent")).toBe(true);
	for (const digit of ["2", "3", "4", "5", "6", "7"]) {
		expect(hasTrackerMark(`${digit}, unknown`)).toBe(true);
	}
});

test("the tracker strip is absent after a win", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await commitGuess(user, mixedAnswer.port);

	expect(screen.queryByRole("group", { name: "Tracker strip" })).toBeNull();
});

test("the tracker strip is absent after a loss", async () => {
	const user = userEvent.setup();
	await renderDaily();
	for (const port of [80, 19, 23, 1, 2, 3]) {
		await commitGuess(user, port);
	}

	expect(screen.queryByRole("group", { name: "Tracker strip" })).toBeNull();
});
