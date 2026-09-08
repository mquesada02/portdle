import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { digitLength } from "../engine/guess";
import { createPersist } from "../persist/storage";
import { dailyOn, padToAnswer, UTC_TODAY } from "../test/dailies";
import { memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

const mixedAnswer = dailyOn("mixed");

function portDigits() {
	return within(screen.getByRole("group", { name: "Port digits" })).getByRole(
		"textbox",
	);
}

async function renderDaily(
	options: {
		persist?: ReturnType<typeof createPersist>;
		utcToday?: string;
		path?: string;
	} = {},
) {
	stubMatchMedia();
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({
		initialEntries: [options.path ?? "/portdle/"],
	});
	render(
		<App
			persist={persist}
			history={history}
			utcToday={options.utcToday ?? UTC_TODAY}
		/>,
	);
	await screen.findByRole("navigation", { name: "Main" });
	return persist;
}

afterEach(() => {
	cleanup();
	document.documentElement.classList.remove("dark");
});

test("mixed daily shows service name and digit slots from the start", async () => {
	await renderDaily();
	expect(
		screen.getByRole("heading", { level: 1, name: mixedAnswer.name }),
	).toBeTruthy();
	const slots = portDigits();
	expect(slots).toBeTruthy();
	expect(slots.getAttribute("maxlength")).toBe(
		String(digitLength(mixedAnswer.port)),
	);
});

test("incomplete submit is invalid and does not persist a daily", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), "51");
	await user.keyboard("{Enter}");
	expect(screen.getByText("Not a valid port.")).toBeTruthy();
	expect(persist.readDaily("mixed", UTC_TODAY)).toBeNull();
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
	expect(copied[0]).toBe(`Portdle · Mixed · ${UTC_TODAY} · 1/6\n\n🟩`);
	expect(persist.readDaily("mixed", UTC_TODAY)?.status).toBe("won");
	expect(persist.readLastPlayed("mixed")).toBe(UTC_TODAY);
	expect(persist.readLastSeenUtc()).toBe(UTC_TODAY);
	expect(persist.readStats("mixed")?.played).toBe(1);
	expect(screen.queryByRole("group", { name: "Port digits" })).toBeNull();
});

test("double submit of a winning guess counts played once", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.dblClick(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readStats("mixed")?.played).toBe(1);
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
		`Portdle · Mixed · ${UTC_TODAY} · X/6\n\n⬜⬜⬜⬜⬜⬜`,
	);
});

test("refresh restores a committed miss", async () => {
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
	expect(screen.getByText(padToAnswer(80, mixedAnswer))).toBeTruthy();
});

test("how-to still appears on first mixed visit", async () => {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	render(<App persist={persist} history={history} utcToday={UTC_TODAY} />);
	expect(await screen.findByRole("dialog", { name: "How-to" })).toBeTruthy();
	expect(
		screen.getByRole("heading", { level: 1, name: mixedAnswer.name }),
	).toBeTruthy();
});

test("uncovered date is puzzle unavailable with help link", async () => {
	await renderDaily({ utcToday: "2026-08-01" });
	expect(
		screen.getByRole("heading", { level: 1, name: "Puzzle unavailable" }),
	).toBeTruthy();
	expect(
		within(screen.getByRole("main")).getByRole("link", { name: "Help" }),
	).toBeTruthy();
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
	expect(persist.readStats("protocols")?.played).toBe(1);
	expect(persist.readLastPlayed("protocols")).toBe(UTC_TODAY);
	expect(persist.readStats("mixed")).toBeNull();
	expect(persist.readLastPlayed("mixed")).toBeNull();
	await user.click(screen.getByRole("button", { name: "Share" }));
});

test("finishing mixed does not change protocols stats", async () => {
	const user = userEvent.setup();
	const persist = await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readStats("mixed")?.played).toBe(1);
	expect(persist.readStats("protocols")).toBeNull();
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
	expect(copied[0]).toBe(`Portdle · Protocols · ${UTC_TODAY} · 1/6\n\n🟩`);
});
