import type { RouterHistory } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { utcDateString } from "../engine/utc";
import type { Persist } from "../persist/storage";
import { createAppRouter } from "../router";

export function App({
	persist,
	history,
	utcToday,
}: {
	persist: Persist;
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
	const router = useMemo(
		() => createAppRouter({ persist, history, utcToday: clockToday }),
		[persist, history, clockToday],
	);
	return <RouterProvider router={router} />;
}
