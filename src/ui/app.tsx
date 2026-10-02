import type { RouterHistory } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { utcDateString } from "../engine/utc";
import type { Persist } from "../persist/storage";
import type { Remote } from "../remote/remote";
import { type Backend, createAppRouter } from "../router";
import { createSync } from "../sync/sync";
import { attachRetryTriggers, createServerStore } from "./server-store";

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
	const backend = useMemo<Backend | undefined>(
		() =>
			remote && {
				remote,
				sync: createSync({
					persist,
					remote,
					utcToday: () => utcTodayRef.current ?? utcDateString(new Date()),
				}),
			},
		[persist, remote],
	);
	const serverStore = useMemo(() => createServerStore(remote), [remote]);
	useEffect(() => {
		serverStore.load();
		return attachRetryTriggers(serverStore.retry);
	}, [serverStore]);
	const sync = backend?.sync;
	useEffect(() => {
		if (!sync) {
			return;
		}
		const detach = sync.attach();
		void sync.refresh();
		return detach;
	}, [sync]);
	// A remount rebuilds every screen, so nothing typed before a device clear
	// can write cleared data back.
	const [generation, setGeneration] = useState(0);
	const remount = useCallback(() => setGeneration((count) => count + 1), []);
	const router = useMemo(
		() =>
			createAppRouter({
				persist,
				backend,
				remount,
				history,
				utcToday: clockToday,
				serverStore,
			}),
		[persist, backend, remount, history, clockToday, serverStore],
	);
	// The router moves to the Daily before the remount, so the remount opens
	// the Daily, not the screen the player deleted from, and no screen mounts
	// on the cleared store as the old location.
	useEffect(
		() =>
			sync?.onAccountDeleted(() => {
				void router
					.navigate({ to: "/", replace: true, viewTransition: false })
					.catch(() => {})
					.finally(remount);
			}),
		[sync, router, remount],
	);
	return <RouterProvider key={generation} router={router} />;
}
