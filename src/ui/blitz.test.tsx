import { createMemoryHistory } from "@tanstack/react-router";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { createPersist } from "../persist/storage";
import { catalog, currentEntry, missThree } from "../test/blitz";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
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

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
	vi.useRealTimers();
});

test("start mixed sprint shows a non-daily name lives score time and slots", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const heading = screen.getByRole("heading", { level: 1 }).textContent;
	expect(heading).not.toBe(dailyOn("mixed").name);
	expect(heading).not.toBe(dailyOn("protocols").name);
	expect(heading).not.toBe(dailyOn("applications").name);
	expect(heading).not.toBe("Blitz");
	expect(screen.getByRole("img", { name: "Lives: 3" })).toBeTruthy();
	expect(screen.getByText("Score 0")).toBeTruthy();
	expect(screen.getByText("1:00")).toBeTruthy();
	expect(portDigits()).toBeTruthy();
});

test("correct port increments score", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const answer = currentEntry();
	await user.type(portDigits(), padToAnswer(answer.port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Score 1")).toBeTruthy();
	expect(screen.getByRole("img", { name: "Lives: 3" })).toBeTruthy();
});

test("HUD reads Round 1 at start and Round 3 after two committed rounds", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	expect(screen.getByText("Round 1")).toBeTruthy();
	const first = currentEntry();
	await user.type(portDigits(), padToAnswer(first.port, first));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Round 2")).toBeTruthy();
	const second = currentEntry();
	const missPort = second.port === 80 ? 19 : 80;
	await user.type(portDigits(), padToAnswer(missPort, second));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Round 3")).toBeTruthy();
});

test("catalog miss names the service spends a life and advances", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const first = currentEntry();
	const missPort = first.port === 80 ? 19 : 80;
	await user.type(portDigits(), padToAnswer(missPort, first));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByRole("img", { name: "Lives: 2" })).toBeTruthy();
	const heading = screen.getByRole("heading", { level: 1 });
	expect(heading.textContent).not.toBe(first.name);
	const identifiedName = missPort === 80 ? "HTTP" : "chargen";
	const identifiedMatches = screen
		.getAllByText(identifiedName)
		.filter((element) => element !== heading);
	expect(identifiedMatches.length).toBeGreaterThan(0);
});

test("round log miss line reads you typed port and name for an owned port", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const first = currentEntry();
	const missPort = first.port === 80 ? 19 : 80;
	await user.type(portDigits(), padToAnswer(missPort, first));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	const identifiedName = missPort === 80 ? "HTTP" : "chargen";
	const lines = screen.getAllByRole("listitem");
	expect(lines).toHaveLength(1);
	const line = lines[0];
	if (!line) {
		throw new Error("missing round log line");
	}
	expect(within(line).getByRole("img", { name: "miss" })).toBeTruthy();
	expect(line.textContent).toContain(first.name);
	expect(line.textContent).toContain(
		`you typed ${missPort} (${identifiedName})`,
	);
});

test("round log shows two lines newest first with correct and unowned miss copy", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const first = currentEntry();
	await user.type(portDigits(), padToAnswer(first.port, first));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	const second = currentEntry();
	await user.type(portDigits(), "0".repeat(String(second.port).length));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	const lines = screen.getAllByRole("listitem");
	expect(lines).toHaveLength(2);
	const [newest, oldest] = lines;
	if (!newest || !oldest) {
		throw new Error("missing round log lines");
	}
	expect(within(newest).getByRole("img", { name: "miss" })).toBeTruthy();
	expect(newest.textContent).toContain(second.name);
	expect(newest.textContent).toContain("you typed 0");
	expect(newest.textContent).not.toContain("(");
	expect(within(oldest).getByRole("img", { name: "correct" })).toBeTruthy();
	expect(oldest.textContent).toContain(first.name);
});

test("round log keeps only the last three rounds after four", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	for (let i = 0; i < 4; i += 1) {
		const answer = currentEntry();
		await user.type(portDigits(), padToAnswer(answer.port, answer));
		await user.click(screen.getByRole("button", { name: "Submit" }));
	}
	expect(screen.getAllByRole("listitem")).toHaveLength(3);
});

test("invalid guess leaves the round log unchanged", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const first = currentEntry();
	await user.type(portDigits(), padToAnswer(first.port, first));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByRole("listitem")).toHaveLength(1);
	await user.type(portDigits(), "1");
	await user.keyboard("{Enter}");
	expect(screen.getByText("Not a valid port.")).toBeTruthy();
	expect(screen.getAllByRole("listitem")).toHaveLength(1);
});

test("incomplete enter is invalid and does not spend a life", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	await user.type(portDigits(), "1");
	await user.keyboard("{Enter}");
	expect(screen.getByText("Not a valid port.")).toBeTruthy();
	expect(screen.getByRole("img", { name: "Lives: 3" })).toBeTruthy();
});

test("survival start shows no remaining time", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("radio", { name: "Survival" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	expect(screen.queryByText(/^\d+:\d{2}$/)).toBeNull();
	expect(screen.getByRole("img", { name: "Lives: 3" })).toBeTruthy();
});

test("sprint timer ends with Time's up", async () => {
	await renderBlitz();
	vi.useFakeTimers();
	fireEvent.click(screen.getByRole("button", { name: "New run" }));
	fireEvent.click(screen.getByRole("button", { name: "Start" }));
	expect(screen.getByText("1:00")).toBeTruthy();
	await vi.advanceTimersByTimeAsync(60_000);
	expect(screen.getByText("Time's up")).toBeTruthy();
	expect(screen.getByText("Score 0")).toBeTruthy();
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();
});

test("letting the clock run out starts one view transition with the phase type", async () => {
	await renderBlitz();
	vi.useFakeTimers();
	fireEvent.click(screen.getByRole("button", { name: "New run" }));
	fireEvent.click(screen.getByRole("button", { name: "Start" }));
	const { calls, restore } = stubViewTransitions();
	try {
		await vi.advanceTimersByTimeAsync(60_000);
		expect(screen.getByText("Time's up")).toBeTruthy();
		expect(calls).toEqual([["phase"]]);
		await vi.advanceTimersByTimeAsync(500);
		expect(calls).toEqual([["phase"]]);
	} finally {
		restore();
	}
});

test("with reduced motion stubbed to match, letting the clock run out starts no view transition", async () => {
	await renderBlitz({ reducedMotion: true });
	vi.useFakeTimers();
	fireEvent.click(screen.getByRole("button", { name: "New run" }));
	fireEvent.click(screen.getByRole("button", { name: "Start" }));
	const { calls, restore } = stubViewTransitions();
	try {
		await vi.advanceTimersByTimeAsync(60_000);
		expect(screen.getByText("Time's up")).toBeTruthy();
		expect(calls).toEqual([]);
	} finally {
		restore();
	}
});

test("three misses end with Out of lives and write a new best", async () => {
	const user = userEvent.setup();
	const persist = await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expect(screen.getAllByText(/HTTP|chargen/).length).toBeGreaterThan(0);
	expect(persist.readBlitzBests()["mixed|default|sprint"]?.score).toBe(0);
	expect(persist.readDaily("mixed", UTC_TODAY)).toBeNull();
});

test("spending the last life starts one view transition with the phase type; earlier misses that leave lives start none", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const { calls, restore } = stubViewTransitions();
	try {
		await missThree(user);
		expect(screen.getByText("Out of lives")).toBeTruthy();
		expect(calls).toEqual([["phase"]]);
	} finally {
		restore();
	}
});

test("with reduced motion stubbed to match, spending the last life starts no view transition", async () => {
	const user = userEvent.setup();
	await renderBlitz({ reducedMotion: true });
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const { calls, restore } = stubViewTransitions();
	try {
		await missThree(user);
		expect(screen.getByText("Out of lives")).toBeTruthy();
		expect(calls).toEqual([]);
	} finally {
		restore();
	}
});

test("end card lists Rounds heading with every round line in play order", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const first = currentEntry();
	await user.type(portDigits(), padToAnswer(first.port, first));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expect(
		screen.getByRole("heading", { level: 2, name: "Rounds (4)" }),
	).toBeTruthy();
	const lines = screen.getAllByRole("listitem");
	expect(lines).toHaveLength(4);
	const [oldest, ...misses] = lines;
	if (!oldest) {
		throw new Error("missing round log line");
	}
	expect(within(oldest).getByRole("img", { name: "correct" })).toBeTruthy();
	expect(oldest.textContent).toContain(first.name);
	for (const line of misses) {
		expect(within(line).getByRole("img", { name: "miss" })).toBeTruthy();
	}
});

test("play again returns to arena and a lower score does not lower best", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeBlitzBests({ "mixed|default|sprint": 5 });
	await renderBlitz({ persist });
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	await missThree(user);
	expect(persist.readBlitzBests()["mixed|default|sprint"]?.score).toBe(5);
	expect(screen.queryByText("New best")).toBeNull();
	await user.click(screen.getByRole("button", { name: "Play again" }));
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "New run" })).toBeTruthy();
});

test("run beating a stored best shows New best on the end card", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeBlitzBests({ "mixed|default|sprint": 0 });
	await renderBlitz({ persist });
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const answer = currentEntry();
	await user.type(portDigits(), padToAnswer(answer.port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Score 1")).toBeTruthy();
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expect(screen.getByText("New best")).toBeTruthy();
	expect(persist.readBlitzBests()["mixed|default|sprint"]?.score).toBe(1);
});

test("refresh during a run returns to arena without restoring score", async () => {
	const user = userEvent.setup();
	const persist = await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const answer = currentEntry();
	await user.type(portDigits(), padToAnswer(answer.port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Score 1")).toBeTruthy();
	cleanup();
	await renderBlitz({ persist });
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "New run" })).toBeTruthy();
	expect(persist.readBlitzBests()).toEqual({});
});

function headingPort(): number {
	const text = screen.getByRole("heading", { level: 1 }).textContent ?? "";
	expect(text).toMatch(/^\d+$/);
	return Number(text);
}

async function startInverted(user: ReturnType<typeof userEvent.setup>) {
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("radio", { name: "Inverted" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
}

async function startInvertedFake() {
	const persist = await renderBlitz();
	fireEvent.click(screen.getByRole("button", { name: "New run" }));
	fireEvent.click(screen.getByRole("radio", { name: "Inverted" }));
	vi.useFakeTimers();
	fireEvent.click(screen.getByRole("button", { name: "Start" }));
	return persist;
}

async function pickListed(name: string) {
	const box = screen.getByRole("combobox", { name: "Service name" });
	fireEvent.change(box, { target: { value: name.slice(0, 3).toLowerCase() } });
	await vi.advanceTimersByTimeAsync(200);
	fireEvent.click(screen.getByRole("option", { name }));
}

test("inverted start shows port lives score time and search not slots", async () => {
	const user = userEvent.setup();
	await startInverted(user);
	expect(headingPort()).toBeGreaterThanOrEqual(0);
	expect(screen.getByRole("heading", { level: 1 }).textContent).not.toBe(
		"Blitz",
	);
	expect(screen.getByRole("img", { name: "Lives: 3" })).toBeTruthy();
	expect(screen.getByText("Score 0")).toBeTruthy();
	expect(screen.getByText("1:00")).toBeTruthy();
	expect(screen.queryByRole("group", { name: "Port digits" })).toBeNull();
	expect(screen.getByRole("combobox", { name: "Service name" })).toBeTruthy();
});

test("empty inverted query lists nothing", async () => {
	const user = userEvent.setup();
	await startInverted(user);
	expect(screen.queryByText("No matches.")).toBeNull();
	expect(screen.queryByRole("option")).toBeNull();
});

test("non-empty inverted query with no hits shows No matches", async () => {
	const user = userEvent.setup();
	await startInverted(user);
	await user.type(
		screen.getByRole("combobox", { name: "Service name" }),
		"zzzzznotaservice",
	);
	expect(await screen.findByText("No matches.")).toBeTruthy();
	expect(screen.queryByRole("option")).toBeNull();
});

test("fuzzy fragment lists a canonical name after debounce", async () => {
	await startInvertedFake();
	const box = screen.getByRole("combobox", { name: "Service name" });
	fireEvent.change(box, { target: { value: "ttp" } });
	expect(screen.queryByRole("option", { name: "HTTP" })).toBeNull();
	await vi.advanceTimersByTimeAsync(200);
	expect(screen.getByRole("option", { name: "HTTP" })).toBeTruthy();
});

test("enter without a listed row does not spend a life", async () => {
	const user = userEvent.setup();
	await startInverted(user);
	screen.getByRole("combobox", { name: "Service name" }).focus();
	await user.keyboard("{Enter}");
	expect(screen.getByRole("img", { name: "Lives: 3" })).toBeTruthy();
});

test("listed miss shows name is port and spends a life", async () => {
	await startInvertedFake();
	const port = headingPort();
	const miss = catalog.find(
		(entry) => entry.name === "HTTP" && entry.port !== port,
	);
	const pick = miss ?? catalog.find((entry) => entry.port !== port);
	if (!pick) {
		throw new Error("missing miss row");
	}
	await pickListed(pick.name);
	expect(screen.getByText(`${pick.name} is ${pick.port}`)).toBeTruthy();
	expect(screen.getByRole("img", { name: "Lives: 2" })).toBeTruthy();
});

test("inverted round log miss line reads you picked name", async () => {
	await startInvertedFake();
	const port = headingPort();
	const miss = catalog.find(
		(entry) => entry.name === "HTTP" && entry.port !== port,
	);
	const pick = miss ?? catalog.find((entry) => entry.port !== port);
	if (!pick) {
		throw new Error("missing miss row");
	}
	await pickListed(pick.name);
	const lines = screen.getAllByRole("listitem");
	expect(lines).toHaveLength(1);
	const line = lines[0];
	if (!line) {
		throw new Error("missing round log line");
	}
	expect(within(line).getByRole("img", { name: "miss" })).toBeTruthy();
	expect(line.textContent).toContain(`you picked ${pick.name}`);
});

const CROWDED_BLURBS: Record<number, string[]> = {
	3000: [
		"Legacy React starter",
		"React meta-framework",
		"Vue meta-framework",
		"Ruby web framework",
		"Metrics dashboards",
	],
	5173: [
		"Frontend bundler dev server",
		"Full-stack app framework built on Vite",
	],
	8080: [
		"Bundler dev server",
		"CI server",
		"Java servlet container",
		"Common alternate web port.",
	],
};

const CROWDED_PORTS = Object.keys(CROWDED_BLURBS).map(Number);

async function startInvertedUntil(ports: number[]) {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		cleanup();
		document.documentElement.classList.remove("dark");
		vi.useRealTimers();
		await renderBlitz();
		fireEvent.click(screen.getByRole("button", { name: "New run" }));
		fireEvent.click(screen.getByRole("radio", { name: "Inverted" }));
		vi.useFakeTimers();
		fireEvent.click(screen.getByRole("button", { name: "Start" }));
		const port = headingPort();
		if (ports.includes(port)) {
			return port;
		}
	}
	throw new Error(`no heading in ${ports.join(",")}`);
}

test("unique inverted heading shows the port number only", async () => {
	const port = await startInvertedUntil(
		catalog
			.filter(
				(entry) =>
					entry.answerEligible &&
					!entry.retired &&
					!CROWDED_PORTS.includes(entry.port),
			)
			.map((entry) => entry.port),
	);
	expect(
		screen.getByRole("heading", { level: 1, name: String(port) }),
	).toBeTruthy();
	for (const blurb of Object.values(CROWDED_BLURBS).flat()) {
		expect(screen.queryByText(blurb)).toBeNull();
	}
});

test("crowded inverted heading shows that port's blurb", async () => {
	const port = await startInvertedUntil(CROWDED_PORTS);
	const blurbs = CROWDED_BLURBS[port];
	if (!blurbs) {
		throw new Error("missing blurbs");
	}
	expect(blurbs.some((blurb) => screen.queryByText(blurb))).toBe(true);
});

test("inverted finish writes inverted best not default or daily", async () => {
	const persist = await startInvertedFake();
	for (let i = 0; i < 3; i += 1) {
		const port = headingPort();
		const pick =
			catalog.find((entry) => entry.name === "HTTP" && entry.port !== port) ??
			catalog.find((entry) => entry.port !== port);
		if (!pick) {
			throw new Error("missing miss row");
		}
		await pickListed(pick.name);
	}
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expect(persist.readBlitzBests()["mixed|inverted|sprint"]?.score).toBe(0);
	expect(persist.readBlitzBests()["mixed|default|sprint"]).toBeUndefined();
	expect(persist.readDaily("mixed", UTC_TODAY)).toBeNull();
});

test("history still has heading History", async () => {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({
		initialEntries: ["/portdle/history"],
	});
	render(
		<App persist={persist} remote={createFakeRemote()} history={history} />,
	);
	await screen.findByRole("heading", { level: 1, name: "History" });
});

test("a correct Blitz round records the prompt as Correct in the codex store", async () => {
	const user = userEvent.setup();
	const persist = await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const answer = currentEntry();
	await user.type(portDigits(), padToAnswer(answer.port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readCodex()[answer.id]).toEqual({
		state: "correct",
		fresh: true,
	});
});

test("a Default miss on a known port records the prompt as Missed and the port's owner as Identified", async () => {
	const user = userEvent.setup();
	const persist = await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const answer = currentEntry();
	const missPort = answer.port === 80 ? 19 : 80;
	await user.type(portDigits(), padToAnswer(missPort, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readCodex()[answer.id]).toEqual({
		state: "missed",
		fresh: true,
	});
	const ownerId = missPort === 80 ? "http" : "chargen";
	expect(persist.readCodex()[ownerId]).toEqual({
		state: "identified",
		fresh: true,
	});
});

test("a Default miss on an unowned port records the prompt as Missed and nothing else", async () => {
	const user = userEvent.setup();
	const persist = await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const answer = currentEntry();
	await user.type(portDigits(), padToAnswer(1, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readCodex()).toEqual({
		[answer.id]: { state: "missed", fresh: true },
	});
});

test("a mid-run miss writes the codex before the run ends", async () => {
	const user = userEvent.setup();
	const persist = await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const answer = currentEntry();
	const missPort = answer.port === 80 ? 19 : 80;
	await user.type(portDigits(), padToAnswer(missPort, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByRole("img", { name: "Lives: 2" })).toBeTruthy();
	expect(persist.readCodex()[answer.id]).toEqual({
		state: "missed",
		fresh: true,
	});
});

test("an invalid Blitz guess leaves the codex store unchanged", async () => {
	const user = userEvent.setup();
	const persist = await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	await user.type(portDigits(), "1");
	await user.keyboard("{Enter}");
	expect(screen.getByText("Not a valid port.")).toBeTruthy();
	expect(persist.readCodex()).toEqual({});
});

test("a timeout mid-prompt leaves the codex store unchanged", async () => {
	const persist = await renderBlitz();
	vi.useFakeTimers();
	fireEvent.click(screen.getByRole("button", { name: "New run" }));
	fireEvent.click(screen.getByRole("button", { name: "Start" }));
	await vi.advanceTimersByTimeAsync(60_000);
	expect(screen.getByText("Time's up")).toBeTruthy();
	expect(persist.readCodex()).toEqual({});
});

test("visiting History leaves the codex store unchanged", async () => {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	persist.writeCodex({ http: { state: "correct", fresh: false } });
	const history = createMemoryHistory({
		initialEntries: ["/portdle/history"],
	});
	render(
		<App persist={persist} remote={createFakeRemote()} history={history} />,
	);
	await screen.findByRole("heading", { level: 1, name: "History" });
	expect(persist.readCodex()).toEqual({
		http: { state: "correct", fresh: false },
	});
});

async function startInvertedWhere(matches: (port: number) => boolean) {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		cleanup();
		document.documentElement.classList.remove("dark");
		vi.useRealTimers();
		const persist = await renderBlitz();
		fireEvent.click(screen.getByRole("button", { name: "New run" }));
		fireEvent.click(screen.getByRole("radio", { name: "Inverted" }));
		vi.useFakeTimers();
		fireEvent.click(screen.getByRole("button", { name: "Start" }));
		const port = headingPort();
		if (matches(port)) {
			return { persist, port };
		}
	}
	throw new Error("no matching heading found");
}

test("an Inverted miss on a unique port records the prompt as Missed and the pick as Identified", async () => {
	const { persist, port } = await startInvertedWhere(
		(candidate) => !CROWDED_PORTS.includes(candidate),
	);
	const promptEntry = catalog.find(
		(entry) => entry.port === port && entry.answerEligible && !entry.retired,
	);
	if (!promptEntry) {
		throw new Error("missing prompt entry");
	}
	const pick =
		catalog.find((entry) => entry.name === "HTTP" && entry.port !== port) ??
		catalog.find((entry) => entry.port !== port);
	if (!pick) {
		throw new Error("missing miss row");
	}
	await pickListed(pick.name);
	expect(persist.readCodex()[promptEntry.id]).toEqual({
		state: "missed",
		fresh: true,
	});
	expect(persist.readCodex()[pick.id]).toEqual({
		state: "identified",
		fresh: true,
	});
});

async function startInvertedSamePortMiss() {
	// The dealt prompt among a crowded port's entries is not directly
	// observable from the UI (Inverted shows only the port). A fixed
	// same-port candidate is picked each attempt; if it happens to be the
	// actual prompt (a real "correct" outcome, not a miss), the whole attempt
	// is redone from a fresh run rather than picked again mid-round, since a
	// correct guess advances to a new, possibly non-crowded, prompt.
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const { persist, port } = await startInvertedWhere((candidate) =>
			CROWDED_PORTS.includes(candidate),
		);
		const samePortPick = catalog.find((entry) => entry.port === port);
		if (!samePortPick) {
			throw new Error("missing same-port pick candidate");
		}
		await pickListed(samePortPick.name);
		if (screen.queryByText("Wrong service, same port.")) {
			return { persist, port, samePortPick };
		}
	}
	throw new Error("could not produce a same-port miss");
}

test("a same-port Inverted pick records the prompt as Missed and the pick as Identified", async () => {
	const { persist, port, samePortPick } = await startInvertedSamePortMiss();
	expect(persist.readCodex()[samePortPick.id]).toEqual({
		state: "identified",
		fresh: true,
	});
	const missedSiblings = catalog.filter((entry) => {
		if (entry.port !== port || entry.id === samePortPick.id) {
			return false;
		}
		const record = persist.readCodex()[entry.id];
		return record?.state === "missed" && record.fresh === true;
	});
	expect(missedSiblings.length).toBe(1);
});
