import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { applications, protocols } from "../catalogs/production";
import type { CatalogEntry } from "../engine/types";
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

test("genuine first run shows Best n and New best when the score is above zero", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	const answer = currentEntry();
	await user.type(portDigits(), padToAnswer(answer.port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Score 1")).toBeTruthy();
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expect(screen.getByText("Best 1")).toBeTruthy();
	expect(screen.getByText("New best")).toBeTruthy();
});

test("zero-score first run shows Best 0 and no New best badge", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expect(screen.getByText("Score 0")).toBeTruthy();
	expect(screen.getByText("Best 0")).toBeTruthy();
	expect(screen.queryByText("New best")).toBeNull();
});

test("a lower second run keeps the higher stored best and shows no badge", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeBlitzBests({ "mixed|default|sprint": 5 });
	await renderBlitz({ persist });
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	await missThree(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expect(screen.getByText("Score 0")).toBeTruthy();
	expect(screen.getByText("Best 5")).toBeTruthy();
	expect(screen.queryByText("New best")).toBeNull();
});
