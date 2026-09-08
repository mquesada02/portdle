import type { RouterHistory } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
import type { Persist } from "../persist/storage";
import { createAppRouter } from "../router";

export function App({
	persist,
	history,
}: {
	persist: Persist;
	history?: RouterHistory;
}) {
	const router = useMemo(
		() => createAppRouter({ persist, history }),
		[persist, history],
	);
	return <RouterProvider router={router} />;
}
