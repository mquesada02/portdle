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

	function read<T>(
		request: Promise<T>,
		assign: (state: Loadable<T>) => Partial<ServerData>,
	) {
		request.then(
			(value) => set(assign({ status: "ready", value })),
			() => set(assign({ status: "failed" })),
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
			read(remote.readCatalog(), (catalog) => ({ catalog }));
			read(remote.readCurrentDailies(), (dailies) => ({ dailies }));
		},
	};
}

// The state of the reads a screen needs: failed if any failed, else loading if
// any is still loading.
export function loadState(
	...needs: Array<Loadable<unknown>>
): "loading" | "failed" | "ready" {
	if (needs.some((need) => need.status === "failed")) {
		return "failed";
	}
	return needs.some((need) => need.status === "loading") ? "loading" : "ready";
}
