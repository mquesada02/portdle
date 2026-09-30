import type { RouterHistory } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { utcDateString } from "../engine/utc";
import type { Persist } from "../persist/storage";
import type { Remote } from "../remote/remote";
import { createAppRouter } from "../router";
import { createSync } from "../sync/sync";

function AppSession({
	persist,
	remote,
	history,
	utcToday,
	onAccountDeleted,
}: {
	persist: Persist;
	remote?: Remote;
	history?: RouterHistory;
	utcToday?: string;
	onAccountDeleted: () => void;
}) {
	const [clockToday, setClockToday] = useState(
		() => utcToday ?? utcDateString(new Date()),
	);
	useEffect(() => {
		if (utcToday !== undefined) {
			setClockToday(utcToday);
			return;
		}
		function refresh() {
			setClockToday(utcDateString(new Date()));
		}
		document.addEventListener("visibilitychange", refresh);
		window.addEventListener("focus", refresh);
		return () => {
			document.removeEventListener("visibilitychange", refresh);
			window.removeEventListener("focus", refresh);
		};
	}, [utcToday]);
	const utcTodayRef = useRef(utcToday);
	utcTodayRef.current = utcToday;
	const sync = useMemo(
		() =>
			remote
				? createSync({
						persist,
						remote,
						utcToday: () => utcTodayRef.current ?? utcDateString(new Date()),
					})
				: undefined,
		[persist, remote],
	);
	useEffect(() => {
		if (!sync) {
			return;
		}
		const detach = sync.attach();
		void sync.refresh();
		return detach;
	}, [sync]);
	const router = useMemo(
		() =>
			createAppRouter({ persist, remote, sync, history, utcToday: clockToday }),
		[persist, remote, sync, history, clockToday],
	);
	// Runs inside the deletion, before the remount: the new session's router
	// reads this address, so it opens the Daily, not the deleted-from screen.
	useEffect(
		() =>
			sync?.onAccountDeleted(() => {
				router.history.replace(`${router.basepath}/`);
				onAccountDeleted();
			}),
		[sync, router, onAccountDeleted],
	);
	return <RouterProvider router={router} />;
}

// Deleting the account remounts the whole session, so the screen, the theme,
// the How-to, and the sync module start from the cleared store.
export function App(props: {
	persist: Persist;
	remote?: Remote;
	history?: RouterHistory;
	utcToday?: string;
}) {
	const [generation, setGeneration] = useState(0);
	const remount = useCallback(() => setGeneration((g) => g + 1), []);
	return <AppSession key={generation} {...props} onAccountDeleted={remount} />;
}
