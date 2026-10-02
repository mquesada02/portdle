import { afterEach, expect, test } from "vitest";
import { entryById } from "../engine/catalog";
import type { CatalogEntry } from "../engine/types";
import { createPersist } from "../persist/storage";
import type { Catalog, CurrentDailies, Remote } from "../remote/remote";
import { createSync, PULL_THROTTLE_MS } from "../sync/sync";
import { sameEntry, UTC_TODAY } from "../test/dailies";
import { createFakeClock } from "../test/fake-clock";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import { flush, memoryStore } from "../test/helpers";
import { createServerStore, FOCUS_READ_THROTTLE_MS } from "./server-store";

const MINUTE = 60_000;
const at = (iso: string) => Date.parse(iso);

const detachers: Array<() => void> = [];
afterEach(() => {
	Reflect.deleteProperty(document, "visibilityState");
	for (const detach of detachers.splice(0)) {
		detach();
	}
});

function setup(remote: FakeRemote = createFakeRemote()) {
	const clock = createFakeClock();
	const store = createServerStore(remote, clock);
	return { remote, clock, store };
}

// The store attached, as the app does it, then loaded.
async function start(remote?: FakeRemote) {
	const parts = setup(remote);
	detachers.push(parts.store.attach());
	parts.store.load();
	await flush();
	return parts;
}

function dailiesOf(store: ReturnType<typeof createServerStore>) {
	const { dailies } = store.getSnapshot();
	if (dailies.status !== "ready") {
		throw new Error(`dailies are ${dailies.status}`);
	}
	return dailies.value;
}

async function focus() {
	window.dispatchEvent(new Event("focus"));
	await flush();
}

test("the timer reads at the next UTC midnight by the server's time", async () => {
	const remote = createFakeRemote();
	remote.today = "2026-09-09";
	remote.serverNow = at("2026-09-09T23:00:00Z");
	const { clock, store } = await start(remote);
	expect(clock.pending()).toBe(1);
	remote.today = "2026-09-10";
	remote.serverNow = at("2026-09-10T00:00:00.500Z");
	clock.advance(59 * MINUTE + 59_999);
	await flush();
	expect(remote.dailiesCalls).toBe(1);
	clock.advance(1);
	await flush();
	expect(remote.dailiesCalls).toBe(2);
	expect(dailiesOf(store).today).toBe("2026-09-10");
});

test("every applied read replaces the pending timer", async () => {
	const { remote, clock, store } = await start();
	expect(clock.pending()).toBe(1);
	await store.refreshDailies();
	await store.refreshDailies();
	expect(remote.dailiesCalls).toBe(3);
	expect(clock.pending()).toBe(1);
});

test("a timer that fires early re-arms for the rest", async () => {
	const remote = createFakeRemote();
	remote.serverNow = at("2026-09-09T23:59:59Z");
	const { clock } = await start(remote);
	clock.advance(1000);
	await flush();
	// The server still answers with a stale time before midnight.
	expect(remote.dailiesCalls).toBe(2);
	expect(clock.pending()).toBe(1);
});

test("a failed read keeps what is loaded and arms no timer", async () => {
	const { remote, clock, store } = await start();
	const before = store.getSnapshot();
	remote.failDailies = true;
	clock.advance(12 * 60 * MINUTE);
	await flush();
	expect(remote.dailiesCalls).toBe(2);
	expect(store.getSnapshot()).toBe(before);
	expect(clock.pending()).toBe(0);
	// Only a focus recovers, with no throttle block after a long time.
	remote.failDailies = false;
	await focus();
	expect(remote.dailiesCalls).toBe(3);
	expect(clock.pending()).toBe(1);
});

test("a focus read follows its own 30-second throttle from the last success", async () => {
	const { remote, clock } = await start();
	clock.advance(FOCUS_READ_THROTTLE_MS - 1);
	await focus();
	expect(remote.dailiesCalls).toBe(1);
	clock.advance(1);
	await focus();
	expect(remote.dailiesCalls).toBe(2);
});

test("a hidden tab reads nothing, a visible one does", async () => {
	const { remote, clock } = await start();
	clock.advance(FOCUS_READ_THROTTLE_MS);
	for (const value of ["hidden", "visible"] as const) {
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value,
		});
		document.dispatchEvent(new Event("visibilitychange"));
		await flush();
		expect(remote.dailiesCalls).toBe(value === "hidden" ? 1 : 2);
	}
});

test("the focus read and the sync pull throttle apart from each other", async () => {
	const remote = createFakeRemote({
		status: "signedIn",
		accountId: "u1",
		displayName: "Ada",
		nameConfirmed: true,
	});
	const clock = createFakeClock();
	const store = createServerStore(remote, clock);
	const sync = createSync({
		persist: createPersist(memoryStore()),
		remote,
		clock,
		utcToday: () => UTC_TODAY,
	});
	detachers.push(store.attach(), sync.attach());
	store.load();
	await sync.refresh();
	expect(remote.dailiesCalls).toBe(1);
	expect(remote.pullCalls).toBe(1);
	// A pull at 20 s; a focus at 31 s reads the Dailies, not the pull.
	clock.advance(20_000);
	await sync.refresh();
	expect(remote.pullCalls).toBe(2);
	clock.advance(11_000);
	await focus();
	expect(remote.dailiesCalls).toBe(2);
	expect(remote.pullCalls).toBe(2);
	// At 50 s the pull is 30 s old and the Dailies read is 19 s old.
	clock.advance(PULL_THROTTLE_MS - 11_000);
	await focus();
	expect(remote.dailiesCalls).toBe(2);
	expect(remote.pullCalls).toBe(3);
});

test("a focus is skipped while a read is in flight, a first failure is retried by focus", async () => {
	const remote = createFakeRemote();
	remote.failDailies = true;
	const release = remote.holdDailies();
	const { store } = setup(remote);
	detachers.push(store.attach());
	store.load();
	await focus();
	expect(remote.dailiesCalls).toBe(1);
	release();
	await flush();
	expect(store.getSnapshot().dailies.status).toBe("failed");
	remote.failDailies = false;
	await focus();
	expect(remote.dailiesCalls).toBe(2);
	expect(store.getSnapshot().dailies.status).toBe("ready");
});

test("the disposer stops the listeners and the timer", async () => {
	const parts = setup();
	const detach = parts.store.attach();
	parts.store.load();
	await flush();
	expect(parts.clock.pending()).toBe(1);
	detach();
	expect(parts.clock.pending()).toBe(0);
	parts.clock.advance(FOCUS_READ_THROTTLE_MS);
	await focus();
	expect(parts.remote.dailiesCalls).toBe(1);
});

test("a read that ends after dispose arms nothing, and attach arms it", async () => {
	const remote = createFakeRemote();
	const release = remote.holdDailies();
	const { clock, store } = setup(remote);
	const detach = store.attach();
	store.load();
	detach();
	release();
	await flush();
	expect(store.getSnapshot().dailies.status).toBe("ready");
	expect(clock.pending()).toBe(0);
	detachers.push(store.attach());
	expect(clock.pending()).toBe(1);
});

test("attach before any applied read arms nothing, the first read arms one timer", async () => {
	const remote = createFakeRemote();
	const release = remote.holdDailies();
	const { clock, store } = setup(remote);
	// StrictMode: attach, dispose, attach before the first read settles.
	store.attach()();
	detachers.push(store.attach());
	store.load();
	expect(clock.pending()).toBe(0);
	release();
	await flush();
	expect(clock.pending()).toBe(1);
});

test("mount, dispose, mount after an applied read leaves one timer", async () => {
	const { clock, store } = await start();
	store.attach()();
	detachers.push(store.attach());
	expect(clock.pending()).toBe(1);
});

test("attach arms from the server's time plus the clock time since the read", async () => {
	const remote = createFakeRemote();
	remote.serverNow = at("2026-09-09T23:00:00Z");
	const parts = setup(remote);
	const detach = parts.store.attach();
	parts.store.load();
	await flush();
	detach();
	parts.clock.advance(30 * MINUTE);
	detachers.push(parts.store.attach());
	remote.serverNow = at("2026-09-10T00:00:00Z");
	parts.clock.advance(29 * MINUTE + 59_999);
	await flush();
	expect(remote.dailiesCalls).toBe(1);
	parts.clock.advance(1);
	await flush();
	expect(remote.dailiesCalls).toBe(2);
});

test("an attach after the midnight has passed reads at once", async () => {
	const remote = createFakeRemote();
	remote.serverNow = at("2026-09-09T23:00:00Z");
	const parts = setup(remote);
	const detach = parts.store.attach();
	parts.store.load();
	await flush();
	detach();
	parts.clock.advance(2 * 60 * MINUTE);
	detachers.push(parts.store.attach());
	parts.clock.advance(0);
	await flush();
	expect(remote.dailiesCalls).toBe(2);
});

test("with no remote nothing runs", async () => {
	const clock = createFakeClock();
	const store = createServerStore(undefined, clock);
	detachers.push(store.attach());
	store.load();
	await store.refreshDailies();
	expect(store.getSnapshot().dailies.status).toBe("failed");
	expect(clock.pending()).toBe(0);
});

// A Remote whose reads wait for the test to flush them.
function scriptedRemote() {
	type Pending<T> = {
		resolve(value: T): void;
		reject(): void;
	};
	const dailies: Array<Pending<CurrentDailies>> = [];
	const catalogs: Array<Pending<Catalog>> = [];
	function read<T>(list: Array<Pending<T>>) {
		return new Promise<T>((resolve, reject) => {
			list.push({ resolve, reject: () => reject(new Error("failed")) });
		});
	}
	const remote = {
		readCatalog: () => read(catalogs),
		readCurrentDailies: () => read(dailies),
	} as unknown as Remote;
	return { remote, dailies, catalogs };
}

function daily(today: string, ids = ["a", "a", "a"]): CurrentDailies {
	return {
		today,
		serverNow: at(`${today}T12:00:00Z`),
		entryIds: {
			mixed: ids[0] ?? "a",
			protocols: ids[1] ?? "a",
			applications: ids[2] ?? "a",
		},
	};
}

function entry(id: string): CatalogEntry {
	return {
		id,
		name: id,
		port: 1,
		transport: "tcp",
		description: "d",
		answerEligible: true,
	};
}

const CATALOG: Catalog = {
	protocols: [entry("a")],
	applications: [],
};

test("only the newest read applies, whichever order they flush in", async () => {
	const { remote, dailies } = scriptedRemote();
	const store = createServerStore(remote, createFakeClock());
	void store.refreshDailies();
	void store.refreshDailies();
	dailies[1]?.resolve(daily("2026-09-10"));
	await flush();
	dailies[0]?.resolve(daily("2026-09-09"));
	await flush();
	expect(dailiesOf(store).today).toBe("2026-09-10");
});

test("a dropped older success then a newer failure sets failed; the reverse changes nothing", async () => {
	const first = scriptedRemote();
	const store = createServerStore(first.remote, createFakeClock());
	void store.refreshDailies();
	void store.refreshDailies();
	first.dailies[0]?.resolve(daily("2026-09-09"));
	await flush();
	expect(store.getSnapshot().dailies.status).toBe("loading");
	first.dailies[1]?.reject();
	await flush();
	expect(store.getSnapshot().dailies.status).toBe("failed");

	const second = scriptedRemote();
	const other = createServerStore(second.remote, createFakeClock());
	void other.refreshDailies();
	void other.refreshDailies();
	second.dailies[1]?.reject();
	await flush();
	second.dailies[0]?.resolve(daily("2026-09-09"));
	await flush();
	expect(other.getSnapshot().dailies.status).toBe("failed");
});

test("an older read settling does not clear the guard of a newer one", async () => {
	const { remote, dailies } = scriptedRemote();
	const store = createServerStore(remote, createFakeClock());
	detachers.push(store.attach());
	void store.refreshDailies();
	void store.refreshDailies();
	dailies[0]?.reject();
	await flush();
	await focus();
	expect(dailies).toHaveLength(2);
});

test("a timer's read starts while another is in flight and the older result is dropped", async () => {
	const { remote, dailies } = scriptedRemote();
	const clock = createFakeClock();
	const store = createServerStore(remote, clock);
	detachers.push(store.attach());
	void store.refreshDailies();
	dailies[0]?.resolve(daily("2026-09-09"));
	await flush();
	expect(clock.pending()).toBe(1);
	// A focus read is in flight when the timer fires.
	clock.advance(FOCUS_READ_THROTTLE_MS);
	await focus();
	expect(dailies).toHaveLength(2);
	clock.advance(24 * 60 * MINUTE);
	await flush();
	expect(dailies).toHaveLength(3);
	dailies[2]?.resolve(daily("2026-09-10"));
	await flush();
	dailies[1]?.resolve(daily("2026-09-09"));
	await flush();
	expect(dailiesOf(store).today).toBe("2026-09-10");
});

test("a Dailies read with an entry the catalog lacks reads the catalog once", async () => {
	const { remote, store } = await start();
	const before = remote.catalogCalls;
	const fixture = remote.catalog;
	remote.catalog = {
		...fixture,
		protocols: [...fixture.protocols, entry("brand-new")],
	};
	remote.entryIds = sameEntry("brand-new");
	remote.today = "2026-09-10";
	await store.refreshDailies();
	expect(remote.catalogCalls).toBe(before + 1);
	const { catalog } = store.getSnapshot();
	if (catalog.status !== "ready") {
		throw new Error("catalog not ready");
	}
	expect(
		entryById(catalog.value.protocols, catalog.value.applications, "brand-new"),
	).toBeTruthy();
	expect(dailiesOf(store).today).toBe("2026-09-10");
});

test("with every entry in the catalog no second catalog read happens", async () => {
	const { remote, store } = await start();
	await store.refreshDailies();
	expect(remote.catalogCalls).toBe(1);
});

test("a failed catalog reload keeps the shown Daily, leaves the timer and the throttle alone", async () => {
	const { remote, clock, store } = await start();
	const before = store.getSnapshot();
	remote.entryIds = sameEntry("missing");
	remote.today = "2026-09-10";
	remote.failCatalog = true;
	clock.advance(FOCUS_READ_THROTTLE_MS);
	await focus();
	expect(remote.catalogCalls).toBe(2);
	expect(store.getSnapshot()).toBe(before);
	// The old success still counts, so the next focus tries again at once.
	await focus();
	expect(remote.dailiesCalls).toBe(3);
});

test("a failed catalog reload on a timer-fired read leaves no timer", async () => {
	const { remote, clock } = await start();
	remote.entryIds = sameEntry("missing");
	remote.failCatalog = true;
	clock.advance(24 * 60 * MINUTE);
	await flush();
	expect(clock.pending()).toBe(0);
});

test("with the catalog still loading the Dailies apply and no catalog read is added", async () => {
	const remote = createFakeRemote();
	remote.holdCatalog();
	remote.entryIds = sameEntry("missing");
	const { store } = setup(remote);
	store.load();
	await flush();
	expect(remote.catalogCalls).toBe(1);
	expect(dailiesOf(store).today).toBe(UTC_TODAY);
});

test("with the catalog failed the Dailies apply and no catalog read is added", async () => {
	const remote = createFakeRemote();
	remote.failCatalog = true;
	remote.entryIds = sameEntry("missing");
	const { store } = setup(remote);
	store.load();
	await flush();
	expect(remote.catalogCalls).toBe(1);
	expect(dailiesOf(store).today).toBe(UTC_TODAY);
});

test("a read superseded during its catalog fetch applies neither the catalog nor the Dailies", async () => {
	const { remote, dailies, catalogs } = scriptedRemote();
	const store = createServerStore(remote, createFakeClock());
	// The catalog is loaded first.
	store.load();
	catalogs[0]?.resolve(CATALOG);
	dailies[0]?.resolve(daily("2026-09-09"));
	await flush();
	// Read two lacks an entry, so it waits for the catalog; read three passes.
	void store.refreshDailies();
	dailies[1]?.resolve(daily("2026-09-10", ["x", "x", "x"]));
	await flush();
	void store.refreshDailies();
	dailies[2]?.resolve(daily("2026-09-11"));
	await flush();
	expect(dailiesOf(store).today).toBe("2026-09-11");
	catalogs[1]?.resolve({
		protocols: [entry("a"), entry("x")],
		applications: [],
	});
	await flush();
	expect(dailiesOf(store).today).toBe("2026-09-11");
	const { catalog } = store.getSnapshot();
	expect(catalog.status === "ready" && catalog.value).toEqual(CATALOG);
});
