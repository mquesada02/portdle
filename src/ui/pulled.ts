import { useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import type { PersistChange } from "../persist/storage";

// Calls `onPulled` after a sync pull wrote a stored row that `shows` matches,
// so a mounted screen reads its rows again instead of keeping the ones it read
// at mount. With no backend nothing is ever pulled.
export function usePulled(
	shows: (change: PersistChange) => boolean,
	onPulled: () => void,
): void {
	const { backend } = useRouteContext({ from: "__root__" });
	const sync = backend?.sync;
	const latest = useRef({ shows, onPulled });
	latest.current = { shows, onPulled };
	useEffect(
		() =>
			sync?.onPulled((changes: PersistChange[]) => {
				if (changes.some(latest.current.shows)) {
					latest.current.onPulled();
				}
			}),
		[sync],
	);
}
