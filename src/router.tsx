import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	type RouterHistory,
} from "@tanstack/react-router";
import type { Persist } from "./persist/storage";
import { HelpPage } from "./ui/help-page";
import { PlaceholderPage } from "./ui/placeholder-page";
import { Shell } from "./ui/shell";

export type RouterContext = {
	persist: Persist;
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: Shell,
});

const mixedRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: function MixedPage() {
		return <PlaceholderPage title="Mixed" />;
	},
});

const protocolsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/protocols",
	component: function ProtocolsPage() {
		return <PlaceholderPage title="Protocols" />;
	},
});

const applicationsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/applications",
	component: function ApplicationsPage() {
		return <PlaceholderPage title="Applications" />;
	},
});

const blitzRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/blitz",
	component: function BlitzPage() {
		return <PlaceholderPage title="Blitz" />;
	},
});

const historyRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/history",
	component: function HistoryPage() {
		return <PlaceholderPage title="History" />;
	},
});

const helpRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/help",
	component: HelpPage,
});

const routeTree = rootRoute.addChildren([
	mixedRoute,
	protocolsRoute,
	applicationsRoute,
	blitzRoute,
	historyRoute,
	helpRoute,
]);

export function createAppRouter(options: {
	persist: Persist;
	history?: RouterHistory;
}) {
	return createRouter({
		routeTree,
		context: { persist: options.persist },
		basepath: "/portdle",
		history: options.history,
		defaultPendingMinMs: 0,
	});
}
