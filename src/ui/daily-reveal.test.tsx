import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import theme from "tailwindcss/theme.css?raw";
import { afterEach, expect, test } from "vitest";
import { digitLength } from "../engine/guess";
import { puzzleNumber } from "../engine/puzzle-number";
import { createPersist } from "../persist/storage";
import { classContrast, parsePalette } from "../test/contrast";
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
	} = {},
) {
	stubMatchMedia();
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	const remote = options.remote ?? createFakeRemote();
	if (options.utcToday !== undefined) {
		remote.today = options.utcToday;
	}
	render(<App persist={persist} remote={remote} history={history} />);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	return persist;
}

function withClipboard(writeText: (text: string) => Promise<void>) {
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
}

// The router's own scroll restoration also calls window.scrollTo on every
// route load, always with a `left` key. The reveal's scroll-to-bottom call
// never sets `left`, so filtering on that tells the two apart.
function revealScrollCalls(calls: unknown[]): unknown[] {
	return calls.filter(
		(call) => typeof call === "object" && call !== null && !("left" in call),
	);
}

afterEach(() => {
	cleanup();
});

test("winning shows Solved, the answer, stats, and a histogram row per try", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));

	expect(screen.getByText("Solved")).toBeTruthy();
	expect(screen.getAllByText(String(mixedAnswer.port)).length).toBeGreaterThan(
		0,
	);
	expect(screen.getByText("TCP")).toBeTruthy();
	expect(screen.getByText(mixedAnswer.description)).toBeTruthy();

	expect(screen.getByText("Played").nextElementSibling?.textContent).toBe("1");
	expect(screen.getByText("Win %").nextElementSibling?.textContent).toBe("100");
	expect(screen.getByText("Streak").nextElementSibling?.textContent).toBe("1");
	expect(screen.getByText("Best streak").nextElementSibling?.textContent).toBe(
		"1",
	);

	expect(screen.getByText("Guess distribution")).toBeTruthy();
	const items = within(
		screen.getByText("Guess distribution").nextElementSibling as HTMLElement,
	).getAllByRole("listitem");
	expect(items).toHaveLength(6);
	// Won on the first try: bucket 1 holds the winning count (1); its
	// list item also carries the "1" try-number label, so both match.
	expect(within(items[0] as HTMLElement).getAllByText("1")).toHaveLength(2);
	for (const item of items.slice(1)) {
		expect(within(item as HTMLElement).getByText("0")).toBeTruthy();
	}
});

test("losing shows The answer was and an unhighlighted histogram", async () => {
	const user = userEvent.setup();
	await renderDaily();
	for (const port of [80, 19, 23, 1, 2, 3]) {
		await user.type(portDigits(), padToAnswer(port, mixedAnswer));
		await user.click(screen.getByRole("button", { name: "Submit" }));
	}

	expect(screen.getByText("The answer was")).toBeTruthy();
	expect(screen.getAllByText(String(mixedAnswer.port)).length).toBeGreaterThan(
		0,
	);
	expect(screen.getByText("TCP")).toBeTruthy();
	expect(screen.getByText(mixedAnswer.description)).toBeTruthy();

	expect(screen.getByText("Played").nextElementSibling?.textContent).toBe("1");
	expect(screen.getByText("Win %").nextElementSibling?.textContent).toBe("0");
	expect(screen.getByText("Streak").nextElementSibling?.textContent).toBe("0");
	expect(screen.getByText("Best streak").nextElementSibling?.textContent).toBe(
		"0",
	);

	expect(screen.getByText("Guess distribution")).toBeTruthy();
	const items = within(
		screen.getByText("Guess distribution").nextElementSibling as HTMLElement,
	).getAllByRole("listitem");
	expect(items).toHaveLength(6);
	for (const item of items) {
		expect(within(item as HTMLElement).getByText("0")).toBeTruthy();
	}
});

test("the Share button text and background meet 4.5:1 in both themes", async () => {
	const user = userEvent.setup();
	await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	const classes = screen.getByRole("button", { name: "Share" }).className;
	const palette = parsePalette(theme);
	for (const mode of ["light", "dark"] as const) {
		expect(classContrast(classes, mode, palette)).toBeGreaterThanOrEqual(4.5);
	}
});

test("Share reads Copied! after a successful copy", async () => {
	const user = userEvent.setup();
	withClipboard(async () => {});
	await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	await user.click(screen.getByRole("button", { name: "Share" }));
	expect(screen.getByRole("button", { name: "Copied!" })).toBeTruthy();
});

test("Share shows the share line in a text area when the clipboard is unavailable", async () => {
	const user = userEvent.setup();
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: undefined,
	});
	await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	await user.click(screen.getByRole("button", { name: "Share" }));
	expect(screen.queryByRole("button", { name: "Copied!" })).toBeNull();
	const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
	expect(textbox.value).toBe(
		`Portdle #1 · Mixed · 1/6\n\n${"🟩".repeat(digitLength(mixedAnswer.port))}`,
	);
});

async function sharedText(
	persist: ReturnType<typeof createPersist>,
): Promise<string> {
	const user = userEvent.setup();
	const copied: string[] = [];
	withClipboard(async (text) => {
		copied.push(text);
	});
	await renderDaily({ persist });
	await user.click(screen.getByRole("button", { name: "Share" }));
	return copied[0] ?? "";
}

function finishedRecord(extra: { late?: boolean }) {
	return {
		status: "won" as const,
		guesses: [
			{ port: mixedAnswer.port, result: "correct" as const, identified: null },
		],
		...extra,
	};
}

test("the share line of a late play ends with late", async () => {
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, finishedRecord({ late: true }));
	const text = await sharedText(persist);
	expect(text.split("\n")[0]).toBe("Portdle #1 · Mixed · 1/6 · late");
});

test("the share line of a record with no late mark has no late suffix", async () => {
	const persist = createPersist(memoryStore());
	persist.writeDaily("mixed", UTC_TODAY, finishedRecord({}));
	const text = await sharedText(persist);
	expect(text.split("\n")[0]).toBe("Portdle #1 · Mixed · 1/6");
});

test("the Daily header shows the puzzle number and the date", async () => {
	await renderDaily();
	expect(
		screen.getByText(`#${puzzleNumber(UTC_TODAY)} · ${UTC_TODAY}`),
	).toBeTruthy();
});

test("winning a Daily during the page session calls the page scroll", async () => {
	const scrollCalls: unknown[] = [];
	window.scrollTo = ((options: unknown) => {
		scrollCalls.push(options);
	}) as typeof window.scrollTo;
	const user = userEvent.setup();
	await renderDaily();
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	await screen.findByText("Solved");
	await new Promise((resolve) => {
		setTimeout(resolve, 400);
	});
	expect(revealScrollCalls(scrollCalls).length).toBeGreaterThan(0);
});

test("losing a Daily during the page session calls the page scroll", async () => {
	const scrollCalls: unknown[] = [];
	window.scrollTo = ((options: unknown) => {
		scrollCalls.push(options);
	}) as typeof window.scrollTo;
	const user = userEvent.setup();
	await renderDaily();
	for (const port of [80, 19, 23, 1, 2, 3]) {
		await user.type(portDigits(), padToAnswer(port, mixedAnswer));
		await user.click(screen.getByRole("button", { name: "Submit" }));
	}
	await screen.findByText("The answer was");
	await new Promise((resolve) => {
		setTimeout(resolve, 400);
	});
	expect(revealScrollCalls(scrollCalls).length).toBeGreaterThan(0);
});

test("reloading an already-finished Daily does not call the page scroll", async () => {
	const scrollCalls: unknown[] = [];
	window.scrollTo = ((options: unknown) => {
		scrollCalls.push(options);
	}) as typeof window.scrollTo;
	const store = new Map<string, string>();
	const persist = createPersist(memoryStore(store));
	persist.writeHowToSeen();
	const user = userEvent.setup();
	await renderDaily({ persist });
	await user.type(portDigits(), padToAnswer(mixedAnswer.port, mixedAnswer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
	await screen.findByText("Solved");
	// Let the live-finish scroll actually fire before unmounting, so no
	// pending timer leaks into the reload assertion below.
	await new Promise((resolve) => {
		setTimeout(resolve, 400);
	});
	cleanup();
	scrollCalls.length = 0;

	const restored = createPersist(memoryStore(store));
	await renderDaily({ persist: restored });
	await screen.findByText("Solved");
	await new Promise((resolve) => {
		setTimeout(resolve, 400);
	});
	expect(revealScrollCalls(scrollCalls).length).toBe(0);
});
