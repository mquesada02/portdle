import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	type RouterHistory,
} from "@tanstack/react-router";
import type { Persist } from "./persist/storage";
import { BlitzPage } from "./ui/blitz-page";
import { DailyPage } from "./ui/daily-page";
import { HelpPage } from "./ui/help-page";
import { PlaceholderPage } from "./ui/placeholder-page";
import { Shell } from "./ui/shell";

export type RouterContext = {
	persist: Persist;
	utcToday: string;
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: Shell,
});

const mixedRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: function MixedPage() {
		return <DailyPage category="mixed" />;
	},
});

const protocolsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/protocols",
	component: function ProtocolsPage() {
		return <DailyPage category="protocols" />;
	},
});

const applicationsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/applications",
	component: function ApplicationsPage() {
		return <DailyPage category="applications" />;
	},
});

const blitzRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/blitz",
	component: BlitzPage,
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
	utcToday: string;
}) {
	return createRouter({
		routeTree,
		context: { persist: options.persist, utcToday: options.utcToday },
		basepath: "/portdle",
		history: options.history,
		defaultPendingMinMs: 0,
	});
}
