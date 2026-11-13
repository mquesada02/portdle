import { createMemoryHistory } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { createPersist, type KeyValueStore } from "./persist/storage";
import { remoteFromEnv } from "./remote/from-env";
import { appTree, prepareApp } from "./ui/app";

// The server entry of the prerender: the build runs it in Node, once per page
// route, and writes the markup into the route's file. The first render reads
// no stored state, so a store that holds nothing gives the frame that every
// visitor shares.
const EMPTY_STORE: KeyValueStore = {
	length: 0,
	key: () => null,
	getItem: () => null,
	setItem: () => {},
	removeItem: () => {},
};

// What the Supabase remote reads from the browser when it is made, for a
// build with a backend. Node has no browser, so the remote gets inert ones:
// no stored session, no auth redirect in the address, and a `fetch` that fails,
// so the prerender makes no request (the first render starts none).
const SERVER_DEPS = {
	storage: EMPTY_STORE,
	location: {
		pathname: "/",
		search: "",
		hash: "",
		origin: "https://prerender.invalid",
	},
	history: { replaceState: () => {} },
	fetch: () => Promise.reject(new Error("The prerender makes no request.")),
};

const BASE = "/portdle";

// `path` is a route path without the base, with an optional query, such as
// `/archive/board?category=mixed&date=2026-10-09`.
export async function renderRoute(path: string): Promise<string> {
	const { router } = prepareApp({
		persist: createPersist(EMPTY_STORE),
		remote: remoteFromEnv(SERVER_DEPS),
		history: createMemoryHistory({ initialEntries: [`${BASE}${path}`] }),
	});
	await router.load();
	return renderToString(appTree(router, 0));
}

// The paths of the router's routes that render a page, without the base. A
// route with no component (the redirect from /help) renders nothing.
export const pageRoutePaths: string[] = Object.entries(
	prepareApp({ persist: createPersist(EMPTY_STORE) }).router.routesByPath,
)
	.filter(([, route]) => route.options.component !== undefined)
	.map(([path]) => path);
