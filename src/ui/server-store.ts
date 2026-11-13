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
	// The state the store was created in, whatever it holds now: what the
	// server render shows, and what a hydrating render must read.
	getInitialSnapshot(): ServerData;
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

// Turns a read into a Loadable. The read gets a signal that stops its request.
// A read that fails, or does not settle within READ_TIMEOUT_MS, counts as
// failed. The timeout sets the state, then aborts the request. The returned
// function aborts the request and drops a late result. `done` flips before
// every abort, so the rejection that the abort causes changes nothing.
export function settle<T>(
	read: (signal: AbortSignal) => Promise<T>,
	set: (state: Loadable<T>) => void,
): () => void {
	const controller = new AbortController();
	let done = false;
	function end(state: Loadable<T> | undefined, abort: boolean) {
		if (done) {
			return;
		}
		done = true;
		clearTimeout(timer);
		try {
			if (state) {
				set(state);
			}
		} finally {
			if (abort) {
				controller.abort();
			}
		}
	}
	// Set before `read` runs: `end` may run during that call.
	const timer = setTimeout(
		() => end({ status: "failed" }, true),
		READ_TIMEOUT_MS,
	);
	try {
		read(controller.signal).then(
			(value) => end({ status: "ready", value }, false),
			() => end({ status: "failed" }, false),
		);
	} catch {
		end({ status: "failed" }, false);
	}
	return () => end(undefined, true);
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
	const initial = data;
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
	// Cancels the Dailies read in progress (one step of `refreshDailies`), so a
	// newer read replaces it.
	let cancelDailiesRead: (() => void) | null = null;

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

	// A read that fails, does not settle in time, or is cancelled rejects. The
	// cancel handle is set before `settle` runs, so it works during `settle`.
	function within<T>(read: (signal: AbortSignal) => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			let cancel: (() => void) | undefined;
			cancelDailiesRead = () => {
				cancel?.();
				reject(new Error("read cancelled"));
			};
			cancel = settle(read, (state) =>
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
		cancelCatalog = settle(
			(signal) => remote.readCatalog(signal),
			(catalog) => set({ catalog }),
		);
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
		// Aborts the request of the read that this one replaces.
		cancelDailiesRead?.();
		inFlight = true;
		// Only a read after a loaded Daily may reload the catalog: a missing entry
		// on the first load or a retry is the Daily's own panel (`rejectCatalog`).
		const background = data.dailies.status === "ready";
		try {
			const dailies = await within((signal) =>
				remote.readCurrentDailies(signal),
			);
			// A newer read may start between the two steps: stop before the
			// second catalog read, which would replace its cancel handle.
			if (mine !== sequence) {
				return;
			}
			const loaded = data.catalog;
			const catalog =
				background &&
				loaded.status === "ready" &&
				missesEntry(loaded.value, dailies)
					? await within((signal) => remote.readCatalog(signal))
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
		getInitialSnapshot: () => initial,
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
