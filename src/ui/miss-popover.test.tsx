import { createMemoryHistory } from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitForElementToBeRemoved,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import type { CatalogEntry } from "../engine/types";
import { createPersist } from "../persist/storage";
import { dailyOn, padToAnswer } from "../test/dailies";
import { createFakeRemote } from "../test/fake-remote";
import protocolsJson from "../test/fixtures/protocols.json";
import {
	loaded,
	memoryStore,
	portDigits,
	stubMatchMedia,
} from "../test/helpers";
import { App } from "./app";
import { MissPopover } from "./miss-popover";

const mixedAnswer = dailyOn("mixed");

// FTP's description and first source are read from the frozen fixture catalog
// rather than hardcoded, so this file does not need updating every time
// catalog content changes (see docs/superpowers/specs/2026-09-11-t43-content.md).
const protocols = protocolsJson as CatalogEntry[];
const ftp = protocols.find((entry) => entry.id === "ftp");
if (!ftp) {
	throw new Error("FTP fixture entry missing from protocols catalog");
}
const ftpDescription = ftp.description;
const ftpSource = ftp.sources?.[0];
if (!ftpSource) {
	throw new Error("FTP fixture entry has no source to test against");
}

async function renderDaily() {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	render(
		<App persist={persist} remote={createFakeRemote()} history={history} />,
	);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
}

async function missOn(user: ReturnType<typeof userEvent.setup>, port: number) {
	await user.type(portDigits(), padToAnswer(port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
}

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
	vi.useRealTimers();
});

test("a catalog miss with sources renders a tappable trigger, closed until opened", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	expect(screen.getByRole("button", { name: "FTP" })).toBeTruthy();
	expect(screen.queryByText(ftpDescription)).toBeNull();
});

test("hovering the trigger opens the popover with name, port, description, and a source anchor", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.mouseEnter(trigger);
	expect(screen.getByText("21")).toBeTruthy();
	expect(screen.getByText(ftpDescription)).toBeTruthy();
	const source = screen.getByRole("link", { name: ftpSource.label });
	expect(source.getAttribute("href")).toBe(ftpSource.url);
	expect(source.getAttribute("target")).toBe("_blank");
	expect(source.getAttribute("rel")).toBe("noreferrer");
});

test("moving the pointer from the trigger into the panel keeps it open", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.mouseEnter(trigger);
	const panelId = trigger.getAttribute("aria-controls");
	const panel = document.getElementById(panelId ?? "");
	fireEvent.mouseLeave(trigger);
	if (panel) {
		fireEvent.mouseEnter(panel);
	}
	expect(screen.getByText(ftpDescription)).toBeTruthy();
});

test("moving off and letting the grace timer elapse closes the popover", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	vi.useFakeTimers();
	fireEvent.mouseEnter(trigger);
	expect(screen.getByText(ftpDescription)).toBeTruthy();
	fireEvent.mouseLeave(trigger);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(150);
	});
	await act(async () => {
		await vi.advanceTimersByTimeAsync(80);
	});
	expect(screen.queryByText(ftpDescription)).toBeNull();
});

test("clicking the trigger toggles a pinned-open state that persists independent of hover", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.mouseEnter(trigger);
	fireEvent.click(trigger);
	vi.useFakeTimers();
	fireEvent.mouseLeave(trigger);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(150);
	});
	expect(screen.getByText(ftpDescription)).toBeTruthy();
	fireEvent.click(trigger);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(80);
	});
	expect(screen.queryByText(ftpDescription)).toBeNull();
});

test("focusing the trigger with the keyboard opens the popover and blur closes it", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.focus(trigger);
	expect(screen.getByText(ftpDescription)).toBeTruthy();
	fireEvent.blur(trigger);
	await waitForElementToBeRemoved(() => screen.queryByText(ftpDescription));
});

test("Escape closes an open popover", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.click(trigger);
	expect(screen.getByText(ftpDescription)).toBeTruthy();
	fireEvent.keyDown(window, { key: "Escape" });
	await waitForElementToBeRemoved(() => screen.queryByText(ftpDescription));
});

test("a pointer-down outside the trigger and panel closes it", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.click(trigger);
	expect(screen.getByText(ftpDescription)).toBeTruthy();
	fireEvent.pointerDown(document.body);
	await waitForElementToBeRemoved(() => screen.queryByText(ftpDescription));
});

test("an entry with no sources shows no sources block", () => {
	// Every fixture entry carries at least one source (t43), so this
	// exercises MissPopover directly with a fixture entry that has none,
	// rather than relying on the catalog to happen to have a sourceless row.
	const entryWithNoSources: CatalogEntry = {
		id: "test-fixture-no-sources",
		name: "Test Fixture",
		port: 1,
		transport: "tcp",
		description: "A fixture entry with no sources.",
		answerEligible: false,
	};
	render(<MissPopover entry={entryWithNoSources} placement="inline" />);
	const trigger = screen.getByRole("button", { name: "Test Fixture" });
	fireEvent.mouseEnter(trigger);
	expect(screen.getByText(entryWithNoSources.description)).toBeTruthy();
	const panelId = trigger.getAttribute("aria-controls");
	const panel = document.getElementById(panelId ?? "");
	expect(panel).not.toBeNull();
	if (panel) {
		expect(within(panel).queryByRole("link")).toBeNull();
	}
});

test("grid placement with a custom trigger drops focus-opens; Enter toggles it and Escape closes it", async () => {
	// No production caller uses placement="grid" or a custom trigger yet (a
	// future Codex ticket will, standing in for a card), so this exercises
	// both together directly with a fixture entry, per
	// docs/superpowers/specs/2026-09-12-t74-miss-popover-placement.md.
	const user = userEvent.setup();
	const entry: CatalogEntry = {
		id: "test-fixture-grid",
		name: "Grid Fixture",
		port: 2,
		transport: "tcp",
		description: "A fixture entry for the grid placement.",
		answerEligible: false,
	};
	render(
		<MissPopover
			entry={entry}
			placement="grid"
			trigger={(triggerProps) => (
				<button type="button" {...triggerProps}>
					Custom Trigger Button
				</button>
			)}
		/>,
	);
	stubMatchMedia();
	const trigger = screen.getByRole("button", { name: "Custom Trigger Button" });
	await user.tab();
	expect(document.activeElement).toBe(trigger);
	expect(screen.queryByText(entry.description)).toBeNull();
	await user.keyboard("{Enter}");
	expect(screen.getByText(entry.description)).toBeTruthy();
	await user.keyboard("{Escape}");
	await waitForElementToBeRemoved(() => screen.queryByText(entry.description));
});

test("a miss that matches nothing renders plain text with no trigger and no popover", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 1);
	expect(screen.getByText("Not in this catalog.")).toBeTruthy();
	expect(
		screen.queryByRole("button", { name: "Not in this catalog." }),
	).toBeNull();
});

test("reopening the popover while it's closing cancels the exit and keeps it shown", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.mouseEnter(trigger);
	expect(screen.getByText(ftpDescription)).toBeTruthy();
	fireEvent.keyDown(window, { key: "Escape" });
	fireEvent.mouseEnter(trigger);
	expect(screen.getByText(ftpDescription)).toBeTruthy();
});

test("under reduced motion, Escape removes the popover at once", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.click(trigger);
	expect(screen.getByText(ftpDescription)).toBeTruthy();
	stubMatchMedia(false, true);
	fireEvent.keyDown(window, { key: "Escape" });
	expect(screen.queryByText(ftpDescription)).toBeNull();
});
