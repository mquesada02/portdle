import { dailyKey, parseDailyKey } from "../engine/daily-key";
import {
	foldStats,
	mergeBests,
	mergeCodex,
	mergeDaily,
	mergeRuns,
} from "../engine/merge";
import {
	type CodexSort,
	DAILY_CATEGORIES,
	type DailyCategory,
	type DailyPersist,
} from "../engine/types";
import { isValidTimestamp, isValidUtcDate } from "../engine/utc";
import type {
	Persist,
	PersistChange,
	Preferences,
	SyncChanges,
	Theme,
} from "../persist/storage";
import {
	AccountGoneError,
	type AccountState,
	type Remote,
	type SyncedRows,
} from "../remote/remote";
import { deviceChoicePending } from "./device-progress";

export const PUSH_DELAY_MS = 1500;
// A pull from the tab regaining focus or becoming visible is skipped when the
// last successful pull finished less than this long ago.
export const PULL_THROTTLE_MS = 30000;

export type SyncClock = {
	now(): number;
	setTimeout(callback: () => void, ms: number): unknown;
	clearTimeout(handle: unknown): void;
};

export const systemClock: SyncClock = {
	now: () => Date.now(),
	setTimeout: (callback, ms) => setTimeout(callback, ms),
	clearTimeout: (handle) => clearTimeout(handle as number),
};

// What one account read produced, as sync reports it.
export type AccountReport = AccountState | { status: "failed" };

export type Sync = {
	attach(): () => void;
	refresh(): Promise<void>;
	stop(): void;
	accountGone(): Promise<void>;
	// Deletes the account, then clears the device and tells the listeners.
	// Rejects, changing nothing, when the delete fails.
	deleteAccount(): Promise<void>;
	onAccountDeleted(listener: () => void): () => void;
	onAccountGone(listener: () => void): () => void;
	// Runs after each account read sync makes (the load read included), and at
	// once with the latest report when added, so a late listener needs no read.
	onAccount(listener: (report: AccountReport) => void): () => void;
};

type Kind = "codex" | "bests" | "runs" | "dailies" | "preferences";
const KINDS: Kind[] = ["codex", "bests", "runs", "dailies", "preferences"];

// Each key is both a preference and the kind of its persist change.
const PREFERENCE_KEYS: Array<keyof Preferences & PersistChange["kind"]> = [
	"theme",
	"howToSeen",
	"codexSort",
];

// Object keys sorted, so a record that a database returned with its keys
// reordered still compares equal to the local copy.
function canonical(value: unknown): string {
	return JSON.stringify(value, (_key, item: unknown) =>
		item !== null && typeof item === "object" && !Array.isArray(item)
			? Object.fromEntries(
					Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
				)
			: item,
	);
}

function emptySnapshot(): Record<Kind, Map<string, string>> {
	return {
		codex: new Map(),
		bests: new Map(),
		runs: new Map(),
		dailies: new Map(),
		preferences: new Map(),
	};
}

export function createSync(options: {
	persist: Persist;
	remote: Remote;
	clock?: SyncClock;
	utcToday: () => string;
}): Sync {
	const { persist, remote, utcToday } = options;
	const clock = options.clock ?? systemClock;

	let epoch = 0;
	let activeAccount: string | null = null;
	// When the last pull finished successfully; null when none did.
	let lastPullAt: number | null = null;
	// Survives `reset`; `stop` (the session ended) makes it signed out.
	let latestReport: AccountReport | null = null;
	let writing = false;
	let timer: unknown = null;
	let running: Promise<void> | null = null;
	let rerun = false;
	// Set while an account deletion runs.
	let deleting = false;
	let queue: Promise<unknown> = Promise.resolve();
	let snapshot = emptySnapshot();
	const goneListeners = new Set<() => void>();
	const deletedListeners = new Set<() => void>();
	const accountListeners = new Set<(report: AccountReport) => void>();

	function enqueue(task: () => Promise<void>): Promise<void> {
		const next = queue.then(task, task);
		queue = next.catch(() => {});
		return next;
	}

	// Every epoch change drops in-flight results, the snapshot, and the timer.
	function reset() {
		epoch += 1;
		activeAccount = null;
		lastPullAt = null;
		snapshot = emptySnapshot();
		if (timer !== null) {
			clock.clearTimeout(timer);
			timer = null;
		}
	}

	// `only` limits the Dailies read to the given keys (a full read parses
	// every stored Daily).
	function localRows(kind: Kind, only?: string[]): Map<string, unknown> {
		const rows = new Map<string, unknown>();
		if (kind === "codex") {
			for (const [id, record] of Object.entries(persist.readCodex())) {
				rows.set(id, record.state);
			}
		} else if (kind === "bests") {
			for (const [key, best] of Object.entries(persist.readBlitzBests())) {
				rows.set(key, best);
			}
		} else if (kind === "runs") {
			for (const run of persist.readBlitzRuns()) {
				if (isValidTimestamp(run.endedAt)) {
					rows.set(run.endedAt, run);
				}
			}
		} else if (kind === "preferences") {
			const stored = persist.readPreferences();
			for (const key of only ?? PREFERENCE_KEYS) {
				const value = stored[key as keyof Preferences];
				if (value !== undefined) {
					rows.set(key, value);
				}
			}
		} else {
			const keys =
				only ??
				DAILY_CATEGORIES.flatMap((category) =>
					persist
						.listDailyDates(category)
						.map((date) => dailyKey(category, date)),
				);
			for (const key of keys) {
				const [category, date] = parseDailyKey(key);
				const daily = persist.readDaily(category, date);
				if (daily && isValidUtcDate(date)) {
					rows.set(key, daily);
				}
			}
		}
		return rows;
	}

	// Adds the rows that differ from the account's copy to the bookkeeping.
	function mark(kind: Kind, rows: Map<string, unknown>): boolean {
		const known = snapshot[kind];
		const changed: string[] = [];
		for (const [key, value] of rows) {
			if (canonical(value) !== known.get(key)) {
				changed.push(key);
			}
		}
		if (changed.length === 0) {
			return false;
		}
		addPending(kind, changed);
		return true;
	}

	function addPending(kind: Kind, keys: string[]) {
		const changes = persist.readSyncChanges();
		const merged = new Set([...changes[kind], ...keys]);
		if (merged.size !== changes[kind].length) {
			persist.writeSyncChanges({ ...changes, [kind]: [...merged] });
		}
	}

	function onWrite(change: PersistChange) {
		if (writing) {
			return;
		}
		if (PREFERENCE_KEYS.some((key) => key === change.kind)) {
			// Without an active account there is no snapshot to compare with, so
			// the change is remembered and the next pull keeps it. It schedules
			// no push: the next refresh sends it.
			if (activeAccount === null) {
				addPending("preferences", [change.kind]);
			} else if (mark("preferences", localRows("preferences", [change.kind]))) {
				schedulePush();
			}
			return;
		}
		if (activeAccount === null) {
			return;
		}
		let kind: Kind;
		let rows: Map<string, unknown>;
		if (change.kind === "codex") {
			kind = "codex";
			rows = localRows("codex");
		} else if (change.kind === "blitzBests") {
			kind = "bests";
			rows = localRows("bests");
		} else if (change.kind === "blitzRuns") {
			kind = "runs";
			rows = localRows("runs");
		} else if (change.kind === "daily") {
			kind = "dailies";
			rows = localRows("dailies", [dailyKey(change.category, change.date)]);
		} else {
			return;
		}
		if (mark(kind, rows)) {
			schedulePush();
		}
	}

	function schedulePush() {
		if (timer !== null) {
			clock.clearTimeout(timer);
		}
		const scheduledEpoch = epoch;
		timer = clock.setTimeout(() => {
			timer = null;
			if (epoch !== scheduledEpoch) {
				return;
			}
			if (lastPullAt === null) {
				refresh();
				return;
			}
			enqueue(() => pushPending(scheduledEpoch)).catch(() => {});
		}, PUSH_DELAY_MS);
	}

	// A device that never synced counts every stored preference as a local
	// change, so it can replace the account's value once.
	function applyPull(rows: SyncedRows, firstSync: boolean) {
		const changedCategories = new Set<DailyCategory>();
		if (firstSync) {
			addPending("preferences", Object.keys(persist.readPreferences()));
		}
		writing = true;
		try {
			const codex = persist.readCodex();
			const mergedCodex = mergeCodex(codex, rows.codex);
			if (canonical(mergedCodex) !== canonical(codex)) {
				persist.writeCodex(mergedCodex);
			}
			const bests = persist.readBlitzBests();
			const mergedBests = mergeBests(bests, rows.bests);
			if (canonical(mergedBests) !== canonical(bests)) {
				persist.writeBlitzBests(mergedBests);
			}
			const runs = persist.readBlitzRuns();
			const mergedRuns = mergeRuns(runs, rows.runs);
			if (canonical(mergedRuns) !== canonical(runs)) {
				persist.writeBlitzRuns(mergedRuns);
			}
			for (const [key, account] of Object.entries(rows.dailies)) {
				const [category, date] = parseDailyKey(key);
				if (!DAILY_CATEGORIES.includes(category) || !isValidUtcDate(date)) {
					continue;
				}
				const local = persist.readDaily(category, date);
				const merged = local ? mergeDaily(local, account) : account;
				if (local === null || canonical(merged) !== canonical(local)) {
					persist.writeDaily(category, date, merged);
					changedCategories.add(category);
				}
			}
			for (const category of changedCategories) {
				rebuildStats(category);
			}
			// A preference with a change not yet pushed keeps its local value.
			const pending = new Set(persist.readSyncChanges().preferences);
			const local = persist.readPreferences();
			for (const key of PREFERENCE_KEYS) {
				const value = rows.preferences[key];
				if (value !== undefined && !pending.has(key) && value !== local[key]) {
					writePreference(key, value);
				}
			}
		} finally {
			writing = false;
		}
		snapshot = emptySnapshot();
		for (const [id, state] of Object.entries(rows.codex)) {
			snapshot.codex.set(id, canonical(state));
		}
		for (const [key, best] of Object.entries(rows.bests)) {
			snapshot.bests.set(key, canonical(best));
		}
		for (const run of rows.runs) {
			snapshot.runs.set(run.endedAt, canonical(run));
		}
		for (const [key, daily] of Object.entries(rows.dailies)) {
			snapshot.dailies.set(key, canonical(daily));
		}
		for (const [key, value] of Object.entries(rows.preferences)) {
			snapshot.preferences.set(key, canonical(value));
		}
	}

	function writePreference(
		key: keyof Preferences,
		value: NonNullable<Preferences[keyof Preferences]>,
	) {
		if (key === "theme") {
			persist.writeTheme(value as Theme);
		} else if (key === "howToSeen") {
			persist.writeHowToSeen();
		} else {
			persist.writeCodexSort(value as CodexSort);
		}
	}

	function rebuildStats(category: DailyCategory) {
		const dailies: Record<string, DailyPersist> = {};
		for (const date of persist.listDailyDates(category)) {
			const daily = persist.readDaily(category, date);
			if (daily) {
				dailies[date] = daily;
			}
		}
		const { stats, lastPlayed } = foldStats({
			dailies,
			utcToday: utcToday(),
		});
		if (lastPlayed !== null) {
			persist.writeStats(category, stats);
			persist.writeLastPlayed(category, lastPlayed);
		}
	}

	async function pushPending(pushEpoch: number): Promise<void> {
		if (epoch !== pushEpoch || lastPullAt === null) {
			return;
		}
		const pushAccount = activeAccount;
		if (pushAccount === null) {
			return;
		}
		const changes = persist.readSyncChanges();
		if (KINDS.every((kind) => changes[kind].length === 0)) {
			return;
		}
		const rows: SyncedRows = {
			codex: {},
			bests: {},
			runs: [],
			dailies: {},
			preferences: {},
		};
		const sent = emptySnapshot();
		for (const kind of KINDS) {
			if (changes[kind].length === 0) {
				continue;
			}
			const local = localRows(kind, changes[kind]);
			for (const key of changes[kind]) {
				const value = local.get(key);
				if (value === undefined) {
					continue;
				}
				const text = canonical(value);
				if (text === snapshot[kind].get(key)) {
					continue;
				}
				sent[kind].set(key, text);
				if (kind === "codex") {
					rows.codex[key] = value as SyncedRows["codex"][string];
				} else if (kind === "bests") {
					rows.bests[key as keyof SyncedRows["bests"]] = value as never;
				} else if (kind === "runs") {
					rows.runs.push(value as SyncedRows["runs"][number]);
				} else if (kind === "dailies") {
					rows.dailies[key] = value as DailyPersist;
				} else {
					rows.preferences[key as keyof Preferences] = value as never;
				}
			}
		}
		if (KINDS.some((kind) => sent[kind].size > 0)) {
			try {
				await remote.push(pushAccount, rows);
			} catch (error) {
				await handleFailure(error, pushEpoch);
				return;
			}
			if (epoch !== pushEpoch) {
				return;
			}
			for (const kind of KINDS) {
				for (const [key, text] of sent[kind]) {
					snapshot[kind].set(key, text);
				}
			}
		}
		// Drop what is now on the account; a row that changed during the call
		// stays pending.
		const current = persist.readSyncChanges();
		const next: SyncChanges = { ...current };
		for (const kind of KINDS) {
			if (current[kind].length === 0) {
				continue;
			}
			const local = localRows(kind, current[kind]);
			next[kind] = current[kind].filter((key) => {
				const value = local.get(key);
				return (
					value !== undefined && canonical(value) !== snapshot[kind].get(key)
				);
			});
		}
		if (canonical(next) !== canonical(current)) {
			persist.writeSyncChanges(next);
		}
		// A row that changed during the call is still pending.
		if (timer === null && anyPending(next)) {
			schedulePush();
		}
	}

	async function handleFailure(error: unknown, failedEpoch: number) {
		if (error instanceof AccountGoneError && epoch === failedEpoch) {
			await accountGone();
		}
	}

	async function syncOnce(): Promise<void> {
		// A task queued before the delete began starts with the new epoch.
		if (deleting) {
			return;
		}
		const startEpoch = epoch;
		let account: AccountState;
		try {
			account = await remote.getAccount();
		} catch (error) {
			if (epoch === startEpoch && !(error instanceof AccountGoneError)) {
				report({ status: "failed" });
			}
			await handleFailure(error, startEpoch);
			return;
		}
		if (epoch !== startEpoch) {
			return;
		}
		report(account);
		if (account.status === "signedOut") {
			if (activeAccount !== null) {
				await accountGone();
			}
			return;
		}
		if (deviceChoicePending(persist, account.accountId)) {
			// The player has not chosen what happens to this device's progress.
			if (activeAccount !== null) {
				reset();
			}
			return;
		}
		if (!account.nameConfirmed) {
			// Another tab may have signed in as someone whose name is unconfirmed.
			if (activeAccount !== null) {
				reset();
			}
			return;
		}
		if (activeAccount !== account.accountId) {
			reset();
			activeAccount = account.accountId;
		}
		const pullEpoch = epoch;
		let rows: SyncedRows;
		try {
			rows = await remote.pull();
		} catch (error) {
			await handleFailure(error, pullEpoch);
			return;
		}
		if (epoch !== pullEpoch) {
			return;
		}
		applyPull(rows, persist.readSyncAccount() === null);
		lastPullAt = clock.now();
		persist.writeSyncAccount(account.accountId);
		// Preferences are marked only by writes and the first-sync import.
		for (const kind of KINDS) {
			if (kind !== "preferences") {
				mark(kind, localRows(kind));
			}
		}
		await pushPending(pullEpoch);
	}

	function refresh(): Promise<void> {
		if (deleting) {
			return Promise.resolve();
		}
		if (running) {
			rerun = true;
			return running;
		}
		running = (async () => {
			do {
				rerun = false;
				await enqueue(syncOnce).catch(() => {});
			} while (rerun);
		})().finally(() => {
			running = null;
		});
		return running;
	}

	function report(next: AccountReport) {
		latestReport = next;
		for (const listener of accountListeners) {
			listener(next);
		}
	}

	function anyPending(changes: SyncChanges): boolean {
		return KINDS.some((kind) => changes[kind].length > 0);
	}

	// A focus or visibility pull is skipped while one is in flight, or when the
	// last successful one is recent; a row still waiting to be pushed lets it
	// through, so a failed push is retried.
	function pullThrottled(): boolean {
		const elapsed = clock.now() - (lastPullAt ?? Number.NEGATIVE_INFINITY);
		const recent = elapsed >= 0 && elapsed < PULL_THROTTLE_MS;
		return (
			(running !== null || recent) && !anyPending(persist.readSyncChanges())
		);
	}

	function refreshUnlessThrottled() {
		if (!pullThrottled()) {
			void refresh();
		}
	}

	function stop() {
		reset();
		latestReport = { status: "signedOut" };
		rerun = false;
	}

	async function accountGone() {
		stop();
		try {
			await remote.signOut();
		} catch {
			// The sign-in stays stored; the next open reads it again.
		}
		for (const listener of goneListeners) {
			listener();
		}
	}

	async function deleteAccount() {
		if (deleting) {
			return;
		}
		deleting = true;
		stop();
		try {
			await remote.deleteAccount();
		} catch (error) {
			if (!(error instanceof AccountGoneError)) {
				deleting = false;
				void refresh();
				throw error;
			}
			// The account is already gone, which is what the player asked for.
			try {
				await remote.signOut();
			} catch {
				// The sign-in stays stored; the next open reads it again.
			}
		}
		// The remount keeps this sync, so it must work for the next sign-in.
		deleting = false;
		persist.clearAll();
		for (const listener of deletedListeners) {
			listener();
		}
	}

	return {
		attach() {
			const unlisten = persist.onWrite(onWrite);
			function onVisibility() {
				if (document.visibilityState === "visible") {
					refreshUnlessThrottled();
				}
			}
			function onFocus() {
				refreshUnlessThrottled();
			}
			document.addEventListener("visibilitychange", onVisibility);
			window.addEventListener("focus", onFocus);
			return () => {
				unlisten();
				document.removeEventListener("visibilitychange", onVisibility);
				window.removeEventListener("focus", onFocus);
				stop();
			};
		},
		refresh,
		stop,
		accountGone,
		deleteAccount,
		onAccountDeleted(listener) {
			deletedListeners.add(listener);
			return () => {
				deletedListeners.delete(listener);
			};
		},
		onAccountGone(listener) {
			goneListeners.add(listener);
			return () => {
				goneListeners.delete(listener);
			};
		},
		onAccount(listener) {
			accountListeners.add(listener);
			if (latestReport !== null) {
				listener(latestReport);
			}
			return () => {
				accountListeners.delete(listener);
			};
		},
	};
}
