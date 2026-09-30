import type { RouterHistory } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { utcDateString } from "../engine/utc";
import type { Persist } from "../persist/storage";
import type { Remote } from "../remote/remote";
import { createAppRouter } from "../router";
import { createSync } from "../sync/sync";

export function App({
	persist,
	remote,
	history,
	utcToday,
}: {
	persist: Persist;
	remote?: Remote;
	history?: RouterHistory;
	utcToday?: string;
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
	return <RouterProvider router={router} />;
}
