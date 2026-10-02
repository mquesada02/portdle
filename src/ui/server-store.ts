import type { Catalog, CurrentDailies, Remote } from "../remote/remote";

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
};

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

// Holds what the app reads from the server at start: the catalog and the
// current Dailies. Outside the router, so a load never remounts a screen. With
// no remote (a build with no backend) both reads count as failed.
export function createServerStore(remote?: Remote): ServerStore {
	let data: ServerData = remote
		? { catalog: { status: "loading" }, dailies: { status: "loading" } }
		: { catalog: { status: "failed" }, dailies: { status: "failed" } };
	const listeners = new Set<() => void>();
	let started = false;
	const cancels: Partial<Record<keyof ServerData, () => void>> = {};

	// Each change replaces the snapshot, so `getSnapshot` is stable between
	// changes.
	function set(next: Partial<ServerData>) {
		data = { ...data, ...next };
		for (const listener of listeners) {
			listener();
		}
	}

	// A new read cancels the one before it, so only the newest request can set
	// the state.
	function readCatalog(remote: Remote) {
		cancels.catalog?.();
		cancels.catalog = settle(remote.readCatalog(), (catalog) =>
			set({ catalog }),
		);
	}

	function readDailies(remote: Remote) {
		cancels.dailies?.();
		cancels.dailies = settle(remote.readCurrentDailies(), (dailies) =>
			set({ dailies }),
		);
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
			readDailies(remote);
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
				readDailies(remote);
			}
			set({
				...(catalog && { catalog: { status: "loading" as const } }),
				...(dailies && { dailies: { status: "loading" as const } }),
			});
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
