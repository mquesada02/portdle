import type { RouterHistory } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { replayEarlyTap } from "../early-tap";
import { HYDRATED_ATTRIBUTE } from "../hydrated-attribute";
import type { Persist } from "../persist/storage";
import type { Remote } from "../remote/remote";
import { type AppRouter, type Backend, createAppRouter } from "../router";
import { createSync } from "../sync/sync";
import {
	attachRetryTriggers,
	createServerStore,
	type ServerStore,
} from "./server-store";

// What `App` and a client entry share: one router, one server store and one
// backend. The entry loads the router before it hydrates, so it must build
// these itself and hand them to `App`.
export type PreparedApp = {
	router: AppRouter;
	serverStore: ServerStore;
	backend: Backend | undefined;
	// Sets the function that the router context's `remount` calls. `App` sets
	// its own; before that, a `remount` call does nothing.
	setRemount: (remount: () => void) => void;
};

export function prepareApp(options: {
	persist: Persist;
	remote?: Remote;
	history?: RouterHistory;
	// The Blitz page deals its prompts from this source; a test scripts it.
	random?: () => number;
}): PreparedApp {
	const { persist, remote, history, random = Math.random } = options;
	const backend = remote && {
		remote,
		sync: createSync({ persist, remote }),
	};
	const serverStore = createServerStore(remote);
	let remount = () => {};
	const router = createAppRouter({
		persist,
		backend,
		remount: () => remount(),
		history,
		serverStore,
		random,
	});
	return {
		router,
		serverStore,
		backend,
		setRemount: (next) => {
			remount = next;
		},
	};
}

export type AppProps =
	| { prepared: PreparedApp }
	| {
			prepared?: undefined;
			persist: Persist;
			remote?: Remote;
			history?: RouterHistory;
			random?: () => number;
	  };

export function App(props: AppProps) {
	const given = props.prepared;
	const own = props.prepared ? undefined : props;
	const persist = own?.persist;
	const remote = own?.remote;
	const history = own?.history;
	const random = own?.random;
	const prepared = useMemo(
		() =>
			given ??
			// `persist` is set whenever `given` is not.
			prepareApp({ persist: persist as Persist, remote, history, random }),
		[given, persist, remote, history, random],
	);
	const { router, serverStore } = prepared;
	// Runs after the page has hydrated: effects run after the commit that
	// attached the app's handlers, so a tap stored before then can run now.
	useEffect(() => {
		document.documentElement.setAttribute(HYDRATED_ATTRIBUTE, "true");
		replayEarlyTap();
	}, []);
	useEffect(() => {
		serverStore.load();
		const detachRetry = attachRetryTriggers(serverStore.retry);
		const detach = serverStore.attach();
		return () => {
			detach();
			detachRetry();
		};
	}, [serverStore]);
	const sync = prepared.backend?.sync;
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
	useEffect(() => prepared.setRemount(remount), [prepared, remount]);
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
