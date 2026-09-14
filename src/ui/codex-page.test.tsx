import { createMemoryHistory } from "@tanstack/react-router";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitForElementToBeRemoved,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import protocolsJson from "../catalogs/protocols.json";
import type { CatalogEntry, CodexMap } from "../engine/types";
import { createPersist } from "../persist/storage";
import { UTC_TODAY } from "../test/dailies";
import { memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

const protocols = protocolsJson as CatalogEntry[];
const ftp = protocols.find((entry) => entry.id === "ftp");
if (!ftp) {
	throw new Error("FTP fixture entry missing from protocols catalog");
}
const ftpSource = ftp.sources?.[0];
if (!ftpSource) {
	throw new Error("FTP fixture entry has no source to test against");
}

async function renderCodex(
	options: { persist?: ReturnType<typeof createPersist> } = {},
) {
	stubMatchMedia();
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/codex"] });
	render(<App persist={persist} history={history} utcToday={UTC_TODAY} />);
	await screen.findByRole("navigation", { name: "Main" });
	return persist;
}

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
});

test("an empty Codex shows every card as ??? and the headline reads Seen 0 / 74 · Correct 0", async () => {
	await renderCodex();
	expect(screen.getByText("Seen 0 / 74 · Correct 0")).toBeTruthy();
	const unseenCards = screen.getAllByRole("img", { name: "Unseen" });
	expect(unseenCards).toHaveLength(74);
	expect(unseenCards.every((card) => card.textContent === "???")).toBe(true);
	expect(unseenCards[0]?.tabIndex).toBe(-1);
});

test("a seeded Codex shows name, port, transport, and state label per card, and each group heading carries its own seen count", async () => {
	const persist = createPersist(memoryStore());
	persist.writeCodex({
		http: { state: "correct", fresh: false },
		ftp: { state: "missed", fresh: false },
		chargen: { state: "identified", fresh: false },
		vite: { state: "correct", fresh: false },
	});
	await renderCodex({ persist });
	expect(screen.getByText("Seen 4 / 74 · Correct 2")).toBeTruthy();
	expect(
		screen.getByRole("heading", { level: 2, name: "Protocols 3 / 48" }),
	).toBeTruthy();
	expect(
		screen.getByRole("heading", { level: 2, name: "Applications 1 / 26" }),
	).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "HTTP 80 TCP Correct" }),
	).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "FTP 21 TCP Missed" }),
	).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "chargen 19 TCP Identified" }),
	).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Vite 5173 TCP Correct" }),
	).toBeTruthy();
});

test("clicking a seen card opens a note with its description and sources; Enter opens it and Escape closes it", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeCodex({ ftp: { state: "missed", fresh: false } });
	await renderCodex({ persist });
	const card = screen.getByRole("button", { name: "FTP 21 TCP Missed" });
	expect(screen.queryByRole("note")).toBeNull();
	fireEvent.click(card);
	const panel = screen.getByRole("note");
	expect(within(panel).getByText(ftp.description)).toBeTruthy();
	const source = within(panel).getByRole("link", { name: ftpSource.label });
	expect(source.getAttribute("href")).toBe(ftpSource.url);
	fireEvent.click(card);
	await waitForElementToBeRemoved(() => screen.queryByRole("note"));

	card.focus();
	expect(document.activeElement).toBe(card);
	expect(screen.queryByRole("note")).toBeNull();
	await user.keyboard("{Enter}");
	expect(screen.getByRole("note")).toBeTruthy();
	await user.keyboard("{Escape}");
	await waitForElementToBeRemoved(() => screen.queryByRole("note"));
});

test("Sort toggle reorders by port and persists across a remount; Name restores the default order; an unseen card keeps its position", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	// DNS (port 53) sorts before SMTP (port 25) by name (D < S), but after it
	// by port (25 < 53) — this pair proves an actual reorder rather than a
	// coincidental match between the two orderings.
	const seeded: CodexMap = {
		dns: { state: "identified", fresh: false },
		smtp: { state: "missed", fresh: false },
	};
	persist.writeCodex(seeded);
	await renderCodex({ persist });

	// Re-queries the current DOM each call, rather than capturing a single
	// node reference, so these stay accurate across the remount below.
	function protocolsList() {
		return screen.getByRole("list", { name: "Protocols 2 / 48" });
	}
	function buttonTextsInOrder() {
		return within(protocolsList())
			.getAllByRole("button")
			.map((button) => button.textContent ?? "");
	}
	function firstCardIsUnseen() {
		const firstItem = within(protocolsList()).getAllByRole("listitem")[0];
		if (!firstItem) {
			throw new Error("missing first Protocols card");
		}
		return within(firstItem).queryByRole("img", { name: "Unseen" }) !== null;
	}

	const byNameOrder = buttonTextsInOrder();
	expect(byNameOrder.findIndex((text) => text.startsWith("DNS"))).toBeLessThan(
		byNameOrder.findIndex((text) => text.startsWith("SMTP")),
	);
	expect(firstCardIsUnseen()).toBe(true);

	await user.click(screen.getByRole("radio", { name: "Port" }));
	expect(persist.readCodexSort()).toBe("port");
	const byPortOrder = buttonTextsInOrder();
	expect(byPortOrder.findIndex((text) => text.startsWith("SMTP"))).toBeLessThan(
		byPortOrder.findIndex((text) => text.startsWith("DNS")),
	);
	expect(firstCardIsUnseen()).toBe(true);

	// Persists across a remount: a fresh render from the same store reopens
	// on Port, still reordered.
	cleanup();
	await renderCodex({ persist });
	const portRadio = screen.getByRole("radio", { name: "Port" });
	expect(portRadio instanceof HTMLInputElement && portRadio.checked).toBe(true);
	const afterRemount = buttonTextsInOrder();
	expect(
		afterRemount.findIndex((text) => text.startsWith("SMTP")),
	).toBeLessThan(afterRemount.findIndex((text) => text.startsWith("DNS")));

	await user.click(screen.getByRole("radio", { name: "Name" }));
	expect(persist.readCodexSort()).toBe("name");
	const restored = buttonTextsInOrder();
	expect(restored.findIndex((text) => text.startsWith("DNS"))).toBeLessThan(
		restored.findIndex((text) => text.startsWith("SMTP")),
	);
});

test("a fresh card renders on mount and every stored record's fresh reads false once mounted; state is unchanged by the visit", async () => {
	const persist = createPersist(memoryStore());
	persist.writeCodex({
		http: { state: "correct", fresh: true },
		ftp: { state: "missed", fresh: false },
	});
	await renderCodex({ persist });
	expect(
		screen.getByRole("button", { name: "HTTP 80 TCP Correct" }),
	).toBeTruthy();
	const stored = persist.readCodex();
	expect(stored.http).toEqual({ state: "correct", fresh: false });
	expect(stored.ftp).toEqual({ state: "missed", fresh: false });
});
