import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import type { CatalogEntry } from "../engine/types";
import { createPersist } from "../persist/storage";
import { catalog, currentEntry } from "../test/blitz";
import { padToAnswer } from "../test/dailies";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	portDigits,
	stubMatchMedia,
} from "../test/helpers";
import { App } from "./app";

type User = ReturnType<typeof userEvent.setup>;

const NOT_IN_CATALOG = "Not in this catalog.";
const BEST_KEY = "mixed|default|sprint";

async function renderBlitz(
	options: {
		persist?: ReturnType<typeof createPersist>;
		remote?: FakeRemote;
	} = {},
) {
	stubMatchMedia();
	const persist = options.persist ?? createPersist(memoryStore());
	persist.writeHowToSeen();
	render(
		<App
			persist={persist}
			remote={options.remote ?? createFakeRemote()}
			history={createMemoryHistory({ initialEntries: ["/portdle/blitz"] })}
		/>,
	);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	return persist;
}

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

// A port that no catalog entry has and that keeps the answer's digit count, so
// a guess of it is a miss with no owner: "Not in this catalog."
function unknownPort(answer: CatalogEntry): number {
	const length = String(answer.port).length;
	const first = length === 1 ? 1 : 10 ** (length - 1);
	const last = Math.min(10 ** length - 1, 65535);
	for (let port = first; port <= last; port += 1) {
		if (!catalog.some((entry) => entry.port === port)) {
			return port;
		}
	}
	throw new Error(`no free ${length}-digit port`);
}

async function missUnknown(user: User) {
	const answer = currentEntry();
	await user.clear(portDigits());
	await user.type(portDigits(), padToAnswer(unknownPort(answer), answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
}

async function answerRight(user: User) {
	const answer = currentEntry();
	await user.clear(portDigits());
	await user.type(portDigits(), padToAnswer(answer.port, answer));
	await user.click(screen.getByRole("button", { name: "Submit" }));
}

async function startRun(user: User) {
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));
}

// Plays a Sprint run to its end. The last guess before the end is a "Not in
// this catalog." miss, so the arena's feedback line holds that text when the
// end card appears. A run that ends on time needs fake timers set up first.
async function playToEnd(
	user: User,
	end: "lives" | "time",
	score: 0 | 1,
): Promise<void> {
	await startRun(user);
	if (score === 1) {
		await answerRight(user);
	}
	if (end === "lives") {
		await missUnknown(user);
		await missUnknown(user);
		expect(screen.getByText(NOT_IN_CATALOG)).toBeTruthy();
		await missUnknown(user);
		return;
	}
	await missUnknown(user);
	expect(screen.getByText(NOT_IN_CATALOG)).toBeTruthy();
	vi.setSystemTime(Date.now() + 60_000);
	await screen.findByText("Time's up");
}

// Only the clock is faked, before the run starts: the run's own interval is a
// real timer, and it sees the clock jump on its next tick.
function timeUser(): User {
	vi.useFakeTimers({ toFake: ["Date"] });
	return userEvent.setup();
}

function regions(): HTMLElement[] {
	return [
		...screen
			.getByRole("main")
			.querySelectorAll<HTMLElement>('[aria-live="polite"]'),
	];
}

function liveRegion(): HTMLElement {
	const found = regions();
	expect(found).toHaveLength(1);
	return found[0] as HTMLElement;
}

// Records every DOM change from now on. `drain` returns the records since the
// last drain, in order.
function recordChanges() {
	const seen: MutationRecord[] = [];
	const observer = new MutationObserver((records) => seen.push(...records));
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true,
	});
	return {
		drain(): MutationRecord[] {
			seen.push(...observer.takeRecords());
			return seen.splice(0);
		},
		stop() {
			observer.disconnect();
		},
	};
}

// The region was added with no text of its own: the only change that touches
// it comes after the record that added it, and that change sets `text`.
function expectAnnouncedOnce(
	records: MutationRecord[],
	region: HTMLElement,
	text: string,
) {
	const added = records.findIndex((record) =>
		[...record.addedNodes].some(
			(node) => node === region || node.contains(region),
		),
	);
	const touching = records
		.map((record, index) => ({ record, index }))
		.filter(({ record }) => region.contains(record.target));
	expect(added).toBeGreaterThanOrEqual(0);
	expect(touching).toHaveLength(1);
	const [change] = touching;
	expect(change?.index).toBeGreaterThan(added);
	expect(change?.record.type).toBe("childList");
	expect(change?.record.addedNodes[0]?.textContent).toBe(text);
}

test("a run that ends out of lives right after a miss shows no feedback on the end card", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await playToEnd(user, "lives", 0);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expect(screen.queryByText(NOT_IN_CATALOG)).toBeNull();
});

test("a run that ends on time shows no feedback on the end card", async () => {
	await renderBlitz();
	const user = timeUser();
	await playToEnd(user, "time", 0);
	expect(screen.getByText("Time's up")).toBeTruthy();
	expect(screen.queryByText(NOT_IN_CATALOG)).toBeNull();
});

test.each([
	{ end: "lives", score: 0, best: undefined, text: "Out of lives. Score 0." },
	{
		end: "lives",
		score: 1,
		best: undefined,
		text: "Out of lives. Score 1. New best.",
	},
	{ end: "lives", score: 1, best: 5, text: "Out of lives. Score 1." },
	{ end: "time", score: 0, best: undefined, text: "Time's up. Score 0." },
	{
		end: "time",
		score: 1,
		best: undefined,
		text: "Time's up. Score 1. New best.",
	},
	{ end: "time", score: 1, best: 5, text: "Time's up. Score 1." },
] as const)(
	"the end card announces $text",
	async ({ end, score, best, text }) => {
		const persist = createPersist(memoryStore());
		if (best !== undefined) {
			persist.writeBlitzBests({ [BEST_KEY]: best });
		}
		await renderBlitz({ persist });
		const user = end === "time" ? timeUser() : userEvent.setup();
		await playToEnd(user, end, score);
		const region = liveRegion();
		expect(region.classList.contains("sr-only")).toBe(true);
		expect(region.closest('[aria-hidden="true"]')).toBeNull();
		await waitFor(() => expect(region.textContent).toBe(text));
	},
);

test("the end card region is added with no text, then gets its text once, across a re-render", async () => {
	const remote = createFakeRemote({
		status: "signedIn",
		accountId: "u1",
		displayName: "Ada L.",
		nameConfirmed: true,
	});
	remote.rows.bests = { [BEST_KEY]: { score: 9 } };
	const release = remote.holdPull();
	const persist = createPersist(memoryStore());
	await renderBlitz({ persist, remote });
	const user = userEvent.setup();
	const recorder = recordChanges();
	await playToEnd(user, "lives", 0);
	const region = liveRegion();
	expect(region.textContent).toBe("Out of lives. Score 0.");
	expectAnnouncedOnce(recorder.drain(), region, "Out of lives. Score 0.");
	// A pull that lands now shows a stored Best of 9 on the card: the screen
	// renders again, and the announcement does not change.
	release();
	await waitFor(() => expect(screen.getByText("Best 9")).toBeTruthy());
	expect(region.textContent).toBe("Out of lives. Score 0.");
	expect(recorder.drain().filter((r) => region.contains(r.target))).toEqual([]);
	recorder.stop();
});

test("a second run's end card again adds its region empty, then sets its text", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	const recorder = recordChanges();
	await playToEnd(user, "lives", 0);
	expectAnnouncedOnce(recorder.drain(), liveRegion(), "Out of lives. Score 0.");
	await user.click(screen.getByRole("button", { name: "Retry" }));
	recorder.drain();
	await missUnknown(user);
	await missUnknown(user);
	await missUnknown(user);
	expect(screen.getByText("Out of lives")).toBeTruthy();
	expectAnnouncedOnce(recorder.drain(), liveRegion(), "Out of lives. Score 0.");
	recorder.stop();
});

test("Retry starts a run with an empty feedback line", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await playToEnd(user, "lives", 0);
	await user.click(screen.getByRole("button", { name: "Retry" }));
	expect(liveRegion().textContent).toBe("");
});

test("Play again then a new run starts with an empty feedback line", async () => {
	const user = userEvent.setup();
	await renderBlitz();
	await playToEnd(user, "lives", 0);
	await user.click(screen.getByRole("button", { name: "Play again" }));
	await startRun(user);
	expect(liveRegion().textContent).toBe("");
});
