import { useRouteContext } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import type { ServerData } from "./server-store";

export function useServerData(): ServerData {
	const { serverStore } = useRouteContext({ from: "__root__" });
	// The server render and a hydrating render read the creation state, so they
	// match whatever the store holds by then: React can hydrate a Suspense
	// boundary after the first commit, whose effects start `load()`. React reads
	// the live snapshot right after hydration.
	return useSyncExternalStore(
		serverStore.subscribe,
		serverStore.getSnapshot,
		serverStore.getInitialSnapshot,
	);
}

function subscribeOnline(listener: () => void): () => void {
	window.addEventListener("online", listener);
	window.addEventListener("offline", listener);
	return () => {
		window.removeEventListener("online", listener);
		window.removeEventListener("offline", listener);
	};
}

export const SERVER_MESSAGE =
	"Portdle's server isn't answering. Try again in a moment.";
export const OFFLINE_MESSAGE =
	"You're offline. Portdle needs a connection to load puzzles.";

// The shared panel a screen shows in place of its content when the catalog or
// the current Dailies could not load. The message follows the connection.
export function ErrorPanel({ onRetry }: { onRetry?: () => void }) {
	const { serverStore } = useRouteContext({ from: "__root__" });
	// The server render and hydration assume online; the client reads the
	// connection right after.
	const online = useSyncExternalStore(
		subscribeOnline,
		() => navigator.onLine,
		() => true,
	);
	return (
		<div role="status" className="py-16 text-center text-sm">
			<p>{online ? SERVER_MESSAGE : OFFLINE_MESSAGE}</p>
			<button
				type="button"
				className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
				onClick={onRetry ?? serverStore.retry}
			>
				Try again
			</button>
		</div>
	);
}

// What a screen shows while the server data is not ready.
export function LoadStatus({
	state,
	onRetry,
}: {
	state: "loading" | "failed";
	onRetry?: () => void;
}) {
	if (state === "failed") {
		return <ErrorPanel onRetry={onRetry} />;
	}
	return (
		<p role="status" className="py-16 text-center text-sm">
			Loading...
		</p>
	);
}
