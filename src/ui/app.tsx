import type { RouterHistory } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
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
	const today = utcToday ?? utcDateString(new Date());
	const router = useMemo(
		() => createAppRouter({ persist, history, utcToday: today }),
		[persist, history, today],
	);
	return <RouterProvider router={router} />;
}
