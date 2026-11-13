import { createMemoryHistory } from "@tanstack/react-router";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { BlitzRun } from "../engine/types";
import { createPersist, type Persist } from "../persist/storage";
import { createAppRouter } from "../router";
import { createSync } from "../sync/sync";
import { saveDaily } from "../test/dailies";
import { createFakeRemote } from "../test/fake-remote";
import {
	loaded,
	memoryStore,
	SERVER_MESSAGE,
	stubMatchMedia,
} from "../test/helpers";
import { appTree } from "./app";
import { createServerStore } from "./server-store";

// The first render of the app reads no stored state, so the server markup of
// a route equals the client's first render whatever the player has stored.
// One row per route; a new route or a new check is one more row or field.
type Route = {
	name: string;
	path: string;
	// What the route shows from stored state once it has hydrated.
	showsStored?: () => void;
};

const SAVED_DATE = "2026-09-08";

const THEME_BUTTON = 'button[aria-label="Toggle color theme"]';

const LAST_RUN: BlitzRun = {
	category: "protocols",
	orientation: "inverted",
	mode: "marathon",
	ended: "lives",
	endedAt: "2026-09-08T10:00:00.000Z",
	score: 7,
	rounds: [],
};

const ROUTES: Route[] = [
	{ name: "Daily (Mixed)", path: "/portdle/" },
	{ name: "Protocols", path: "/portdle/protocols" },
	{ name: "Applications", path: "/portdle/applications" },
	{ name: "Archive", path: "/portdle/archive" },
	{
		name: "Archive board",
		path: "/portdle/archive/board?category=protocols&date=2026-09-09",
	},
	{ name: "Blitz", path: "/portdle/blitz" },
	{
		name: "History",
		path: "/portdle/history",
		showsStored: () => {
			expect(screen.getByText(SAVED_DATE)).toBeTruthy();
		},
	},
	{
		name: "Blitz history",
		path: "/portdle/history/blitz",
		showsStored: () => {
			expect(screen.getByText("Score 7")).toBeTruthy();
		},
	},
	{ name: "Codex", path: "/portdle/codex" },
];

function storedPersist(options: { theme?: "dark"; howToSeen: boolean }) {
	const persist = createPersist(memoryStore());
	if (options.theme) {
		persist.writeTheme(options.theme);
	}
	if (options.howToSeen) {
		persist.writeHowToSeen();
	}
	saveDaily(persist, "mixed", SAVED_DATE, "won", 2);
	persist.writeBlitzRuns([LAST_RUN]);
	persist.writeBlitzBests({ "protocols|inverted|marathon": 7 });
	persist.writeCodex({ "1": { state: "correct", fresh: false } });
	return persist;
}

// Every call of a method that reads, for the first-render check. The methods
// that write, apply a switch-over, clear, or listen for writes do not read.
function recording(persist: Persist) {
	const reads: string[] = [];
	const wrapped = Object.fromEntries(
		Object.entries(persist).map(([key, member]) =>
			typeof member === "function" && !/^(write|apply|clear|onWrite)/.test(key)
				? [
						key,
						(...args: unknown[]) => {
							reads.push(key);
							return (member as (...a: unknown[]) => unknown)(...args);
						},
					]
				: [key, member],
		),
	) as Persist;
	return { persist: wrapped, reads };
}

// The labels of the checked category, orientation and mode pills of the Blitz
// dialog ("blitz") or of the Leaderboards picker ("leaderboard").
const LAST_SETUP = ["Protocols", "Inverted", "Marathon (5m)"];

function checkedLabels(prefix: "blitz" | "leaderboard") {
	return ["category", "orientation", "mode"].map((group, index) =>
		document
			.querySelector(`input[name="${prefix}-${group}"]:checked`)
			?.closest("label")
			?.textContent?.startsWith(LAST_SETUP[index] ?? "")
			? LAST_SETUP[index]
			: undefined,
	);
}

function matchMediaCalls() {
	const calls: string[] = [];
	const stub = window.matchMedia;
	window.matchMedia = (query: string) => {
		calls.push(query);
		return stub(query);
	};
	return calls;
}

// The real router, loaded, and the tree that players get. The server side and
// the client side each build their own, as two processes would.
async function loadedApp(
	persist: Persist,
	remote: ReturnType<typeof createFakeRemote> | undefined,
	path: string,
) {
	const serverStore = createServerStore(remote);
	const router = createAppRouter({
		persist,
		backend: remote && { remote, sync: createSync({ persist, remote }) },
		remount: () => {},
		history: createMemoryHistory({ initialEntries: [path] }),
		serverStore,
		random: () => 0.5,
	});
	await router.load();
	return { router, serverStore, tree: appTree(router, 0) };
}

// The server markup of a route, as the prerender produces it.
async function serverHtml(
	persist: Persist,
	remote: ReturnType<typeof createFakeRemote> | undefined,
	path: string,
) {
	return renderToString((await loadedApp(persist, remote, path)).tree);
}

// The class records that show the theme class leaving <html>: any change of
// the class attribute whose old value held `dark`.
function darkClassRemoved(records: MutationRecord[]) {
	return records.filter((record) => (record.oldValue ?? "").includes("dark"));
}

async function hydrate(html: string, tree: ReturnType<typeof appTree>) {
	const container = document.createElement("div");
	container.innerHTML = html;
	document.body.append(container);
	const errors: unknown[] = [];
	const classChanges = new MutationObserver(() => {});
	classChanges.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
		attributeOldValue: true,
	});
	const consoleError = vi.spyOn(console, "error");
	await act(async () => {
		hydrateRoot(container, tree, {
			onRecoverableError: (error) => errors.push(error),
		});
	});
	const records = classChanges.takeRecords();
	classChanges.disconnect();
	return { container, errors, records, consoleError };
}

beforeEach(() => {
	stubMatchMedia(false, false);
	(
		globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
	cleanup();
	document.body.replaceChildren();
	document.documentElement.classList.remove("dark");
	vi.restoreAllMocks();
});

test.each(ROUTES)(
	"$name: no first render reads stored state",
	async ({ path }) => {
		const { persist, reads } = recording(
			storedPersist({ theme: "dark", howToSeen: true }),
		);
		const mediaCalls = matchMediaCalls();
		const { tree } = await loadedApp(persist, createFakeRemote(), path);
		reads.length = 0;
		mediaCalls.length = 0;
		renderToString(tree);
		expect(reads).toEqual([]);
		expect(mediaCalls).toEqual([]);
	},
);

test.each(ROUTES)(
	"$name: hydrates with no mismatch, then shows the stored state",
	async ({ path, showsStored }) => {
		const persist = storedPersist({ theme: "dark", howToSeen: true });
		const remote = createFakeRemote();
		const html = await serverHtml(persist, remote, path);

		// The server markup holds none of the stored state.
		const probe = document.createElement("div");
		probe.innerHTML = html;
		expect(within(probe).queryByText(SAVED_DATE)).toBeNull();
		expect(within(probe).queryByText("Score 7")).toBeNull();
		// The theme button shows the sun (it has a circle) until the theme is read.
		expect(probe.querySelector(`${THEME_BUTTON} svg circle`)).not.toBeNull();
		expect(probe.querySelector("dialog")?.hasAttribute("open")).toBe(false);

		// The head script has set the theme before the client runs.
		document.documentElement.classList.add("dark");
		const client = await loadedApp(persist, remote, path);
		const { errors, records, consoleError } = await hydrate(html, client.tree);
		expect(errors).toEqual([]);
		expect(consoleError).not.toHaveBeenCalled();
		// Nothing took the theme class off <html>, in the first commit or after.
		expect(darkClassRemoved(records)).toEqual([]);
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		// The stored dark theme shows the moon (no circle) after the read.
		expect(document.querySelector(`${THEME_BUTTON} svg circle`)).toBeNull();
		expect(document.querySelector(`${THEME_BUTTON} svg path`)).not.toBeNull();
		expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(false);
		showsStored?.();
	},
);

test.each(ROUTES)(
	"$name: a player with no stored theme and a dark system gets the dark class",
	async ({ path }) => {
		stubMatchMedia(true, false);
		const persist = storedPersist({ howToSeen: true });
		const remote = createFakeRemote();
		const html = await serverHtml(persist, remote, path);
		document.documentElement.classList.add("dark");
		const client = await loadedApp(persist, remote, path);
		const { errors, records } = await hydrate(html, client.tree);
		expect(errors).toEqual([]);
		expect(darkClassRemoved(records)).toEqual([]);
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	},
);

test.each(ROUTES)(
	"$name: the How-to opens on a first visit, after the first render",
	async ({ path }) => {
		const persist = createPersist(memoryStore());
		const remote = createFakeRemote();
		const html = await serverHtml(persist, remote, path);
		const probe = document.createElement("div");
		probe.innerHTML = html;
		expect(probe.querySelector("dialog")?.hasAttribute("open")).toBe(false);
		const client = await loadedApp(persist, remote, path);
		const { errors, consoleError } = await hydrate(html, client.tree);
		expect(errors).toEqual([]);
		expect(consoleError).not.toHaveBeenCalled();
		expect(
			screen.getByRole("dialog", { name: "How-to" }).hasAttribute("open"),
		).toBe(true);
	},
);

test("Blitz: the setup of the last run applies after hydration", async () => {
	const persist = storedPersist({ howToSeen: true });
	const remote = createFakeRemote();
	const path = "/portdle/blitz";
	const html = await serverHtml(persist, remote, path);
	const client = await loadedApp(persist, remote, path);
	const { errors } = await hydrate(html, client.tree);
	expect(errors).toEqual([]);
	await act(async () => {
		client.serverStore.load();
	});
	await loaded();
	const user = userEvent.setup();
	// The last run and the Bests table both show the score.
	expect(screen.getAllByText("Score 7")).toHaveLength(2);
	await user.click(screen.getByRole("button", { name: "New run" }));
	expect(checkedLabels("blitz")).toEqual(LAST_SETUP);
	await user.click(screen.getByRole("tab", { name: "Leaderboards" }));
	expect(checkedLabels("leaderboard")).toEqual(LAST_SETUP);
});

// React may hydrate a Suspense boundary after the page's first commit, whose
// effects start the server read. A fast read then ends before the boundary
// hydrates; its markup must still match the server's frame (WebKit did this on
// the prerendered build).
test.each([
	"/portdle/",
	"/portdle/protocols",
	"/portdle/blitz",
	"/portdle/codex",
])(
	"%s hydrates when the server read ends before its boundary hydrates",
	async (path) => {
		const persist = storedPersist({ howToSeen: true });
		const remote = createFakeRemote();
		const html = await serverHtml(persist, remote, path);
		const client = await loadedApp(persist, remote, path);
		client.serverStore.load();
		await vi.waitFor(() => {
			expect(client.serverStore.getSnapshot().catalog.status).toBe("ready");
		});
		const { errors } = await hydrate(html, client.tree);
		expect(errors).toEqual([]);
	},
);

test.each([
	["with a remote", () => createFakeRemote(), "Loading..."],
	["with no remote", () => undefined, null],
])(
	"Blitz renders and hydrates its server snapshot %s",
	async (_name, makeRemote, text) => {
		const persist = storedPersist({ howToSeen: true });
		const path = "/portdle/blitz";
		const remote = makeRemote();
		const html = await serverHtml(persist, remote, path);
		// The server render did not abort into a client-render fallback.
		expect(html).not.toContain("<!--$!-->");
		const probe = document.createElement("div");
		probe.innerHTML = html;
		const status = within(probe).getByRole("status");
		if (text) {
			expect(status.textContent).toBe(text);
		} else {
			expect(status.textContent).toContain(SERVER_MESSAGE);
		}
		const client = await loadedApp(persist, remote, path);
		const { errors } = await hydrate(html, client.tree);
		expect(errors).toEqual([]);
	},
);

// A different day and a different viewport for the server render and for the
// client: the first render reads neither, so the markup is the same.
const SERVER_DAY = "2026-09-08T12:00:00Z";
const CLIENT_DAY = "2026-10-10T23:59:00Z";

test.each(ROUTES)(
	"$name: hydrates with no mismatch on another clock day and another viewport",
	async ({ path }) => {
		vi.useFakeTimers({ toFake: ["Date"] });
		try {
			const persist = storedPersist({ howToSeen: true });
			const remote = createFakeRemote();
			vi.setSystemTime(new Date(SERVER_DAY));
			stubMatchMedia(false, false, 400);
			const html = await serverHtml(persist, remote, path);
			vi.setSystemTime(new Date(CLIENT_DAY));
			stubMatchMedia(false, false, 1200);
			const client = await loadedApp(persist, remote, path);
			const { errors, consoleError } = await hydrate(html, client.tree);
			expect(errors).toEqual([]);
			expect(consoleError).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	},
);

// The clock reads of a function: `Date.now` and `new Date()` with no argument.
// `Date.UTC`, `Date.parse` and `new Date(value)` are not clock reads.
function clockReads(run: () => void) {
	const reads: string[] = [];
	const wrapped = new Proxy(Date, {
		construct(target, args, newTarget) {
			if (args.length === 0) {
				reads.push("new Date()");
			}
			return Reflect.construct(target, args, newTarget);
		},
		get(target, property) {
			if (property === "now") {
				return () => {
					reads.push("Date.now");
					return target.now();
				};
			}
			return Reflect.get(target, property, target);
		},
	});
	vi.stubGlobal("Date", wrapped);
	try {
		run();
	} finally {
		vi.unstubAllGlobals();
	}
	return reads;
}

test.each(ROUTES)(
	"$name: no first render reads the clock",
	async ({ path }) => {
		const { tree } = await loadedApp(
			storedPersist({ theme: "dark", howToSeen: true }),
			createFakeRemote(),
			path,
		);
		expect(clockReads(() => renderToString(tree))).toEqual([]);
	},
);

test.each(ROUTES)(
	"$name: a server render with no window throws nothing",
	async ({ path }) => {
		const { tree } = await loadedApp(
			storedPersist({ howToSeen: true }),
			createFakeRemote(),
			path,
		);
		vi.stubGlobal("window", undefined);
		vi.stubGlobal("document", undefined);
		try {
			expect(() => renderToString(tree)).not.toThrow();
		} finally {
			vi.unstubAllGlobals();
		}
	},
);

test("the view-transition callback runs with no window and plays no transition", async () => {
	const { router } = await loadedApp(
		createPersist(memoryStore()),
		undefined,
		"/portdle/",
	);
	const option = router.options.defaultViewTransition;
	if (typeof option !== "object" || typeof option.types !== "function") {
		throw new Error("the router has no view-transition types callback");
	}
	const types = option.types;
	const location = (pathname: string) =>
		({ pathname }) as Parameters<typeof types>[0]["toLocation"];
	const change = {
		fromLocation: location("/portdle/"),
		toLocation: location("/portdle/blitz"),
		pathChanged: true,
		hrefChanged: true,
		hashChanged: false,
	};
	expect(types(change)).toEqual(["screen"]);
	vi.stubGlobal("window", undefined);
	try {
		expect(types(change)).toBe(false);
	} finally {
		vi.unstubAllGlobals();
	}
});

test.each(ROUTES)(
	"$name: a redirect error opens the account menu after hydration, not in the first render",
	async ({ path }) => {
		const persist = storedPersist({ howToSeen: true });
		const remote = createFakeRemote();
		remote.setRedirectError("Denied");
		const html = await serverHtml(persist, remote, path);
		const probe = document.createElement("div");
		probe.innerHTML = html;
		expect(within(probe).queryByText("Denied")).toBeNull();
		const client = await loadedApp(persist, remote, path);
		const { errors, consoleError } = await hydrate(html, client.tree);
		expect(errors).toEqual([]);
		expect(consoleError).not.toHaveBeenCalled();
		expect((await screen.findAllByRole("alert"))[0]?.textContent).toBe(
			"Denied",
		);
	},
);
