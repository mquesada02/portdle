import { useRouteContext } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import type { ServerData } from "./server-store";

export function useServerData(): ServerData {
	const { serverStore } = useRouteContext({ from: "__root__" });
	return useSyncExternalStore(serverStore.subscribe, serverStore.getSnapshot);
}

// What a screen shows while the server data is not ready.
// TEMPORARY (approved stand-in): this plain failure line has no retry. The
// shared error panel of ticket #187 replaces it.
export function LoadStatus({ state }: { state: "loading" | "failed" }) {
	return (
		<p role="status" className="py-16 text-center text-sm">
			{state === "loading" ? "Loading..." : "Could not load puzzles."}
		</p>
	);
}
