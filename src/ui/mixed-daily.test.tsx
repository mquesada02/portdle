import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { createPersist } from "../persist/storage";
import { memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

function portDigits() {
	return within(screen.getByRole("group", { name: "Port digits" })).getByRole(
		"textbox",
	);
}

async function renderMixed(
	options: {
		persist?: ReturnType<typeof createPersist>;
		utcToday?: string;
	} = {},
) {
	stubMatchMedia();
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	render(
		<App
			persist={persist}
			history={history}
			utcToday={options.utcToday ?? "2026-09-09"}
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
	await renderMixed();
	expect(screen.getByRole("heading", { level: 1, name: "Vite" })).toBeTruthy();
	const slots = portDigits();
	expect(slots).toBeTruthy();
	expect(slots.getAttribute("maxlength")).toBe("4");
});

test("incomplete submit is invalid and does not persist a daily", async () => {
	const user = userEvent.setup();
	const persist = await renderMixed();
	await user.type(portDigits(), "51");
	await user.keyboard("{Enter}");
	expect(screen.getByText("Not a valid port.")).toBeTruthy();
	expect(persist.readDaily("mixed", "2026-09-09")).toBeNull();
});

test("catalog misses name the service including retired and miss-only", async () => {
	const user = userEvent.setup();
	const persist = await renderMixed();
	await user.type(portDigits(), "0080");
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText("HTTP").length).toBeGreaterThan(0);
	expect(persist.readDaily("mixed", "2026-09-09")?.guesses).toEqual([
		{
			port: 80,
			result: "miss",
			identified: { id: "http", name: "HTTP", port: 80 },
		},
	]);
	await user.type(portDigits(), "0019");
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText("chargen").length).toBeGreaterThan(0);
	await user.type(portDigits(), "0023");
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText("Telnet").length).toBeGreaterThan(0);
});

test("unknown miss and duplicate do not spend extra tries", async () => {
	const user = userEvent.setup();
	const persist = await renderMixed();
	await user.type(portDigits(), "0001");
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText("Not in this catalog.").length).toBeGreaterThan(0);
	await user.type(portDigits(), "0001");
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getByText("Already guessed.")).toBeTruthy();
	expect(persist.readDaily("mixed", "2026-09-09")?.guesses).toHaveLength(1);
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
	const persist = await renderMixed();
	await user.type(portDigits(), "5173");
	await user.click(screen.getByRole("button", { name: "Submit" }));
	expect(screen.getAllByText("5173").length).toBeGreaterThan(0);
	expect(screen.getByText("TCP")).toBeTruthy();
	expect(screen.getByText("Vite default development server.")).toBeTruthy();
	expect(screen.getByText("Played")).toBeTruthy();
	expect(screen.getByText("100")).toBeTruthy();
	await user.click(screen.getByRole("button", { name: "Share" }));
	expect(copied[0]).toBe("Portdle · Mixed · 2026-09-09 · 1/6\n\n🟩");
	expect(persist.readDaily("mixed", "2026-09-09")?.status).toBe("won");
	expect(persist.readLastPlayed("mixed")).toBe("2026-09-09");
	expect(persist.readLastSeenUtc()).toBe("2026-09-09");
	expect(persist.readStats("mixed")?.played).toBe(1);
	expect(screen.queryByRole("group", { name: "Port digits" })).toBeNull();
});

test("double submit of a winning guess counts played once", async () => {
	const user = userEvent.setup();
	const persist = await renderMixed();
	await user.type(portDigits(), "5173");
	await user.dblClick(screen.getByRole("button", { name: "Submit" }));
	expect(persist.readStats("mixed")?.played).toBe(1);
	expect(persist.readDaily("mixed", "2026-09-09")?.guesses).toHaveLength(1);
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
	await renderMixed();
	for (const digits of ["0080", "0019", "0023", "0001", "0002", "0003"]) {
		await user.type(portDigits(), digits);
		await user.click(screen.getByRole("button", { name: "Submit" }));
	}
	expect(screen.getByText("Vite default development server.")).toBeTruthy();
	expect(screen.queryByRole("group", { name: "Port digits" })).toBeNull();
	await user.click(screen.getByRole("button", { name: "Share" }));
	expect(copied[0]).toBe("Portdle · Mixed · 2026-09-09 · X/6\n\n⬜⬜⬜⬜⬜⬜");
});

test("refresh restores a committed miss", async () => {
	const user = userEvent.setup();
	const store = new Map<string, string>();
	const persist = createPersist(memoryStore(store));
	persist.writeHowToSeen();
	await renderMixed({ persist });
	await user.type(portDigits(), "0080");
	await user.click(screen.getByRole("button", { name: "Submit" }));
	cleanup();
	const restored = createPersist(memoryStore(store));
	await renderMixed({ persist: restored });
	expect(screen.getByText("HTTP")).toBeTruthy();
	expect(screen.getByText("0080")).toBeTruthy();
});

test("how-to still appears on first mixed visit", async () => {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	render(<App persist={persist} history={history} utcToday="2026-09-09" />);
	expect(await screen.findByRole("dialog", { name: "How-to" })).toBeTruthy();
	expect(screen.getByRole("heading", { level: 1, name: "Vite" })).toBeTruthy();
});

test("uncovered date is puzzle unavailable with help link", async () => {
	await renderMixed({ utcToday: "2026-08-01" });
	expect(
		screen.getByRole("heading", { level: 1, name: "Puzzle unavailable" }),
	).toBeTruthy();
	expect(
		within(screen.getByRole("main")).getByRole("link", { name: "Help" }),
	).toBeTruthy();
});
