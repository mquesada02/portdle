import { createMemoryHistory } from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { createPersist } from "../persist/storage";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
import { memoryStore, portDigits, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

const mixedAnswer = dailyOn("mixed");

async function renderDaily() {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	render(<App persist={persist} history={history} utcToday={UTC_TODAY} />);
	await screen.findByRole("navigation", { name: "Main" });
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
	expect(screen.queryByText("File Transfer Protocol.")).toBeNull();
});

test("hovering the trigger opens the popover with name, port, description, and a source anchor", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.mouseEnter(trigger);
	expect(screen.getByText("21")).toBeTruthy();
	expect(screen.getByText("File Transfer Protocol.")).toBeTruthy();
	const source = screen.getByRole("link", { name: "RFC 959" });
	expect(source.getAttribute("href")).toBe(
		"https://www.rfc-editor.org/rfc/rfc959",
	);
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
	expect(screen.getByText("File Transfer Protocol.")).toBeTruthy();
});

test("moving off and letting the grace timer elapse closes the popover", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	vi.useFakeTimers();
	fireEvent.mouseEnter(trigger);
	expect(screen.getByText("File Transfer Protocol.")).toBeTruthy();
	fireEvent.mouseLeave(trigger);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(150);
	});
	expect(screen.queryByText("File Transfer Protocol.")).toBeNull();
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
	expect(screen.getByText("File Transfer Protocol.")).toBeTruthy();
	fireEvent.click(trigger);
	expect(screen.queryByText("File Transfer Protocol.")).toBeNull();
});

test("focusing the trigger with the keyboard opens the popover and blur closes it", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.focus(trigger);
	expect(screen.getByText("File Transfer Protocol.")).toBeTruthy();
	fireEvent.blur(trigger);
	expect(screen.queryByText("File Transfer Protocol.")).toBeNull();
});

test("Escape closes an open popover", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.click(trigger);
	expect(screen.getByText("File Transfer Protocol.")).toBeTruthy();
	fireEvent.keyDown(window, { key: "Escape" });
	expect(screen.queryByText("File Transfer Protocol.")).toBeNull();
});

test("a pointer-down outside the trigger and panel closes it", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 21);
	const trigger = screen.getByRole("button", { name: "FTP" });
	fireEvent.click(trigger);
	expect(screen.getByText("File Transfer Protocol.")).toBeTruthy();
	fireEvent.pointerDown(document.body);
	expect(screen.queryByText("File Transfer Protocol.")).toBeNull();
});

test("an entry with no sources shows no sources block", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await missOn(user, 80);
	const trigger = screen.getByRole("button", { name: "HTTP" });
	fireEvent.mouseEnter(trigger);
	expect(screen.getByText("Hypertext Transfer Protocol.")).toBeTruthy();
	const panelId = trigger.getAttribute("aria-controls");
	const panel = document.getElementById(panelId ?? "");
	expect(panel).not.toBeNull();
	if (panel) {
		expect(within(panel).queryByRole("link")).toBeNull();
	}
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
