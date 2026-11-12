import type { RouterHistory } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Persist } from "../persist/storage";
import type { Remote } from "../remote/remote";
import { type AppRouter, type Backend, createAppRouter } from "../router";
import { createSync } from "../sync/sync";
import { attachRetryTriggers, createServerStore } from "./server-store";

export function App({
	persist,
	remote,
	history,
	random = Math.random,
}: {
	persist: Persist;
	remote?: Remote;
	history?: RouterHistory;
	// The Blitz page deals its prompts from this source; a test scripts it.
	random?: () => number;
}) {
	const backend = useMemo<Backend | undefined>(
		() =>
			remote && {
				remote,
				sync: createSync({ persist, remote }),
			},
		[persist, remote],
	);
	const serverStore = useMemo(() => createServerStore(remote), [remote]);
	useEffect(() => {
		serverStore.load();
		const detachRetry = attachRetryTriggers(serverStore.retry);
		const detach = serverStore.attach();
		return () => {
			detach();
			detachRetry();
		};
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
				serverStore,
				random,
			}),
		[persist, backend, remount, history, serverStore, random],
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
	return appTree(router, generation);
}

// The tree that players get, for a given router. `generation` is the remount
// key. The server render of a route and its hydration build the same tree.
export function appTree(router: AppRouter, generation: number) {
	return <RouterProvider key={generation} router={router} />;
}
