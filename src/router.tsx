import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	type RouterHistory,
	redirect,
} from "@tanstack/react-router";
import type { Persist } from "./persist/storage";
import type { Remote } from "./remote/remote";
import type { Sync } from "./sync/sync";
import { BlitzPage } from "./ui/blitz-page";
import { CodexPage } from "./ui/codex-page";
import { DailyPage } from "./ui/daily-page";
import { HistoryPage } from "./ui/history-page";
import { screenFor } from "./ui/nav";
import type { ServerStore } from "./ui/server-store";
import { Shell } from "./ui/shell";

// Absent on a build with no hosted backend; present, it holds both halves.
export type Backend = { remote: Remote; sync: Sync };

export type RouterContext = {
	persist: Persist;
	backend?: Backend;
	remount: () => void;
	serverStore: ServerStore;
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
	component: function HistoryDailyPage() {
		return <HistoryPage segment="daily" />;
	},
});

const historyBlitzRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/history/blitz",
	component: function HistoryBlitzPage() {
		return <HistoryPage segment="blitz" />;
	},
});

const codexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/codex",
	component: CodexPage,
});

// The Help page is gone; this route stays registered only so the old
// address keeps resolving, redirecting straight to the Daily.
const helpRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/help",
	beforeLoad: () => {
		throw redirect({ to: "/" });
	},
});

const routeTree = rootRoute.addChildren([
	mixedRoute,
	protocolsRoute,
	applicationsRoute,
	blitzRoute,
	historyRoute,
	historyBlitzRoute,
	codexRoute,
	helpRoute,
]);

export function createAppRouter(options: {
	persist: Persist;
	backend?: Backend;
	remount: () => void;
	history?: RouterHistory;
	serverStore: ServerStore;
}) {
	return createRouter({
		routeTree,
		context: {
			persist: options.persist,
			backend: options.backend,
			remount: options.remount,
			serverStore: options.serverStore,
		},
		basepath: "/portdle",
		history: options.history,
		defaultPendingMinMs: 0,
		defaultViewTransition: {
			types: ({ fromLocation, toLocation }) => {
				// No prior location means the initial page load, not a nav or
				// wordmark tap; play no transition rather than animate a fresh
				// page's first paint.
				if (!fromLocation) {
					return false;
				}
				if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
					return false;
				}
				const fromScreen = screenFor(fromLocation.pathname);
				const toScreen = screenFor(toLocation.pathname);
				return fromScreen === toScreen ? ["switcher"] : ["screen"];
			},
		},
	});
}
