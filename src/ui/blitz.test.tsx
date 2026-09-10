import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { applications, protocols } from "../catalogs/production";
import type { CatalogEntry } from "../engine/types";
import { createPersist } from "../persist/storage";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
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
	vi.useRealTimers();
});

test("setup shows Blitz heading category orientation mode and Start", async () => {
	await renderBlitz();
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();
	expect(screen.getByRole("radio", { name: "Mixed" }).tabIndex).not.toBe(-1);
	expect(screen.getByRole("radio", { name: "Sprint (1m)" }).tabIndex).not.toBe(
		-1,
	);
	expect(screen.getByRole("button", { name: "Start" }).tabIndex).not.toBe(-1);
	expect(
		(screen.getByRole("radio", { name: "Default" }) as HTMLInputElement)
			.checked,
	).toBe(true);
	expect(screen.getByRole("radio", { name: "Inverted" }).tabIndex).not.toBe(-1);
});

test("start mixed sprint shows a non-daily name lives score time and slots", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "Start" }));
	const heading = screen.getByRole("heading", { level: 1 }).textContent;
	expect(heading).not.toBe(dailyOn("mixed").name);
	expect(heading).not.toBe(dailyOn("protocols").name);
	expect(heading).not.toBe(dailyOn("applications").name);
	expect(heading).not.toBe("Blitz");
	expect(screen.getByText("Lives 3")).toBeTruthy();
	expect(screen.getByText("Score 0")).toBeTruthy();
	expect(screen.getByText("Time 60")).toBeTruthy();
	expect(portDigits()).toBeTruthy();
});

test("correct port increments score", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "Start" }));
	const answer = currentEntry();
	await user.type(portDigits(), padToAnswer(answer.port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Score 1")).toBeTruthy();
	expect(screen.getByText("Lives 3")).toBeTruthy();
});

test("catalog miss names the service spends a life and advances", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "Start" }));
	const first = currentEntry();
	const missPort = first.port === 80 ? 19 : 80;
	await user.type(portDigits(), padToAnswer(missPort, first));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Lives 2")).toBeTruthy();
	expect(screen.getByText(missPort === 80 ? "HTTP" : "chargen")).toBeTruthy();
	expect(screen.getByRole("heading", { level: 1 }).textContent).not.toBe(
		first.name,
	);
});

test("incomplete enter is invalid and does not spend a life", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "Start" }));
	await user.type(portDigits(), "1");
	await user.keyboard("{Enter}");
	expect(screen.getByText("Not a valid port.")).toBeTruthy();
	expect(screen.getByText("Lives 3")).toBeTruthy();
});

test("survival start shows no remaining time", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("radio", { name: "Survival" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	expect(screen.queryByText(/Time /)).toBeNull();
	expect(screen.getByText("Lives 3")).toBeTruthy();
});

test("sprint timer ends with Time's up", async () => {
	await renderBlitz();
	vi.useFakeTimers();
	fireEvent.click(screen.getByRole("button", { name: "Start" }));
	expect(screen.getByText("Time 60")).toBeTruthy();
	await vi.advanceTimersByTimeAsync(60_000);
	expect(screen.getByText("Time's up")).toBeTruthy();
	expect(screen.getByText("Score 0")).toBeTruthy();
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();
});

test("three misses end with Out of lives and write a new best", async () => {
	const user = userEvent.setup();
	const persist = await renderBlitz();
	await user.click(screen.getByRole("button", { name: "Start" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expect(screen.getByText(/HTTP|chargen/)).toBeTruthy();
	expect(persist.readBlitzBests()["mixed|default|sprint"]).toBe(0);
	expect(persist.readDaily("mixed", UTC_TODAY)).toBeNull();
});

test("play again returns to setup and a lower score does not lower best", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeBlitzBests({ "mixed|default|sprint": 5 });
	await renderBlitz({ persist });
	await user.click(screen.getByRole("button", { name: "Start" }));
	await missThree(user);
	expect(persist.readBlitzBests()["mixed|default|sprint"]).toBe(5);
	await user.click(screen.getByRole("button", { name: "Play again" }));
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
});

test("refresh during a run returns to setup without restoring score", async () => {
	const user = userEvent.setup();
	const persist = await renderBlitz();
	await user.click(screen.getByRole("button", { name: "Start" }));
	const answer = currentEntry();
	await user.type(portDigits(), padToAnswer(answer.port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Score 1")).toBeTruthy();
	cleanup();
	await renderBlitz({ persist });
	expect(screen.getByRole("heading", { level: 1, name: "Blitz" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
	expect(persist.readBlitzBests()).toEqual({});
});

function headingPort(): number {
	const text = screen.getByRole("heading", { level: 1 }).textContent ?? "";
	expect(text).toMatch(/^\d+$/);
	return Number(text);
}

async function startInverted(user: ReturnType<typeof userEvent.setup>) {
	await renderBlitz();
	await user.click(screen.getByRole("radio", { name: "Inverted" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
}

async function startInvertedFake() {
	const persist = await renderBlitz();
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
	expect(screen.getByText("Lives 3")).toBeTruthy();
	expect(screen.getByText("Score 0")).toBeTruthy();
	expect(screen.getByText("Time 60")).toBeTruthy();
	expect(screen.queryByRole("group", { name: "Port digits" })).toBeNull();
	expect(screen.getByRole("combobox", { name: "Service name" })).toBeTruthy();
});

test("empty inverted query lists nothing", async () => {
	const user = userEvent.setup();
	await startInverted(user);
	expect(screen.getByText("No matches.")).toBeTruthy();
	expect(screen.queryByRole("option")).toBeNull();
});

test("prefix lists a canonical name after debounce", async () => {
	await startInvertedFake();
	const box = screen.getByRole("combobox", { name: "Service name" });
	fireEvent.change(box, { target: { value: "htt" } });
	expect(screen.queryByRole("option", { name: "HTTP" })).toBeNull();
	await vi.advanceTimersByTimeAsync(200);
	expect(screen.getByRole("option", { name: "HTTP" })).toBeTruthy();
});

test("enter without a listed row does not spend a life", async () => {
	const user = userEvent.setup();
	await startInverted(user);
	screen.getByRole("combobox", { name: "Service name" }).focus();
	await user.keyboard("{Enter}");
	expect(screen.getByText("Lives 3")).toBeTruthy();
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
	expect(screen.getByText("Lives 2")).toBeTruthy();
});

const CROWDED_BLURBS: Record<number, string[]> = {
	3000: [
		"Legacy React starter",
		"React meta-framework",
		"Vue meta-framework",
		"Ruby web framework",
		"Metrics dashboards",
	],
	5173: ["Frontend bundler dev server", "Svelte app framework"],
	8080: [
		"Bundler dev server",
		"CI server",
		"Java servlet container",
		"Common alternate web port.",
	],
};

async function startInvertedUntil(ports: number[]) {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		cleanup();
		document.documentElement.classList.remove("dark");
		vi.useRealTimers();
		await renderBlitz();
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
	const crowdedPorts = Object.keys(CROWDED_BLURBS).map(Number);
	const port = await startInvertedUntil(
		catalog
			.filter(
				(entry) =>
					entry.answerEligible &&
					!entry.retired &&
					!crowdedPorts.includes(entry.port),
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
	const port = await startInvertedUntil(
		Object.keys(CROWDED_BLURBS).map(Number),
	);
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
	expect(persist.readBlitzBests()["mixed|inverted|sprint"]).toBe(0);
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
	render(<App persist={persist} history={history} utcToday={UTC_TODAY} />);
	await screen.findByRole("heading", { level: 1, name: "History" });
});
