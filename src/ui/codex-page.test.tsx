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
import { afterEach, expect, test } from "vitest";
import type { CatalogEntry, CodexMap } from "../engine/types";
import { createPersist } from "../persist/storage";
import { createFakeRemote } from "../test/fake-remote";
import protocolsJson from "../test/fixtures/protocols.json";
import {
	loaded,
	memoryStore,
	stubMatchMedia,
	stubViewTransitions,
} from "../test/helpers";
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

let viewport: ReturnType<typeof stubMatchMedia>;

async function renderCodex(
	options: {
		persist?: ReturnType<typeof createPersist>;
		reducedMotion?: boolean;
		width?: number;
	} = {},
) {
	viewport = stubMatchMedia(
		false,
		options.reducedMotion ?? false,
		options.width,
	);
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/codex"] });
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

test("changing the sort starts a view transition with the reorder type", async () => {
	const user = userEvent.setup();
	await renderCodex();
	const { calls, restore } = stubViewTransitions();
	try {
		await user.click(screen.getByRole("radio", { name: "Port" }));
		expect(calls).toEqual([["reorder"]]);
	} finally {
		restore();
	}
});

test("with reduced motion stubbed to match, changing the sort starts no view transition", async () => {
	const user = userEvent.setup();
	const persist = await renderCodex({ reducedMotion: true });
	const { calls, restore } = stubViewTransitions();
	try {
		await user.click(screen.getByRole("radio", { name: "Port" }));
		expect(persist.readCodexSort()).toBe("port");
		expect(calls).toEqual([]);
	} finally {
		restore();
	}
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

test("the fresh-flag clear writes the Codex stored at that moment, not the mount-time copy", async () => {
	const persist = createPersist(memoryStore());
	persist.writeCodex({ http: { state: "correct", fresh: true } });
	const merged = {
		http: { state: "correct" as const, fresh: false },
		ftp: { state: "missed" as const, fresh: true },
	};
	let reads = 0;
	const wrapped = {
		...persist,
		readCodex() {
			const value = persist.readCodex();
			reads += 1;
			if (reads === 1) {
				persist.writeCodex(merged);
			}
			return value;
		},
	};
	await renderCodex({ persist: wrapped });
	expect(persist.readCodex()).toEqual({
		http: { state: "correct", fresh: false },
		ftp: { state: "missed", fresh: false },
	});
});

// The popover opens against the right edge of the last column of a row, so
// its side shows the column count the page uses. Card 1 is the last column of
// 2 columns; card 2 is the last column of 3; card 3 is the last of 4.
async function panelSide(index: number) {
	const list = screen.getByRole("list", { name: /Protocols/ });
	const item = within(list).getAllByRole("listitem")[index];
	const card = item && within(item).getByRole("button");
	if (!card) {
		throw new Error("no card at the index");
	}
	fireEvent.click(card);
	const panel = screen.getByRole("note");
	const side = panel.className.includes("right-0") ? "right" : "left";
	fireEvent.click(card);
	await waitForElementToBeRemoved(() => screen.queryByRole("note"));
	return side;
}

// The sides of cards 1, 2 and 3: 2, 3 and 4 columns.
const COLUMNS = {
	2: ["right", "left", "right"],
	3: ["left", "right", "left"],
	4: ["left", "left", "right"],
};

async function sides() {
	return [await panelSide(1), await panelSide(2), await panelSide(3)];
}

function seedAllProtocols() {
	const persist = createPersist(memoryStore());
	persist.writeCodex(
		Object.fromEntries(
			protocols.map((entry) => [entry.id, { state: "missed", fresh: false }]),
		) as CodexMap,
	);
	return persist;
}

test.each([
	[0, 2],
	[700, 3],
	[1000, 4],
] as const)(
	"the Codex lays its columns out for a %ipx viewport after the first render",
	async (width, columns) => {
		await renderCodex({ persist: seedAllProtocols(), width });
		expect(await sides()).toEqual(COLUMNS[columns]);
	},
);

test("the Codex follows a viewport change", async () => {
	await renderCodex({ persist: seedAllProtocols(), width: 1000 });
	expect(await sides()).toEqual(COLUMNS[4]);
	act(() => viewport.setWidth(700));
	expect(await sides()).toEqual(COLUMNS[3]);
	act(() => viewport.setWidth(500));
	expect(await sides()).toEqual(COLUMNS[2]);
});
