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
import { ArchiveBoardPage, ArchivePage } from "./ui/archive-page";
import { BlitzPage } from "./ui/blitz-page";
import { CodexPage } from "./ui/codex-page";
import { DailyPage, ROUTE_FOR } from "./ui/daily-page";
import { HISTORY_SEGMENTS, HistoryPage } from "./ui/history-page";
import type { ServerStore } from "./ui/server-store";
import { Shell } from "./ui/shell";

// The paths of each switcher's links. A change between two paths of one
// switcher is a switcher change: only its content region rises. Every other
// change, the Archive's included, is a screen change, because the frame
// around the content changes too (#246).
const SWITCHER_PATHS: string[][] = [
	Object.values(ROUTE_FOR),
	HISTORY_SEGMENTS.map((segment) => segment.to),
];

function isSwitcherChange(from: string, to: string): boolean {
	return (
		from === to ||
		SWITCHER_PATHS.some((paths) => paths.includes(from) && paths.includes(to))
	);
}

// Absent on a build with no hosted backend; present, it holds both halves.
export type Backend = { remote: Remote; sync: Sync };

export type RouterContext = {
	persist: Persist;
	backend?: Backend;
	remount: () => void;
	serverStore: ServerStore;
	random: () => number;
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

const archiveRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/archive",
	component: ArchivePage,
});

const archiveBoardRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/archive/$category/$date",
	component: function ArchiveBoard() {
		const { category, date } = archiveBoardRoute.useParams();
		return <ArchiveBoardPage category={category} date={date} />;
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
	archiveRoute,
	archiveBoardRoute,
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
	random: () => number;
}) {
	return createRouter({
		routeTree,
		context: {
			persist: options.persist,
			backend: options.backend,
			remount: options.remount,
			serverStore: options.serverStore,
			random: options.random,
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
				return isSwitcherChange(fromLocation.pathname, toLocation.pathname)
					? ["switcher"]
					: ["screen"];
			},
		},
	});
}
