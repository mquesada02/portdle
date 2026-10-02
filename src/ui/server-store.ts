import { entryById } from "../engine/catalog";
import { nextUtcMidnightMs } from "../engine/utc";
import type { Catalog, CurrentDailies, Remote } from "../remote/remote";
import { type SyncClock, systemClock } from "../sync/sync";

export type Loadable<T> =
	| { status: "loading" }
	| { status: "ready"; value: T }
	| { status: "failed" };

export type ServerData = {
	catalog: Loadable<Catalog>;
	dailies: Loadable<CurrentDailies>;
};

export type ServerStore = {
	getSnapshot(): ServerData;
	subscribe(listener: () => void): () => void;
	// Starts the one load; later calls do nothing.
	load(): void;
	// Reloads the reads that have failed. A read that is loading or ready is
	// left alone, so a loaded screen never goes back to loading.
	retry(): void;
	// Counts a loaded catalog as failed, for a catalog that lacks an entry the
	// current Dailies name. A retry then reloads it.
	rejectCatalog(): void;
	// Reads the current Dailies again. A newer read always supersedes an older
	// one, which is then dropped.
	refreshDailies(): Promise<void>;
	// Starts the midnight timer and the focus read; the returned function
	// stops them. A second call while attached does nothing.
	attach(): () => void;
};

// A focus read counts only from the last successful read of the Dailies, and
// has its own throttle, apart from the sync pull's.
export const FOCUS_READ_THROTTLE_MS = 30000;

// A read that has not settled after this long counts as failed.
export const READ_TIMEOUT_MS = 10_000;

// Turns a read into a Loadable. A read that fails, or does not settle within
// READ_TIMEOUT_MS, counts as failed. The returned function drops a result that
// arrives after it is called, and so does the timeout.
export function settle<T>(
	request: Promise<T>,
	set: (state: Loadable<T>) => void,
): () => void {
	let cancelled = false;
	function finish(state: Loadable<T>) {
		if (!cancelled) {
			cancelled = true;
			clearTimeout(timer);
			set(state);
		}
	}
	const timer = setTimeout(() => finish({ status: "failed" }), READ_TIMEOUT_MS);
	request.then(
		(value) => finish({ status: "ready", value }),
		() => finish({ status: "failed" }),
	);
	return () => {
		cancelled = true;
		clearTimeout(timer);
	};
}

// Runs `retry` when the connection comes back and when the player returns to
// the tab. No throttle: the callers retry only reads that have failed.
export function attachRetryTriggers(retry: () => void): () => void {
	function onVisibility() {
		if (document.visibilityState === "visible") {
			retry();
		}
	}
	window.addEventListener("online", retry);
	window.addEventListener("focus", retry);
	document.addEventListener("visibilitychange", onVisibility);
	return () => {
		window.removeEventListener("online", retry);
		window.removeEventListener("focus", retry);
		document.removeEventListener("visibilitychange", onVisibility);
	};
}

// Holds what the app reads from the server: the catalog and the current
// Dailies. Outside the router, so a read never remounts a screen. With no
// remote (a build with no backend) both reads count as failed.
//
// After every applied Dailies read one timer waits for the next UTC midnight
// by the server's time of that read, replacing any pending timer. A focus read
// follows the 30-second throttle; the timer's read never does. A failed read
// after a success changes nothing, and nothing retries it on a timer.
export function createServerStore(
	remote?: Remote,
	clock: SyncClock = systemClock,
): ServerStore {
	let data: ServerData = remote
		? { catalog: { status: "loading" }, dailies: { status: "loading" } }
		: { catalog: { status: "failed" }, dailies: { status: "failed" } };
	const listeners = new Set<() => void>();
	let started = false;
	let attached = false;
	let sequence = 0;
	// Whether the newest started read has not settled.
	let inFlight = false;
	// When the last applied read finished (clock time) and its server time;
	// null until a read is applied.
	let lastSuccess: { at: number; serverNow: number } | null = null;
	let timer: unknown = null;
	// The pending catalog read that a retry started, so a newer one replaces it.
	let cancelCatalog: (() => void) | null = null;

	// Each change replaces the snapshot, so `getSnapshot` is stable between
	// changes.
	function set(next: Partial<ServerData>) {
		data = { ...data, ...next };
		for (const listener of listeners) {
			listener();
		}
	}

	function clearTimer() {
		if (timer !== null) {
			clock.clearTimeout(timer);
			timer = null;
		}
	}

	// The delay is measured from the server's time of the read plus the clock
	// time since the read finished, so a wrong device date never moves it.
	function armTimer() {
		clearTimer();
		if (!attached || !lastSuccess) {
			return;
		}
		const nowByServer = lastSuccess.serverNow + (clock.now() - lastSuccess.at);
		const delay = nextUtcMidnightMs(lastSuccess.serverNow) - nowByServer;
		timer = clock.setTimeout(
			() => {
				timer = null;
				void refreshDailies();
			},
			Math.max(0, delay),
		);
	}

	// A read that fails, or does not settle in time, rejects.
	function within<T>(request: Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			settle(request, (state) =>
				state.status === "ready"
					? resolve(state.value)
					: reject(new Error("read failed")),
			);
		});
	}

	// A new read cancels the one before it, so only the newest request can set
	// the catalog.
	function readCatalog(remote: Remote) {
		cancelCatalog?.();
		cancelCatalog = settle(remote.readCatalog(), (catalog) => set({ catalog }));
	}

	function missesEntry(catalog: Catalog, dailies: CurrentDailies): boolean {
		return Object.values(dailies.entryIds).some(
			(id) => !entryById(catalog.protocols, catalog.applications, id),
		);
	}

	// One read is the whole sequence: the Dailies, the catalog once more when a
	// loaded catalog lacks an entry of the Dailies, then apply. Only the newest
	// read may apply, so the check comes after the last await.
	async function refreshDailies(): Promise<void> {
		if (!remote) {
			return;
		}
		const mine = ++sequence;
		inFlight = true;
		// Only a read after a loaded Daily may reload the catalog: a missing entry
		// on the first load or a retry is the Daily's own panel (`rejectCatalog`).
		const background = data.dailies.status === "ready";
		try {
			const dailies = await within(remote.readCurrentDailies());
			const loaded = data.catalog;
			const catalog =
				background &&
				loaded.status === "ready" &&
				missesEntry(loaded.value, dailies)
					? await within(remote.readCatalog())
					: undefined;
			if (mine !== sequence) {
				return;
			}
			lastSuccess = { at: clock.now(), serverNow: dailies.serverNow };
			if (catalog) {
				cancelCatalog?.();
			}
			set({
				dailies: { status: "ready", value: dailies },
				...(catalog && { catalog: { status: "ready", value: catalog } }),
			});
			armTimer();
		} catch {
			if (mine === sequence && data.dailies.status !== "ready") {
				set({ dailies: { status: "failed" } });
			}
		} finally {
			if (mine === sequence) {
				inFlight = false;
			}
		}
	}

	// A failed or loading read is the retry's: while a panel can show, a focus
	// is a retry, not a focus read.
	function onFocus() {
		if (
			inFlight ||
			data.dailies.status !== "ready" ||
			data.catalog.status !== "ready"
		) {
			return;
		}
		if (lastSuccess !== null) {
			// A clock that went back counts as a lapsed throttle.
			const elapsed = clock.now() - lastSuccess.at;
			if (elapsed >= 0 && elapsed < FOCUS_READ_THROTTLE_MS) {
				return;
			}
		}
		void refreshDailies();
	}

	function onVisibility() {
		if (document.visibilityState === "visible") {
			onFocus();
		}
	}

	return {
		getSnapshot: () => data,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		load() {
			if (started || !remote) {
				return;
			}
			started = true;
			readCatalog(remote);
			void refreshDailies();
		},
		rejectCatalog() {
			if (data.catalog.status === "ready") {
				set({ catalog: { status: "failed" } });
			}
		},
		retry() {
			if (!remote) {
				return;
			}
			const catalog = data.catalog.status === "failed";
			const dailies = data.dailies.status === "failed";
			if (!catalog && !dailies) {
				return;
			}
			if (catalog) {
				readCatalog(remote);
			}
			if (dailies) {
				void refreshDailies();
			}
			set({
				...(catalog && { catalog: { status: "loading" as const } }),
				...(dailies && { dailies: { status: "loading" as const } }),
			});
		},
		refreshDailies,
		attach() {
			if (attached) {
				return () => {};
			}
			attached = true;
			window.addEventListener("focus", onFocus);
			document.addEventListener("visibilitychange", onVisibility);
			armTimer();
			return () => {
				attached = false;
				window.removeEventListener("focus", onFocus);
				document.removeEventListener("visibilitychange", onVisibility);
				clearTimer();
			};
		},
	};
}

// The reads a screen needs as one: failed if any failed, else loading if any
// is still loading, else ready with every value.
export function allReady<T extends unknown[]>(
	...needs: { [K in keyof T]: Loadable<T[K]> }
): Loadable<T> {
	if (needs.some((need) => need.status === "failed")) {
		return { status: "failed" };
	}
	if (needs.some((need) => need.status === "loading")) {
		return { status: "loading" };
	}
	return {
		status: "ready",
		value: needs.map((need) => (need as { value: unknown }).value) as T,
	};
}
