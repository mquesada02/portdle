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
};

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

// Holds what the app reads from the server at start: the catalog and the
// current Dailies. Outside the router, so a load never remounts a screen. With
// no remote (a build with no backend) both reads count as failed.
export function createServerStore(remote?: Remote): ServerStore {
	let data: ServerData = remote
		? { catalog: { status: "loading" }, dailies: { status: "loading" } }
		: { catalog: { status: "failed" }, dailies: { status: "failed" } };
	const listeners = new Set<() => void>();
	let started = false;

	// Each change replaces the snapshot, so `getSnapshot` is stable between
	// changes.
	function set(next: Partial<ServerData>) {
		data = { ...data, ...next };
		for (const listener of listeners) {
			listener();
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
			settle(remote.readCurrentDailies(), (dailies) => set({ dailies }));
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
