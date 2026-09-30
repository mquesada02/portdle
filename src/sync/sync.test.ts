import { afterEach, expect, test } from "vitest";
import { applyDailyFinish, emptyStats } from "../engine/stats";
import type { BlitzRun, DailyPersist } from "../engine/types";
import { createPersist } from "../persist/storage";
import type { AccountState } from "../remote/remote";
import { createFakeClock } from "../test/fake-clock";
import {
	createFakeRemote,
	emptyRows,
	type FakeRemote,
} from "../test/fake-remote";
import { memoryStore } from "../test/helpers";
import { addDeviceProgress, deviceChoicePending } from "./device-progress";
import {
	type AccountReport,
	createSync,
	PULL_THROTTLE_MS,
	PUSH_DELAY_MS,
} from "./sync";

const ACCOUNT: AccountState = {
	status: "signedIn",
	accountId: "acc-1",
	displayName: "Ada",
	nameConfirmed: true,
};
const UNCONFIRMED: AccountState = { ...ACCOUNT, nameConfirmed: false };
const TODAY = "2026-09-29";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const focus = async () => {
	window.dispatchEvent(new Event("focus"));
	await settle();
};

function setVisibility(value: "visible" | "hidden") {
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		value,
	});
	document.dispatchEvent(new Event("visibilitychange"));
}

const detachers: Array<() => void> = [];
afterEach(() => {
	Reflect.deleteProperty(document, "visibilityState");
	for (const detach of detachers.splice(0)) {
		detach();
	}
});

function device(remote: FakeRemote, utcToday = TODAY) {
	const store = memoryStore();
	const persist = createPersist(store);
	const clock = createFakeClock();
	const sync = createSync({ persist, remote, clock, utcToday: () => utcToday });
	detachers.push(sync.attach());
	return { store, persist, clock, sync, remote };
}

function win(...ports: number[]): DailyPersist {
	return {
		status: "won",
		guesses: ports.map((port, index) => ({
			port,
			result: index === ports.length - 1 ? "correct" : "miss",
			identified: null,
		})),
	};
}
const LOSS_GUESSES: DailyPersist["guesses"] = Array.from({ length: 6 }, () => ({
	port: 1,
	result: "miss" as const,
	identified: null,
}));
const PLAYING: DailyPersist = {
	status: "playing",
	guesses: [{ port: 1, result: "miss", identified: null }],
};

function run(endedAt: string, score: number): BlitzRun {
	return {
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		ended: "lives",
		endedAt,
		score,
		timeToScoreMs: 1000.5,
		rounds: [
			{ id: "http", name: "HTTP", port: 80, outcome: "correct", wrong: null },
		],
	};
}

test("a local write is pushed after 1.5 seconds, once, and only what changed", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	d.clock.advance(PUSH_DELAY_MS - 1);
	await settle();
	expect(remote.pushCalls).toHaveLength(0);
	d.clock.advance(1);
	await settle();
	expect(remote.pushCalls).toEqual([
		{
			codex: { http: "correct" },
			bests: {},
			runs: [],
			dailies: {},
			preferences: {},
		},
	]);
	d.persist.writeDaily("mixed", "2026-09-29", win(80));
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pushCalls[1]).toEqual({
		codex: {},
		bests: {},
		runs: [],
		dailies: { "mixed|2026-09-29": win(80) },
		preferences: {},
	});
	expect(d.persist.readSyncChanges().codex).toEqual([]);
});

test("Bests and runs are pushed through the same path", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeBlitzBests({
		"mixed|default|sprint": { score: 3, timeToScoreMs: 5.5 },
	});
	d.persist.writeBlitzRuns([run("2026-09-29T10:00:00.000Z", 3)]);
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pushCalls).toEqual([
		{
			codex: {},
			bests: { "mixed|default|sprint": { score: 3, timeToScoreMs: 5.5 } },
			runs: [run("2026-09-29T10:00:00.000Z", 3)],
			dailies: {},
			preferences: {},
		},
	]);
});

test("a second write restarts the delay", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeBlitzBests({ "mixed|default|sprint": { score: 3 } });
	d.clock.advance(1000);
	d.persist.writeBlitzRuns([run("2026-09-29T10:00:00.000Z", 3)]);
	d.clock.advance(1000);
	await settle();
	expect(remote.pushCalls).toHaveLength(0);
	d.clock.advance(500);
	await settle();
	expect(remote.pushCalls).toHaveLength(1);
	expect(remote.rows.bests).toEqual({ "mixed|default|sprint": { score: 3 } });
	expect(remote.rows.runs).toHaveLength(1);
});

test("the Codex fresh-flag clear and unsynced writes push nothing", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	await d.sync.refresh();
	remote.pushCalls.length = 0;
	d.persist.writeCodex({ http: { state: "correct", fresh: false } });
	d.persist.writeStats("mixed", emptyStats());
	d.persist.writeLastSeenUtc(TODAY);
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pushCalls).toHaveLength(0);
	expect(d.clock.pending()).toBe(0);
});

test("a pull merges every kind, keeps local fresh flags, and pushes only what the account lacks", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.codex = { dns: "correct", http: "identified" };
	remote.rows.bests = { "mixed|default|sprint": { score: 9 } };
	remote.rows.runs = [run("2026-09-28T10:00:00.000Z", 9)];
	remote.rows.dailies = { "mixed|2026-09-28": win(80) };
	const d = device(remote);
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	d.persist.writeBlitzBests({
		"mixed|default|sprint": { score: 5 },
		"protocols|default|sprint": { score: 2 },
	});
	d.persist.writeBlitzRuns([run("2026-09-29T10:00:00.000Z", 5)]);
	d.persist.writeDaily("mixed", "2026-09-28", PLAYING);
	d.persist.writeDaily("mixed", "2026-09-27", win(80));
	await d.sync.refresh();
	expect(d.persist.readCodex()).toEqual({
		http: { state: "correct", fresh: true },
		dns: { state: "correct", fresh: false },
	});
	expect(d.persist.readBlitzBests()).toEqual({
		"mixed|default|sprint": { score: 9 },
		"protocols|default|sprint": { score: 2 },
	});
	expect(d.persist.readBlitzRuns().map((r) => r.endedAt)).toEqual([
		"2026-09-29T10:00:00.000Z",
		"2026-09-28T10:00:00.000Z",
	]);
	expect(d.persist.readDaily("mixed", "2026-09-28")).toEqual(win(80));
	expect(remote.pushCalls).toEqual([
		{
			codex: { http: "correct" },
			bests: { "protocols|default|sprint": { score: 2 } },
			runs: [run("2026-09-29T10:00:00.000Z", 5)],
			dailies: { "mixed|2026-09-27": win(80) },
			preferences: {},
		},
	]);
	expect(d.persist.readSyncAccount()).toBe("acc-1");
});

test("a pull does not count as a local change", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.codex = { dns: "correct" };
	const d = device(remote);
	await d.sync.refresh();
	expect(remote.pushCalls).toHaveLength(0);
	expect(d.persist.readSyncChanges()).toEqual({
		codex: [],
		bests: [],
		runs: [],
		dailies: [],
		preferences: [],
	});
	expect(d.clock.pending()).toBe(0);
});

test("rows returned with reordered object keys mark and push nothing", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.runs = [run("2026-09-28T10:00:00.000Z", 9)];
	remote.rows.dailies = { "mixed|2026-09-28": win(80, 443) };
	remote.reorderKeys = true;
	const d = device(remote);
	d.persist.writeBlitzRuns([run("2026-09-28T10:00:00.000Z", 9)]);
	d.persist.writeDaily("mixed", "2026-09-28", win(80, 443));
	await d.sync.refresh();
	await d.sync.refresh();
	expect(remote.pushCalls).toHaveLength(0);
});

test("nothing is pulled or pushed while the name confirm is pending, then a full sync runs", async () => {
	const remote = createFakeRemote(UNCONFIRMED);
	const d = device(remote);
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	await d.sync.refresh();
	d.persist.writeBlitzBests({ "mixed|default|sprint": { score: 3 } });
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pullCalls).toBe(0);
	expect(remote.pushCalls).toHaveLength(0);
	remote.state = ACCOUNT;
	await d.sync.refresh();
	expect(remote.rows.codex).toEqual({ http: "correct" });
	expect(remote.rows.bests).toEqual({ "mixed|default|sprint": { score: 3 } });
});

test("progress made while signed out reaches the account at the next sign-in", async () => {
	const remote = createFakeRemote({ status: "signedOut" });
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeDaily("mixed", "2026-09-28", win(80));
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pushCalls).toHaveLength(0);
	remote.state = ACCOUNT;
	await d.sync.refresh();
	expect(remote.rows.dailies).toEqual({ "mixed|2026-09-28": win(80) });
});

test("a pull that changed a Daily rebuilds stats and last played", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.dailies = {
		"mixed|2026-09-27": win(80),
		"mixed|2026-09-28": win(80, 443),
	};
	const d = device(remote);
	await d.sync.refresh();
	let expected = applyDailyFinish({
		stats: emptyStats(),
		result: "won",
		tries: 1,
	});
	expected = applyDailyFinish({ stats: expected, result: "won", tries: 2 });
	expect(d.persist.readStats("mixed")).toEqual(expected);
	expect(d.persist.readLastPlayed("mixed")).toBe("2026-09-28");
	expect(d.persist.readStats("protocols")).toBeNull();
});

test("a pull that changed no Daily leaves stats alone", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.codex = { dns: "correct" };
	const d = device(remote);
	d.persist.writeDaily("mixed", "2026-09-28", win(80));
	d.persist.writeStats("mixed", { ...emptyStats(), played: 7 });
	await d.sync.refresh();
	expect(d.persist.readStats("mixed")?.played).toBe(7);
});

test("hidden does not pull, visible after the throttle does", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.clock.advance(PULL_THROTTLE_MS);
	setVisibility("hidden");
	await settle();
	expect(remote.pullCalls).toBe(1);
	setVisibility("visible");
	await settle();
	expect(remote.pullCalls).toBe(2);
});

test("a focus inside the throttle does not pull, at 30 seconds it does", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.clock.advance(10000);
	await focus();
	expect(remote.pullCalls).toBe(1);
	d.clock.advance(PULL_THROTTLE_MS - 10000 - 1);
	await focus();
	expect(remote.pullCalls).toBe(1);
	d.clock.advance(1);
	await focus();
	expect(remote.pullCalls).toBe(2);
});

test("a focus 31 seconds after a pull pulls, and the pull restarts the window", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.clock.advance(PULL_THROTTLE_MS + 1000);
	await focus();
	expect(remote.pullCalls).toBe(2);
	d.clock.advance(10000);
	await focus();
	expect(remote.pullCalls).toBe(2);
});

test("a visibility change inside the throttle does not pull", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.clock.advance(10000);
	setVisibility("visible");
	await settle();
	expect(remote.pullCalls).toBe(1);
});

test("a pull at time zero still starts the window", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	expect(d.clock.now()).toBe(0);
	await d.sync.refresh();
	d.clock.advance(10000);
	await focus();
	expect(remote.pullCalls).toBe(1);
});

test("a focus after a failed pull pulls", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	remote.failPull = true;
	await d.sync.refresh();
	remote.failPull = false;
	await focus();
	expect(remote.pullCalls).toBe(2);
	await focus();
	expect(remote.pullCalls).toBe(2);
});

test("a focus after a failed account read pulls", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	remote.failGetAccount = true;
	await d.sync.refresh();
	remote.failGetAccount = false;
	await focus();
	expect(remote.pullCalls).toBe(1);
});

test("a pull that stops on a name confirm records no time", async () => {
	const remote = createFakeRemote(UNCONFIRMED);
	const d = device(remote);
	await d.sync.refresh();
	expect(remote.pullCalls).toBe(0);
	remote.state = ACCOUNT;
	await focus();
	expect(remote.pullCalls).toBe(1);
});

test("a pull that stops on a device progress choice records no time", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	d.persist.writeSyncAccount("acc-other");
	d.persist.writeCodex({ http: { state: "correct", fresh: false } });
	await d.sync.refresh();
	expect(remote.pullCalls).toBe(0);
	d.persist.writeSyncAccount(ACCOUNT.accountId);
	await focus();
	expect(remote.pullCalls).toBe(1);
});

test("a visibility change then a focus on tab return make one pull", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.clock.advance(PULL_THROTTLE_MS);
	setVisibility("visible");
	await focus();
	expect(remote.pullCalls).toBe(2);
});

test("a focus after a pull whose push failed pulls and retries the push", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	remote.failPush = true;
	d.persist.writeCodex({ http: { state: "correct", fresh: false } });
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pushCalls).toHaveLength(1);
	remote.failPush = false;
	await focus();
	expect(remote.pullCalls).toBe(2);
	expect(remote.rows.codex.http).toBe("correct");
});

test("refresh pulls inside the throttle", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.clock.advance(1000);
	await d.sync.refresh();
	expect(remote.pullCalls).toBe(2);
});

test("stop clears the recorded pull", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.sync.stop();
	d.clock.advance(1000);
	await focus();
	expect(remote.pullCalls).toBe(2);
});

test("a clock moved back does not skip the pull", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	d.clock.advance(60000);
	await d.sync.refresh();
	d.clock.now = () => 1000;
	await focus();
	expect(remote.pullCalls).toBe(2);
});

test("a focus during a pull is skipped, unless a row waits to be pushed", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.clock.advance(PULL_THROTTLE_MS);
	const release = remote.holdPull();
	const running = d.sync.refresh();
	await settle();
	expect(remote.pullCalls).toBe(2);
	await focus();
	release();
	await running;
	expect(remote.pullCalls).toBe(2);
	d.clock.advance(PULL_THROTTLE_MS);
	const releaseAgain = remote.holdPull();
	const runningAgain = d.sync.refresh();
	await settle();
	d.persist.writeCodex({ http: { state: "correct", fresh: false } });
	await focus();
	releaseAgain();
	await runningAgain;
	expect(remote.pullCalls).toBe(4);
});

test("failures are silent and the next write retries the push", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	remote.failPull = true;
	await expect(d.sync.refresh()).resolves.toBeUndefined();
	remote.failPull = false;
	remote.failPush = true;
	await d.sync.refresh();
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.rows.codex).toEqual({});
	expect(d.persist.readSyncChanges().codex).toEqual(["http"]);
	remote.failPush = false;
	d.persist.writeCodex({
		http: { state: "correct", fresh: true },
		dns: { state: "missed", fresh: true },
	});
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.rows.codex).toEqual({ http: "correct", dns: "missed" });
});

test("a failed getAccount is silent and keeps the device active for the next trigger", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	remote.failGetAccount = true;
	await expect(d.sync.refresh()).resolves.toBeUndefined();
	expect(remote.pullCalls).toBe(0);
	remote.failGetAccount = false;
	await d.sync.refresh();
	expect(remote.pullCalls).toBe(1);
});

test("nothing is pushed after a failed pull, so a better account Daily is never overwritten", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.dailies = { "mixed|2026-09-28": win(80) };
	const d = device(remote);
	d.persist.writeDaily("mixed", "2026-09-28", PLAYING);
	remote.failPull = true;
	await d.sync.refresh();
	d.persist.writeDaily("mixed", "2026-09-28", PLAYING);
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pushCalls).toHaveLength(0);
	remote.failPull = false;
	await d.sync.refresh();
	expect(remote.rows.dailies["mixed|2026-09-28"]).toEqual(win(80));
	expect(d.persist.readDaily("mixed", "2026-09-28")).toEqual(win(80));
});

test("a push scheduled before any pull runs a full sync", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.codex = { dns: "correct" };
	const d = device(remote);
	remote.failPull = true;
	await d.sync.refresh();
	remote.failPull = false;
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pullCalls).toBe(2);
	expect(remote.rows.codex).toEqual({ dns: "correct", http: "correct" });
	expect(d.persist.readCodex().dns).toEqual({ state: "correct", fresh: false });
});

test("a player write during an in-flight pull survives the merge", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.codex = { dns: "identified" };
	const d = device(remote);
	const release = remote.holdPull();
	const pending = d.sync.refresh();
	await settle();
	d.persist.writeCodex({ dns: { state: "correct", fresh: true } });
	release();
	await pending;
	expect(d.persist.readCodex().dns?.state).toBe("correct");
	expect(remote.rows.codex.dns).toBe("correct");
});

test("a row changed during an in-flight push stays pending", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeCodex({ http: { state: "identified", fresh: true } });
	const release = remote.holdPush();
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	release();
	await settle();
	expect(d.persist.readSyncChanges().codex).toEqual(["http"]);
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.rows.codex.http).toBe("correct");
	expect(d.persist.readSyncChanges().codex).toEqual([]);
});

test("two devices converge after concurrent writes", async () => {
	const rows = emptyRows();
	const a = device(createFakeRemote(ACCOUNT, rows));
	const b = device(createFakeRemote(ACCOUNT, rows));
	await a.sync.refresh();
	await b.sync.refresh();
	a.persist.writeCodex({ http: { state: "identified", fresh: true } });
	b.persist.writeCodex({ http: { state: "correct", fresh: true } });
	a.persist.writeDaily("mixed", "2026-09-28", PLAYING);
	b.persist.writeDaily("mixed", "2026-09-28", win(80));
	a.persist.writeDaily("protocols", "2026-09-28", {
		status: "lost",
		guesses: LOSS_GUESSES,
	});
	b.persist.writeDaily("protocols", "2026-09-28", win(80, 443));
	a.persist.writeBlitzBests({ "mixed|default|sprint": { score: 4 } });
	b.persist.writeBlitzBests({ "mixed|default|sprint": { score: 6 } });
	b.clock.advance(PUSH_DELAY_MS);
	await settle();
	a.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(rows.codex.http).toBe("identified");
	await a.sync.refresh();
	await b.sync.refresh();
	await a.sync.refresh();
	for (const side of [a, b]) {
		expect(side.persist.readCodex().http?.state).toBe("correct");
		expect(side.persist.readDaily("mixed", "2026-09-28")).toEqual(win(80));
		expect(side.persist.readDaily("protocols", "2026-09-28")).toEqual(
			win(80, 443),
		);
		expect(side.persist.readBlitzBests()).toEqual({
			"mixed|default|sprint": { score: 6 },
		});
	}
	expect(rows.codex.http).toBe("correct");
	expect(rows.dailies["mixed|2026-09-28"]).toEqual(win(80));
});

test("account gone from a pull or a push signs out, keeps data, and notifies", async () => {
	for (const stage of ["pull", "push"] as const) {
		const remote = createFakeRemote(ACCOUNT);
		const d = device(remote);
		const notified: number[] = [];
		d.sync.onAccountGone(() => notified.push(1));
		d.persist.writeCodex({ http: { state: "correct", fresh: true } });
		if (stage === "pull") {
			remote.gone = true;
		}
		await d.sync.refresh();
		if (stage === "push") {
			d.persist.writeCodex({ dns: { state: "correct", fresh: true } });
			remote.gone = true;
			d.clock.advance(PUSH_DELAY_MS);
			await settle();
		}
		expect(remote.signOutCalls).toBe(1);
		expect(notified).toEqual([1]);
		expect(Object.keys(d.persist.readCodex()).length).toBeGreaterThan(0);
	}
});

test("signed out while active signs the device out; while inactive does nothing", async () => {
	const remote = createFakeRemote({ status: "signedOut" });
	const d = device(remote);
	const notified: number[] = [];
	d.sync.onAccountGone(() => notified.push(1));
	await d.sync.refresh();
	expect(notified).toEqual([]);
	remote.state = ACCOUNT;
	await d.sync.refresh();
	remote.state = { status: "signedOut" };
	await d.sync.refresh();
	expect(notified).toEqual([1]);
});

test("stop ends pushes and clears the timer", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	d.sync.stop();
	expect(d.clock.pending()).toBe(0);
	d.persist.writeCodex({ dns: { state: "correct", fresh: true } });
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pushCalls).toHaveLength(0);
});

test("sign-out during an in-flight pull or account read writes nothing", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.codex = { dns: "correct" };
	const d = device(remote);
	const release = remote.holdPull();
	const pending = d.sync.refresh();
	await settle();
	d.sync.stop();
	release();
	await pending;
	expect(d.persist.readCodex()).toEqual({});
	expect(d.persist.readSyncAccount()).toBeNull();
	const releaseAccount = remote.holdGetAccount();
	const second = d.sync.refresh();
	await settle();
	d.sync.stop();
	remote.state = { status: "signedOut" };
	releaseAccount();
	await second;
	expect(remote.pushCalls).toHaveLength(0);
});

test("the account id of the sync is sent with every push", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	await d.sync.refresh();
	expect(remote.pushAccounts).toEqual(["acc-1"]);
});

test("an unconfirmed account after an active one stops Sync and pushes nothing", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	remote.state = { ...UNCONFIRMED, accountId: "acc-2" };
	await d.sync.refresh();
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pushCalls).toHaveLength(0);
	expect(remote.pullCalls).toBe(1);
});

test("a different account starts from an empty snapshot", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	await d.sync.refresh();
	expect(remote.rows.codex).toEqual({ http: "correct" });
	d.sync.stop();
	remote.rows.codex = {};
	remote.state = { ...ACCOUNT, accountId: "acc-2" };
	// The player chose to add this device's progress to the new account.
	d.persist.writeSyncAccount("acc-2");
	await d.sync.refresh();
	expect(remote.rows.codex).toEqual({ http: "correct" });
	expect(d.persist.readSyncAccount()).toBe("acc-2");
});

test("an account id change while active is a new activation", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	await d.sync.refresh();
	remote.rows.codex = {};
	remote.state = { ...ACCOUNT, accountId: "acc-2" };
	// The player chose to add this device's progress to the new account.
	d.persist.writeSyncAccount("acc-2");
	await d.sync.refresh();
	expect(remote.rows.codex).toEqual({ http: "correct" });
});

test("overlapping refreshes run at most two syncs and the second sees a newer account state", async () => {
	const remote = createFakeRemote(UNCONFIRMED);
	const d = device(remote);
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	const release = remote.holdGetAccount();
	const first = d.sync.refresh();
	await settle();
	const second = d.sync.refresh();
	const third = d.sync.refresh();
	remote.state = ACCOUNT;
	release();
	await Promise.all([first, second, third]);
	expect(remote.pullCalls).toBe(1);
	expect(remote.rows.codex).toEqual({ http: "correct" });
});

test("a run with an invalid endedAt is never pushed", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	d.persist.writeBlitzRuns([
		run("not a date", 3),
		run("2026-09-29T10:00:00.000Z", 3),
	]);
	await d.sync.refresh();
	expect(remote.rows.runs.map((r) => r.endedAt)).toEqual([
		"2026-09-29T10:00:00.000Z",
	]);
});

test("every account read is reported, a failed one included", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	const seen: AccountReport[] = [];
	d.sync.onAccount((report) => seen.push(report));
	await d.sync.refresh();
	remote.state = { ...ACCOUNT, displayName: "Grace" };
	await d.sync.refresh();
	expect(
		seen.map((report) => report.status === "signedIn" && report.displayName),
	).toEqual(["Ada", "Grace"]);
	remote.failPull = true;
	await d.sync.refresh();
	expect(seen).toHaveLength(3);
	remote.failGetAccount = true;
	await d.sync.refresh();
	expect(seen[3]).toEqual({ status: "failed" });
	remote.failGetAccount = false;
	remote.state = { status: "signedOut" };
	await d.sync.refresh();
	expect(seen[4]).toEqual({ status: "signedOut" });
});

test("a listener added later gets the latest report at once", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	const early: AccountReport[] = [];
	d.sync.onAccount((report) => early.push(report));
	expect(early).toEqual([]);
	await d.sync.refresh();
	const late: AccountReport[] = [];
	d.sync.onAccount((report) => late.push(report));
	expect(late).toEqual([ACCOUNT]);
	expect(remote.getAccountCalls).toBe(1);
});

test("stop makes the kept report signed out without telling listeners", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	const seen: AccountReport[] = [];
	d.sync.onAccount((report) => seen.push(report));
	await d.sync.refresh();
	d.sync.stop();
	expect(seen).toEqual([ACCOUNT]);
	const late: AccountReport[] = [];
	d.sync.onAccount((report) => late.push(report));
	expect(late).toEqual([{ status: "signedOut" }]);
});

test("a read that a stop overtook is not reported", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	const seen: AccountReport[] = [];
	d.sync.onAccount((report) => seen.push(report));
	const release = remote.holdGetAccount();
	const running = d.sync.refresh();
	await settle();
	d.sync.stop();
	release();
	await running;
	expect(seen).toEqual([]);
});

test("an account that is gone is not reported as a failed read", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.gone = true;
	const d = device(remote);
	const seen: AccountReport[] = [];
	d.sync.onAccount((report) => seen.push(report));
	await d.sync.refresh();
	expect(seen).toEqual([]);
	expect(remote.signOutCalls).toBe(1);
});

test("deleteAccount clears the device and notifies only after the remote succeeded", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	d.persist.writeTheme("dark");
	const events: string[] = [];
	d.sync.onAccountDeleted(() => {
		events.push(
			`notified, codex keys ${Object.keys(d.persist.readCodex()).length}`,
		);
	});
	const release = remote.holdDeleteAccount();
	const deleting = d.sync.deleteAccount();
	await settle();
	expect(d.persist.readTheme()).toBe("dark");
	expect(events).toEqual([]);
	release();
	await deleting;
	expect(events).toEqual(["notified, codex keys 0"]);
	expect(d.store.data.size).toBe(0);
	expect(remote.rows.codex).toEqual({});
	expect(remote.deleteCalls).toBe(1);
});

test("a failed delete rejects, changes nothing, and sync resumes and pushes pending changes", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	const notified: number[] = [];
	d.sync.onAccountDeleted(() => notified.push(1));
	remote.failDeleteAccount = true;
	await expect(d.sync.deleteAccount()).rejects.toThrow("delete failed");
	expect(notified).toEqual([]);
	expect(d.persist.readCodex().http?.state).toBe("correct");
	await settle();
	expect(remote.rows.codex).toEqual({ http: "correct" });
	d.persist.writeCodex({ dns: { state: "correct", fresh: true } });
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.rows.codex).toEqual({ http: "correct", dns: "correct" });
});

test("an account already gone counts as a delete: the sign-in is dropped and the device is cleared", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	const notified: number[] = [];
	const gone: number[] = [];
	d.sync.onAccountDeleted(() => notified.push(1));
	d.sync.onAccountGone(() => gone.push(1));
	remote.gone = true;
	await d.sync.deleteAccount();
	expect(remote.signOutCalls).toBe(1);
	expect(notified).toEqual([1]);
	expect(gone).toEqual([]);
	expect(d.store.data.size).toBe(0);
});

test("a delete pauses sync: a queued task and a new refresh never read the account or report it gone", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	const releasePush = remote.holdPush();
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	// The push is held; a refresh queues a task behind it.
	const queued = d.sync.refresh();
	const gone: number[] = [];
	d.sync.onAccountGone(() => gone.push(1));
	const pullsBefore = remote.pullCalls;
	const releaseDelete = remote.holdDeleteAccount();
	const deleting = d.sync.deleteAccount();
	remote.gone = true;
	releasePush();
	await d.sync.refresh();
	releaseDelete();
	await deleting;
	await queued;
	expect(remote.pullCalls).toBe(pullsBefore);
	expect(gone).toEqual([]);
	expect(remote.signOutCalls).toBe(1);
	expect(d.store.data.size).toBe(0);
});

test("a pull held across the delete writes nothing after the clear", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.codex = { dns: "correct" };
	const d = device(remote);
	const release = remote.holdPull();
	const pulling = d.sync.refresh();
	await settle();
	await d.sync.deleteAccount();
	release();
	await pulling;
	await settle();
	expect(d.store.data.size).toBe(0);
});

test("a push held across the delete writes nothing after the clear", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	const release = remote.holdPush();
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.pushCalls).toHaveLength(1);
	await d.sync.deleteAccount();
	release();
	await settle();
	expect(d.store.data.size).toBe(0);
	expect(remote.pushCalls).toHaveLength(1);
});

test("a second delete call while one is held does nothing", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	const release = remote.holdDeleteAccount();
	const first = d.sync.deleteAccount();
	await d.sync.deleteAccount();
	release();
	await first;
	expect(remote.deleteCalls).toBe(1);
});

test("a new sync on the cleared device reads the signed-out account and does nothing", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	await d.sync.deleteAccount();
	const next = createSync({
		persist: d.persist,
		remote,
		clock: d.clock,
		utcToday: () => TODAY,
	});
	detachers.push(next.attach());
	const pulls = remote.pullCalls;
	await next.refresh();
	expect(remote.pullCalls).toBe(pulls);
	expect(d.store.data.size).toBe(0);
});

test("after a delete a refresh reads the signed-out account and pulls nothing, and the next sign-in syncs again", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	await d.sync.deleteAccount();
	const pulls = remote.pullCalls;
	await d.sync.refresh();
	expect(remote.pullCalls).toBe(pulls);
	remote.state = ACCOUNT;
	d.persist.writeCodex({ http: { state: "correct", fresh: true } });
	await d.sync.refresh();
	expect(remote.pullCalls).toBe(pulls + 1);
	expect(remote.rows.codex).toEqual({ http: "correct" });
});

test("a preference write is pushed after 1.5 seconds, and only that preference", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	d.persist.writeCodexSort("port");
	await d.sync.refresh();
	remote.pushCalls.length = 0;
	d.persist.writeTheme("dark");
	d.clock.advance(PUSH_DELAY_MS - 1);
	await settle();
	expect(remote.pushCalls).toHaveLength(0);
	d.clock.advance(1);
	await settle();
	expect(remote.pushCalls).toEqual([
		{
			codex: {},
			bests: {},
			runs: [],
			dailies: {},
			preferences: { theme: "dark" },
		},
	]);
	expect(d.persist.readSyncChanges().preferences).toEqual([]);
});

test("an unchanged old theme on a device that already synced does not overwrite a newer one", async () => {
	const rows = emptyRows();
	rows.preferences = { theme: "dark" };
	const remote = createFakeRemote(ACCOUNT, rows);
	const d = device(remote);
	d.persist.writeTheme("light");
	d.persist.writeSyncChanges({
		...d.persist.readSyncChanges(),
		preferences: [],
	});
	d.persist.writeSyncAccount("acc-1");
	await d.sync.refresh();
	expect(d.persist.readTheme()).toBe("dark");
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(rows.preferences).toEqual({ theme: "dark" });
	expect(remote.pushCalls).toHaveLength(0);
});

test("a preference changed while signed out survives the next sign-in's pull and is pushed", async () => {
	const rows = emptyRows();
	rows.preferences = { theme: "dark", codexSort: "port" };
	const remote = createFakeRemote({ status: "signedOut" }, rows);
	const d = device(remote);
	d.persist.writeSyncAccount("acc-1");
	await d.sync.refresh();
	d.persist.writeTheme("light");
	expect(d.clock.pending()).toBe(0);
	remote.state = ACCOUNT;
	await d.sync.refresh();
	expect(d.persist.readTheme()).toBe("light");
	expect(d.persist.readCodexSort()).toBe("port");
	expect(rows.preferences).toEqual({ theme: "light", codexSort: "port" });
	expect(remote.pushCalls[0]?.preferences).toEqual({ theme: "light" });
});

test("a preference without a pending change takes the account's value", async () => {
	const rows = emptyRows();
	rows.preferences = { theme: "dark", howToSeen: true, codexSort: "port" };
	const remote = createFakeRemote(ACCOUNT, rows);
	const d = device(remote);
	d.persist.writeSyncAccount("acc-1");
	await d.sync.refresh();
	expect(d.persist.readPreferences()).toEqual({
		theme: "dark",
		howToSeen: true,
		codexSort: "port",
	});
	expect(remote.pushCalls).toHaveLength(0);
	expect(d.persist.readSyncChanges().preferences).toEqual([]);
});

test("a device that never synced pushes its stored preferences and nothing for an unstored one", async () => {
	const rows = emptyRows();
	rows.preferences = { theme: "dark", codexSort: "port" };
	const remote = createFakeRemote(ACCOUNT, rows);
	const d = device(remote);
	d.persist.writeTheme("light");
	d.persist.writeHowToSeen();
	await d.sync.refresh();
	expect(remote.pushCalls[0]?.preferences).toEqual({
		theme: "light",
		howToSeen: true,
	});
	expect(rows.preferences).toEqual({
		theme: "light",
		howToSeen: true,
		codexSort: "port",
	});
	expect(d.persist.readCodexSort()).toBe("port");
});

test("a stored preference the account lacks is not pushed by a device that already synced", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	d.persist.writeTheme("light");
	d.persist.writeSyncChanges({
		...d.persist.readSyncChanges(),
		preferences: [],
	});
	d.persist.writeSyncAccount("acc-1");
	await d.sync.refresh();
	expect(d.persist.readTheme()).toBe("light");
	expect(remote.pushCalls).toHaveLength(0);
});

test("a write before the first pull marks only that preference", async () => {
	const rows = emptyRows();
	const remote = createFakeRemote(ACCOUNT, rows);
	const d = device(remote);
	d.persist.writeHowToSeen();
	d.persist.writeSyncAccount("acc-1");
	d.persist.writeSyncChanges({
		...d.persist.readSyncChanges(),
		preferences: [],
	});
	const release = remote.holdPull();
	const refreshing = d.sync.refresh();
	await settle();
	d.persist.writeTheme("dark");
	expect(d.persist.readSyncChanges().preferences).toEqual(["theme"]);
	release();
	await refreshing;
	expect(rows.preferences).toEqual({ theme: "dark" });
});

test("two devices converge on preferences, each preference on its own", async () => {
	const rows = emptyRows();
	const a = device(createFakeRemote(ACCOUNT, rows));
	const b = device(createFakeRemote(ACCOUNT, rows));
	await a.sync.refresh();
	await b.sync.refresh();
	a.persist.writeTheme("dark");
	b.persist.writeCodexSort("port");
	a.clock.advance(PUSH_DELAY_MS);
	await settle();
	b.clock.advance(PUSH_DELAY_MS);
	await settle();
	await a.sync.refresh();
	await b.sync.refresh();
	for (const side of [a, b]) {
		expect(side.persist.readTheme()).toBe("dark");
		expect(side.persist.readCodexSort()).toBe("port");
	}
	expect(rows.preferences).toEqual({ theme: "dark", codexSort: "port" });
});

test("a failed preference push stays pending and the next refresh retries it", async () => {
	const rows = emptyRows();
	const remote = createFakeRemote(ACCOUNT, rows);
	const d = device(remote);
	await d.sync.refresh();
	remote.failPush = true;
	d.persist.writeTheme("dark");
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(rows.preferences).toEqual({});
	expect(d.persist.readSyncChanges().preferences).toEqual(["theme"]);
	remote.failPush = false;
	await d.sync.refresh();
	expect(rows.preferences).toEqual({ theme: "dark" });
	expect(d.persist.readSyncChanges().preferences).toEqual([]);
});

test("account gone on a preference push signs the device out and keeps the preference", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	remote.gone = true;
	d.persist.writeTheme("dark");
	d.clock.advance(PUSH_DELAY_MS);
	await settle();
	expect(remote.signOutCalls).toBe(1);
	expect(d.persist.readTheme()).toBe("dark");
});

test("a pending device progress choice keeps Sync inactive until the account id is written", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	d.persist.writeSyncAccount("acc-other");
	d.persist.writeCodex({ http: { state: "correct", fresh: false } });
	await d.sync.refresh();
	d.clock.advance(PUSH_DELAY_MS);
	document.dispatchEvent(new Event("visibilitychange"));
	window.dispatchEvent(new Event("focus"));
	await settle();
	expect(remote.pullCalls).toBe(0);
	expect(remote.pushCalls).toHaveLength(0);
	d.persist.writeSyncAccount(ACCOUNT.accountId);
	await d.sync.refresh();
	expect(remote.pullCalls).toBe(1);
	expect(remote.rows.codex.http).toBe("correct");
});

test("an active Sync that sees another account with pending progress resets and pushes nothing", async () => {
	const remote = createFakeRemote(ACCOUNT);
	const d = device(remote);
	await d.sync.refresh();
	expect(remote.pullCalls).toBe(1);
	d.persist.writeCodex({ http: { state: "correct", fresh: false } });
	remote.state = { ...ACCOUNT, accountId: "acc-2" };
	await d.sync.refresh();
	expect(remote.pullCalls).toBe(1);
	d.persist.writeCodex({ http: { state: "missed", fresh: false } });
	await settle();
	expect(remote.pushCalls).toHaveLength(0);
});

test("the pending rule needs a different last synced account and importable rows", async () => {
	const persist = createPersist(memoryStore());
	const pending = () => deviceChoicePending(persist, "acc-1");
	persist.writeTheme("dark");
	persist.writeSyncAccount("acc-other");
	expect(pending()).toBe(false);
	persist.writeBlitzRuns([run("not a date", 1)]);
	expect(pending()).toBe(false);
	persist.writeBlitzRuns([run("2026-09-09T10:00:00.000Z", 1)]);
	expect(pending()).toBe(true);
	persist.writeSyncAccount("acc-1");
	expect(pending()).toBe(false);
	persist.clearAll();
	persist.writeDaily("mixed", "2026-09-09", PLAYING);
	expect(pending()).toBe(false);
	persist.writeSyncAccount("acc-other");
	expect(pending()).toBe(true);
	persist.clearAll();
	persist.writeSyncAccount("acc-other");
	persist.writeBlitzBests({ "mixed|default|sprint": { score: 1 } });
	expect(pending()).toBe(true);
});

test("a device with only Codex rows has a pending choice", () => {
	const persist = createPersist(memoryStore());
	persist.writeSyncAccount("acc-other");
	persist.writeCodex({ http: { state: "correct", fresh: false } });
	expect(deviceChoicePending(persist, "acc-1")).toBe(true);
});

test("a stored Daily that cannot be read is not progress", () => {
	const store = memoryStore();
	const persist = createPersist(store);
	persist.writeSyncAccount("acc-other");
	store.setItem("portdle:v1:daily:mixed:2026-09-09", "not json");
	expect(persist.readDaily("mixed", "2026-09-09")).toBeNull();
	expect(deviceChoicePending(persist, "acc-1")).toBe(false);
	persist.writeCodex({ http: { state: "correct", fresh: false } });
	expect(deviceChoicePending(persist, "acc-1")).toBe(true);
});

test("Add drops a theme changed while signed out, so the account's theme wins and nothing is pushed", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.preferences = { theme: "light" };
	const d = device(remote);
	d.persist.writeSyncAccount("acc-other");
	d.persist.writeCodex({ http: { state: "correct", fresh: false } });
	d.persist.writeTheme("dark");
	expect(d.persist.readSyncChanges().preferences).toEqual(["theme"]);
	expect(addDeviceProgress(d.persist, ACCOUNT.accountId)).toBe(true);
	expect(d.persist.readSyncChanges().preferences).toEqual([]);
	await d.sync.refresh();
	expect(d.persist.readTheme()).toBe("light");
	expect(
		remote.pushCalls.some((call) => Object.keys(call.preferences).length > 0),
	).toBe(false);
});

test("the same account signing back in still pushes its signed-out theme", async () => {
	const remote = createFakeRemote(ACCOUNT);
	remote.rows.preferences = { theme: "light" };
	const d = device(remote);
	d.persist.writeSyncAccount(ACCOUNT.accountId);
	d.persist.writeTheme("dark");
	await d.sync.refresh();
	expect(d.persist.readTheme()).toBe("dark");
	expect(remote.rows.preferences.theme).toBe("dark");
});
