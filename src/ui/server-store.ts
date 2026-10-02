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

// Turns a read into a Loadable. The returned function drops a result that
// arrives after it is called.
export function settle<T>(
	request: Promise<T>,
	set: (state: Loadable<T>) => void,
): () => void {
	let cancelled = false;
	request.then(
		(value) => {
			if (!cancelled) {
				set({ status: "ready", value });
			}
		},
		() => {
			if (!cancelled) {
				set({ status: "failed" });
			}
		},
	);
	return () => {
		cancelled = true;
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
		try {
			const dailies = await remote.readCurrentDailies();
			const loaded = data.catalog;
			const catalog =
				loaded.status === "ready" && missesEntry(loaded.value, dailies)
					? await remote.readCatalog()
					: undefined;
			if (mine !== sequence) {
				return;
			}
			lastSuccess = { at: clock.now(), serverNow: dailies.serverNow };
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

	function onFocus() {
		if (inFlight) {
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
			settle(remote.readCatalog(), (catalog) => set({ catalog }));
			void refreshDailies();
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
