import { useRouteContext } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import type { ServerData } from "./server-store";

export function useServerData(): ServerData {
	const { serverStore } = useRouteContext({ from: "__root__" });
	return useSyncExternalStore(serverStore.subscribe, serverStore.getSnapshot);
}

function subscribeOnline(listener: () => void): () => void {
	window.addEventListener("online", listener);
	window.addEventListener("offline", listener);
	return () => {
		window.removeEventListener("online", listener);
		window.removeEventListener("offline", listener);
	};
}

// The shared panel a screen shows in place of its content when the catalog or
// the current Dailies could not load. The message follows the connection.
export function ErrorPanel() {
	const { serverStore } = useRouteContext({ from: "__root__" });
	const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine);
	return (
		<div role="status" className="py-16 text-center text-sm">
			<p>
				{online
					? "Portdle's server isn't answering. Try again in a moment."
					: "You're offline. Portdle needs a connection to load puzzles."}
			</p>
			<button
				type="button"
				className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
				onClick={serverStore.retry}
			>
				Try again
			</button>
		</div>
	);
}

// What a screen shows while the server data is not ready.
export function LoadStatus({ state }: { state: "loading" | "failed" }) {
	if (state === "failed") {
		return <ErrorPanel />;
	}
	return (
		<p role="status" className="py-16 text-center text-sm">
			Loading...
		</p>
	);
}
