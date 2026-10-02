import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, expect, test } from "vitest";
import type { CatalogEntry } from "../engine/types";
import { createPersist } from "../persist/storage";
import type { Catalog } from "../remote/remote";
import { UTC_TODAY } from "../test/dailies";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import { loaded, memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

afterEach(cleanup);

function entry(
	id: string,
	port: number,
	overrides: Partial<CatalogEntry> = {},
): CatalogEntry {
	return {
		id,
		name: id[0]?.toUpperCase() + id.slice(1),
		port,
		transport: "tcp",
		description: "d",
		answerEligible: true,
		...overrides,
	};
}

function remoteWith(catalog: Catalog): FakeRemote {
	const remote = createFakeRemote();
	remote.catalog = catalog;
	remote.today = UTC_TODAY;
	return remote;
}

async function open(
	path: string,
	remote: FakeRemote,
	persist = createPersist(memoryStore()),
) {
	stubMatchMedia();
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			remote={remote}
			history={createMemoryHistory({ initialEntries: [`/portdle${path}`] })}
			utcToday={UTC_TODAY}
		/>,
	);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	return persist;
}

test("Blitz's Play tab shows loading, then the failure line, and the Leaderboards tab stays", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	const release = remote.holdCatalog();
	remote.failCatalog = true;
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			remote={remote}
			history={createMemoryHistory({ initialEntries: ["/portdle/blitz"] })}
			utcToday={UTC_TODAY}
		/>,
	);
	expect(await screen.findByText("Loading...")).toBeTruthy();
	release();
	expect(await screen.findByText("Could not load puzzles.")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "New run" })).toBeNull();
	await user.click(screen.getByRole("tab", { name: "Leaderboards" }));
	expect(screen.queryByText("Could not load puzzles.")).toBeNull();
});

test("Blitz also waits for the current Dailies", async () => {
	const remote = createFakeRemote();
	remote.failDailies = true;
	await open("/blitz", remote);
	expect(screen.getByText("Could not load puzzles.")).toBeTruthy();
});

test("Blitz leaves out the three answers of the server's day", async () => {
	const user = userEvent.setup();
	const remote = remoteWith({
		protocols: [entry("p1", 1111), entry("p2", 2222), entry("p3", 3333)],
		applications: [entry("a1", 4444)],
	});
	remote.entryIds = { mixed: "p1", protocols: "p2", applications: "a1" };
	await open("/blitz", remote);
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	expect(screen.getByRole("heading", { level: 1, name: "P3" })).toBeTruthy();
});

test("a retired entry is never a Blitz prompt or an inverted pick", async () => {
	const user = userEvent.setup();
	const remote = remoteWith({
		protocols: [
			entry("alpha", 1111),
			entry("alpine", 2222, { retired: true }),
			entry("daily", 3333, { answerEligible: false }),
		],
		applications: [],
	});
	remote.entryIds = {
		mixed: "daily",
		protocols: "daily",
		applications: "daily",
	};
	await open("/blitz", remote);
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("radio", { name: "Inverted" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
	expect(screen.getByRole("heading", { level: 1, name: "1111" })).toBeTruthy();
	await user.type(
		screen.getByRole("combobox", { name: "Service name" }),
		"alp",
	);
	expect(await screen.findByRole("option", { name: "Alpha" })).toBeTruthy();
	expect(screen.queryByRole("option", { name: "Alpine" })).toBeNull();
});

test("a retired entry is never a miss identification on the Daily", async () => {
	const user = userEvent.setup();
	const remote = remoteWith({
		protocols: [
			entry("answer", 8080),
			entry("gone", 9090, { retired: true }),
			entry("live", 7070),
		],
		applications: [],
	});
	remote.entryIds = {
		mixed: "answer",
		protocols: "answer",
		applications: "answer",
	};
	await open("/", remote);
	await user.click(screen.getByRole("textbox", { name: "Digit 1 of 4" }));
	await user.keyboard("9090");
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Not in this catalog.")).toBeTruthy();
});

test("a Daily whose entry was retired after it was scheduled stays winnable", async () => {
	const user = userEvent.setup();
	const remote = remoteWith({
		protocols: [entry("answer", 8080, { retired: true })],
		applications: [],
	});
	remote.entryIds = {
		mixed: "answer",
		protocols: "answer",
		applications: "answer",
	};
	const persist = await open("/", remote);
	await user.click(screen.getByRole("textbox", { name: "Digit 1 of 4" }));
	await user.keyboard("8080");
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readDaily("mixed", UTC_TODAY)?.status).toBe("won");
});

test("the Codex needs only the catalog and hides unseen retired entries", async () => {
	const remote = remoteWith({
		protocols: [
			entry("live", 1111),
			entry("seen", 2222, { retired: true }),
			entry("gone", 3333, { retired: true }),
		],
		applications: [],
	});
	remote.failDailies = true;
	const persist = createPersist(memoryStore());
	persist.writeCodex({ seen: { state: "missed", fresh: false } });
	await open("/codex", remote, persist);
	expect(screen.getByText("Seen 1 / 2 · Correct 0")).toBeTruthy();
	expect(screen.getByText("Protocols 1 / 2")).toBeTruthy();
	expect(screen.getAllByRole("img", { name: "Unseen" })).toHaveLength(1);
	expect(screen.getByText("Seen")).toBeTruthy();
});

test("the Codex shows the failure line, and leaves the stored Codex alone, when the catalog fails", async () => {
	const remote = createFakeRemote();
	remote.failCatalog = true;
	const persist = createPersist(memoryStore());
	persist.writeCodex({ http: { state: "identified", fresh: true } });
	await open("/codex", remote, persist);
	expect(screen.getByText("Could not load puzzles.")).toBeTruthy();
	expect(persist.readCodex()).toEqual({
		http: { state: "identified", fresh: true },
	});
});

test("the store loads each read once under StrictMode's double effect", async () => {
	const remote = createFakeRemote();
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	render(
		<StrictMode>
			<App
				persist={persist}
				remote={remote}
				history={createMemoryHistory({ initialEntries: ["/portdle/"] })}
				utcToday={UTC_TODAY}
			/>
		</StrictMode>,
	);
	await loaded();
	expect(remote.catalogCalls).toBe(1);
	expect(remote.dailiesCalls).toBe(1);
});
