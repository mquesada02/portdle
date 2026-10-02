import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { digitLength } from "../engine/guess";
import type { DailyPersist } from "../engine/types";
import { addUtcDays } from "../engine/utc";
import { createPersist } from "../persist/storage";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	portDigits,
	stubMatchMedia,
} from "../test/helpers";
import { App } from "./app";

const mixedAnswer = dailyOn("mixed");

async function renderDaily(
	options: {
		persist?: ReturnType<typeof createPersist>;
		utcToday?: string;
		remote?: FakeRemote;
		path?: string;
	} = {},
) {
	stubMatchMedia();
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({
		initialEntries: [options.path ?? "/portdle/"],
	});
	const remote = options.remote ?? createFakeRemote();
	if (options.utcToday !== undefined) {
		remote.today = options.utcToday;
	}
	render(<App persist={persist} remote={remote} history={history} />);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	return persist;
}

// The Reveal's Played figure.
function playedCount(): string | undefined {
	return (
		screen.getByText("Played").nextElementSibling?.textContent ?? undefined
	);
}

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
});

test("mixed daily shows N named digit slots with the first one focused on load", async () => {
	await renderDaily();
	expect(
		screen.getByRole("heading", { level: 1, name: mixedAnswer.name }),
	).toBeTruthy();
	const length = digitLength(mixedAnswer.port);
	const group = screen.getByRole("group", { name: "Port digits" });
	const slots = within(group).getAllByRole("textbox");
	expect(slots).toHaveLength(length);
	for (let index = 0; index < length; index += 1) {
		expect(
			within(group).getByRole("textbox", {
				name: `Digit ${index + 1} of ${length}`,
			}),
		).toBeTruthy();
	}
	expect(document.activeElement).toBe(slots[0]);
});

test("first slot regains focus after Got it closes How-to", async () => {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	render(
		<App persist={persist} remote={createFakeRemote()} history={history} />,
	);
	await screen.findByRole("dialog", { name: "How-to" });
	const user = userEvent.setup();
	await user.click(screen.getByRole("button", { name: "Got it" }));
	const firstSlot = portDigits();
	expect(document.activeElement).toBe(firstSlot);
});

test("Daily switcher marks the current category and links to the other two Dailies", async () => {
	const user = userEvent.setup();
	const protocolsAnswer = dailyOn("protocols");
	const applicationsAnswer = dailyOn("applications");
	await renderDaily();
	expect(
		screen.getByRole("link", { name: "Mixed", current: "page" }),
	).toBeTruthy();
	expect(
		screen.queryByRole("link", { name: "Protocols", current: "page" }),
	).toBeNull();
	expect(
		screen.queryByRole("link", { name: "Applications", current: "page" }),
	).toBeNull();
	await user.click(screen.getByRole("link", { name: "Protocols" }));
	expect(
		screen.getByRole("heading", { level: 1, name: protocolsAnswer.name }),
	).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Protocols", current: "page" }),
	).toBeTruthy();
	await user.click(screen.getByRole("link", { name: "Applications" }));
	expect(
		screen.getByRole("heading", { level: 1, name: applicationsAnswer.name }),
	).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Applications", current: "page" }),
	).toBeTruthy();
});

test("Daily switcher and its Protocols and Applications links appear only on the three Daily routes", async () => {
	await renderDaily({ path: "/portdle/blitz" });
	expect(screen.queryByRole("link", { name: "Mixed" })).toBeNull();
	expect(screen.queryByRole("link", { name: "Protocols" })).toBeNull();
	expect(screen.queryByRole("link", { name: "Applications" })).toBeNull();
});

test("too few digits shows Not enough digits. and does not persist a daily", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), "51");
	await user.keyboard("{Enter}");
	expect(screen.getByText("Not enough digits.")).toBeTruthy();
	expect(persist.readDaily("mixed", UTC_TODAY)).toBeNull();
});

test("a full-length but out-of-range guess shows Not a valid port.", async () => {
	const user = userEvent.setup();
	const date = "2026-09-22";
	const protocolsAnswer = dailyOn("protocols", date);
	const persist = await renderDaily({
		path: "/portdle/protocols",
		utcToday: date,
	});
	expect(digitLength(protocolsAnswer.port)).toBe(5);
	await user.type(portDigits(), "99999");
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Not a valid port.")).toBeTruthy();
	expect(persist.readDaily("protocols", date)).toBeNull();
});

test("try counter reads 0 / 6 then 1 / 6 after a committed try", async () => {
	const user = userEvent.setup();
	await renderDaily();
	expect(screen.getByText("0 / 6")).toBeTruthy();
	await user.type(portDigits(), padToAnswer(80, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("1 / 6")).toBeTruthy();
});

test("the board never renders empty placeholder rows", async () => {
	const user = userEvent.setup();
	const length = digitLength(mixedAnswer.port);
	await renderDaily();
	expect(screen.getAllByRole("textbox")).toHaveLength(length);
	await user.type(portDigits(), padToAnswer(80, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByRole("textbox")).toHaveLength(length);
	await user.type(portDigits(), padToAnswer(19, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByRole("textbox")).toHaveLength(length);
});

test("catalog misses name the service including miss-only", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), padToAnswer(80, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText("HTTP").length).toBeGreaterThan(0);
	expect(persist.readDaily("mixed", UTC_TODAY)?.guesses).toEqual([
		{
			port: 80,
			result: "miss",
			identified: { id: "http", name: "HTTP", port: 80 },
		},
	]);
	await user.type(portDigits(), padToAnswer(19, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText("chargen").length).toBeGreaterThan(0);
	await user.type(portDigits(), padToAnswer(23, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText("Telnet").length).toBeGreaterThan(0);
});

test("unknown miss and duplicate do not spend extra tries", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), padToAnswer(1, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText("Not in this catalog.").length).toBeGreaterThan(0);
	await user.type(portDigits(), padToAnswer(1, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Already guessed.")).toBeTruthy();
	expect(persist.readDaily("mixed", UTC_TODAY)?.guesses).toHaveLength(1);
});

test("correct guess wins, reveals, stats, and copies share text", async () => {
	const user = userEvent.setup();
	const copied: string[] = [];
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: {
			writeText: async (text: string) => {
				copied.push(text);
			},
		},
	});
	const persist = await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText(String(mixedAnswer.port)).length).toBeGreaterThan(
		0,
	);
	expect(screen.getByText("TCP")).toBeTruthy();
	expect(screen.getByText(mixedAnswer.description)).toBeTruthy();
	expect(screen.getByText("Played")).toBeTruthy();
	expect(screen.getByText("100")).toBeTruthy();
	await user.click(screen.getByRole("button", { name: "Share" }));
	expect(copied[0]).toBe(`Portdle · Mixed · ${UTC_TODAY} · 1/6\n\n🟩🟩🟩🟩`);
	expect(persist.readDaily("mixed", UTC_TODAY)?.status).toBe("won");
	expect(persist.readDaily("mixed", UTC_TODAY)?.late).toBe(false);
	expect(playedCount()).toBe("1");
	expect(screen.queryByRole("group", { name: "Port digits" })).toBeNull();
});

test("double submit of a winning guess counts played once", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.dblClick(screen.getByRole("button", { name: "Submit" }));
	expect(playedCount()).toBe("1");
	expect(persist.readDaily("mixed", UTC_TODAY)?.guesses).toHaveLength(1);
});

test("six misses lose, freeze, and share X/6", async () => {
	const user = userEvent.setup();
	const copied: string[] = [];
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: {
			writeText: async (text: string) => {
				copied.push(text);
			},
		},
	});
	await renderDaily();
	for (const port of [80, 19, 23, 1, 2, 3]) {
		await user.type(portDigits(), padToAnswer(port, mixedAnswer));
		await user.click(screen.getByRole("button", { name: "Submit" }));
	}
	expect(screen.getByText(mixedAnswer.description)).toBeTruthy();
	expect(screen.queryByRole("group", { name: "Port digits" })).toBeNull();
	await user.click(screen.getByRole("button", { name: "Share" }));
	expect(copied[0]).toBe(
		`Portdle · Mixed · ${UTC_TODAY} · X/6\n\n🟨🟩⬜🟩\n🟨🟩⬜⬜\n🟨🟩⬜🟨\n🟨🟩🟩⬜\n🟨🟩🟩⬜\n🟨🟩🟩🟨`,
	);
});

test("refresh restores a committed miss with the active row ready", async () => {
	const user = userEvent.setup();
	const store = new Map<string, string>();
	const persist = createPersist(memoryStore(store));
	persist.writeHowToSeen();
	await renderDaily({ persist });
	await user.type(portDigits(), padToAnswer(80, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	cleanup();
	const restored = createPersist(memoryStore(store));
	await renderDaily({ persist: restored });
	expect(screen.getByText("HTTP")).toBeTruthy();
	expect(
		screen.getByText(
			(_, element) => element?.textContent === padToAnswer(80, mixedAnswer),
		),
	).toBeTruthy();
	expect(screen.getByRole("group", { name: "Port digits" })).toBeTruthy();
});

test("reload of a finished Daily shows no slots", async () => {
	const user = userEvent.setup();
	const store = new Map<string, string>();
	const persist = createPersist(memoryStore(store));
	persist.writeHowToSeen();
	await renderDaily({ persist });
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	cleanup();
	const restored = createPersist(memoryStore(store));
	await renderDaily({ persist: restored });
	expect(screen.queryByRole("group", { name: "Port digits" })).toBeNull();
	expect(screen.getByText(mixedAnswer.description)).toBeTruthy();
});

test("slot editing: typing advances, Backspace edits, paste fills, typing over a filled slot replaces", async () => {
	const user = userEvent.setup();
	await renderDaily();
	const length = digitLength(mixedAnswer.port);
	const group = () => screen.getByRole("group", { name: "Port digits" });
	const slot = (position: number) =>
		within(group()).getByRole("textbox", {
			name: `Digit ${position} of ${length}`,
		}) as HTMLInputElement;

	await user.type(slot(1), "123");
	expect(document.activeElement).toBe(slot(4));

	await user.click(slot(3));
	await user.keyboard("{Backspace}");
	expect(slot(1).value).toBe("1");
	expect(slot(2).value).toBe("2");
	expect(slot(3).value).toBe("");
	expect(document.activeElement).toBe(slot(3));

	await user.keyboard("{Backspace}");
	expect(slot(1).value).toBe("1");
	expect(slot(2).value).toBe("");
	expect(document.activeElement).toBe(slot(2));

	await user.click(slot(1));
	await user.paste(padToAnswer(mixedAnswer.port, mixedAnswer));
	const padded = padToAnswer(mixedAnswer.port, mixedAnswer);
	for (let index = 0; index < length; index += 1) {
		expect(slot(index + 1).value).toBe(padded.charAt(index));
	}

	await user.click(slot(1));
	await user.keyboard("9");
	expect(slot(1).value).toBe("9");

	await user.click(slot(1));
	await user.keyboard(padded.charAt(0));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText(String(mixedAnswer.port)).length).toBeGreaterThan(
		0,
	);
});

test("how-to still appears on first mixed visit", async () => {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	render(
		<App persist={persist} remote={createFakeRemote()} history={history} />,
	);
	expect(await screen.findByRole("dialog", { name: "How-to" })).toBeTruthy();
	expect(
		screen.getByRole("heading", { level: 1, name: mixedAnswer.name }),
	).toBeTruthy();
});

test("a failed current Dailies read shows the failure line and keeps the Daily switcher", async () => {
	const remote = createFakeRemote();
	remote.failDailies = true;
	const persist = await renderDaily({ remote });
	expect(screen.getByText("Could not load puzzles.")).toBeTruthy();
	expect(
		within(
			screen.getByRole("navigation", { name: "Daily switcher" }),
		).getAllByRole("link"),
	).toHaveLength(3);
	expect(persist.readDaily("mixed", UTC_TODAY)).toBeNull();
});

test("a failed catalog read shows the failure line", async () => {
	const remote = createFakeRemote();
	remote.failCatalog = true;
	await renderDaily({ remote });
	expect(screen.getByText("Could not load puzzles.")).toBeTruthy();
});

test("a Daily whose entry id is not in the catalog shows the failure line", async () => {
	const remote = createFakeRemote();
	remote.entryIds = { mixed: "nope", protocols: "nope", applications: "nope" };
	await renderDaily({ remote });
	expect(screen.getByText("Could not load puzzles.")).toBeTruthy();
});

test("a build with no backend shows the failure line", async () => {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			history={createMemoryHistory({ initialEntries: ["/portdle/"] })}
		/>,
	);
	expect(await screen.findByText("Could not load puzzles.")).toBeTruthy();
});

test("the Daily shows loading until both reads arrive", async () => {
	const remote = createFakeRemote();
	const release = remote.holdDailies();
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			remote={remote}
			history={createMemoryHistory({ initialEntries: ["/portdle/"] })}
		/>,
	);
	expect(await screen.findByText("Loading...")).toBeTruthy();
	release();
	expect(
		await screen.findByRole("heading", { level: 1, name: mixedAnswer.name }),
	).toBeTruthy();
});

test("the Daily is the server's date, not the device clock's, and tries are saved under it", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	remote.today = "2026-09-12";
	const answer = dailyOn("mixed", "2026-09-12");
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			remote={remote}
			history={createMemoryHistory({ initialEntries: ["/portdle/"] })}
		/>,
	);
	await screen.findByRole("heading", { level: 1, name: answer.name });
	await user.type(portDigits(), padToAnswer(answer.port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readDaily("mixed", "2026-09-12")?.status).toBe("won");
	expect(persist.readDaily("mixed", UTC_TODAY)).toBeNull();
	expect(persist.readDaily("mixed", "2026-09-12")?.late).toBe(false);
});

test("protocols and applications are independent dailies with distinct ids", async () => {
	const protocolsAnswer = dailyOn("protocols");
	const applicationsAnswer = dailyOn("applications");
	expect(mixedAnswer.id).not.toBe(protocolsAnswer.id);
	expect(mixedAnswer.id).not.toBe(applicationsAnswer.id);
	await renderDaily({ path: "/portdle/protocols" });
	expect(
		screen.getByRole("heading", { level: 1, name: protocolsAnswer.name }),
	).toBeTruthy();
	cleanup();
	await renderDaily({ path: "/portdle/applications" });
	expect(
		screen.getByRole("heading", {
			level: 1,
			name: applicationsAnswer.name,
		}),
	).toBeTruthy();
});

test("protocols miss of an applications-only port is not in this catalog", async () => {
	const user = userEvent.setup();
	const date = "2026-09-14";
	const protocolsAnswer = dailyOn("protocols", date);
	await renderDaily({ path: "/portdle/protocols", utcToday: date });
	await user.type(portDigits(), padToAnswer(5173, protocolsAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText("Not in this catalog.").length).toBeGreaterThan(0);
});

test("finishing protocols does not change mixed stats", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const protocolsAnswer = dailyOn("protocols");
	await renderDaily({ persist, path: "/portdle/protocols" });
	await user.type(
		portDigits(),
		padToAnswer(protocolsAnswer.port, protocolsAnswer),
	);
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(playedCount()).toBe("1");
	expect(persist.readDaily("protocols", UTC_TODAY)?.status).toBe("won");
	expect(persist.readDaily("mixed", UTC_TODAY)).toBeNull();
	await user.click(screen.getByRole("button", { name: "Share" }));
});

test("finishing mixed does not change protocols stats", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(playedCount()).toBe("1");
	expect(persist.readDaily("mixed", UTC_TODAY)?.status).toBe("won");
	expect(persist.readDaily("protocols", UTC_TODAY)).toBeNull();
});

test("protocols share uses the Protocols label", async () => {
	const user = userEvent.setup();
	const copied: string[] = [];
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: {
			writeText: async (text: string) => {
				copied.push(text);
			},
		},
	});
	const protocolsAnswer = dailyOn("protocols");
	await renderDaily({ path: "/portdle/protocols" });
	await user.type(
		portDigits(),
		padToAnswer(protocolsAnswer.port, protocolsAnswer),
	);
	await user.click(screen.getByRole("button", { name: "Submit" }));
	await user.click(screen.getByRole("button", { name: "Share" }));
	expect(copied[0]).toBe(`Portdle · Protocols · ${UTC_TODAY} · 1/6\n\n🟩🟩🟩`);
});

test("winning a Daily records its target as Correct in the codex store", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readCodex()[mixedAnswer.id]).toEqual({
		state: "correct",
		fresh: true,
	});
});

test("losing a Daily records its target as Missed in the codex store", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	for (const port of [80, 19, 23, 1, 2, 3]) {
		await user.type(portDigits(), padToAnswer(port, mixedAnswer));
		await user.click(screen.getByRole("button", { name: "Submit" }));
	}
	expect(persist.readCodex()[mixedAnswer.id]).toEqual({
		state: "missed",
		fresh: true,
	});
});

test("a Daily try on a known wrong port records that entry as Identified", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), padToAnswer(80, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readCodex().http).toEqual({
		state: "identified",
		fresh: true,
	});
});

test("an invalid Daily guess leaves the codex store unchanged", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), "51");
	await user.keyboard("{Enter}");
	expect(screen.getByText("Not enough digits.")).toBeTruthy();
	expect(persist.readCodex()).toEqual({});
});

test("a duplicate Daily try leaves the codex store unchanged beyond the first try", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), padToAnswer(80, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	const afterFirst = persist.readCodex();
	await user.type(portDigits(), padToAnswer(80, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Already guessed.")).toBeTruthy();
	expect(persist.readCodex()).toEqual(afterFirst);
});

function streakCount(): string | undefined {
	return (
		screen.getByText("Streak").nextElementSibling?.textContent ?? undefined
	);
}

function won(late?: boolean): DailyPersist {
	return {
		status: "won",
		guesses: [{ port: 80, result: "correct", identified: null }],
		...(late === undefined ? {} : { late }),
	};
}

test("finishing a Daily writes the record and no stats keys", async () => {
	const user = userEvent.setup();
	const store = memoryStore();
	await renderDaily({ persist: createPersist(store) });
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(
		[...store.data.keys()].filter((key) =>
			/stats|lastPlayed|lastSeenUtc/.test(key),
		),
	).toEqual([]);
});

test("a later try keeps the stored late mark", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, {
		status: "playing",
		guesses: [{ port: 1, result: "miss", identified: null }],
		late: true,
	});
	await renderDaily({ persist });
	await user.type(portDigits(), padToAnswer(2, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readDaily("mixed", UTC_TODAY)?.late).toBe(true);
	expect(persist.readDaily("mixed", UTC_TODAY)?.guesses).toHaveLength(2);
});

test("the Reveal folds stats from the saved records: an unfinished on-day record before today breaks the streak", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", addUtcDays(UTC_TODAY, -3), won(false));
	persist.writeDaily("mixed", addUtcDays(UTC_TODAY, -2), won(false));
	persist.writeDaily("mixed", addUtcDays(UTC_TODAY, -1), {
		status: "playing",
		guesses: [{ port: 1, result: "miss", identified: null }],
		late: false,
	});
	await renderDaily({ persist });
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(playedCount()).toBe("3");
	expect(streakCount()).toBe("1");
});

test("the Reveal counts a late record in Played but not in the streak", async () => {
	const user = userEvent.setup();
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", addUtcDays(UTC_TODAY, -2), won(false));
	persist.writeDaily("mixed", addUtcDays(UTC_TODAY, -1), won(true));
	await renderDaily({ persist });
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(playedCount()).toBe("3");
	expect(streakCount()).toBe("1");
});
