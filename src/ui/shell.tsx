import {
	Link,
	Outlet,
	useLinkProps,
	useRouteContext,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { HowTo } from "./how-to";
import { ProgressNotice } from "./notice";
import { syncUtcDay } from "./sync-utc";
import {
	applyHtmlTheme,
	effectiveTheme,
	oppositeTheme,
	prefersDarkScheme,
} from "./theme";

const GRID = "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z";
const BOLT = "M13 3 4 14h7l-1 7 9-11h-7l1-7z";
const CLOCK = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2";
const HELP =
	"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01";

const NAV = [
	{
		to: "/",
		label: "Daily",
		icon: GRID,
		matchPaths: ["/", "/protocols", "/applications"],
	},
	{ to: "/blitz", label: "Blitz", icon: BOLT, matchPaths: ["/blitz"] },
	{
		to: "/history",
		label: "History",
		icon: CLOCK,
		matchPaths: ["/history", "/history/blitz"],
	},
] as const;

function NavIcon({ d }: { d: string }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d={d} />
		</svg>
	);
}

function SunIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			width="1.25rem"
			height="1.25rem"
		>
			<circle cx="12" cy="12" r="4" fill="currentColor" />
			<path
				d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
				stroke="currentColor"
				strokeWidth="2"
				fill="none"
			/>
		</svg>
	);
}

function MoonIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			width="1.25rem"
			height="1.25rem"
		>
			<path
				d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"
				fill="currentColor"
			/>
		</svg>
	);
}

const ICON_BUTTON =
	"rounded-full p-2 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800";

export function Shell() {
	const { persist, utcToday } = useRouteContext({ from: "__root__" });
	const [storedTheme, setStoredTheme] = useState(() => persist.readTheme());
	const [howToOpen, setHowToOpen] = useState(() => !persist.readHowToSeen());
	const [saveWarning, setSaveWarning] = useState(false);
	const effective = effectiveTheme(storedTheme, prefersDarkScheme());
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	// The wordmark always links to Daily; it is not a "current page" indicator,
	// so the router's auto-injected aria-current/data-status are dropped.
	const wordmarkAllProps = useLinkProps({ to: "/", activeProps: {} }) as Record<
		string,
		unknown
	>;
	const {
		"aria-current": _wordmarkAriaCurrent,
		"data-status": _wordmarkDataStatus,
		...wordmarkLinkProps
	} = wordmarkAllProps;

	useLayoutEffect(() => {
		applyHtmlTheme(effective);
	}, [effective]);

	useEffect(() => {
		const synced = syncUtcDay(persist, utcToday);
		if (!synced.ok) {
			setSaveWarning(true);
		}
	}, [persist, utcToday]);

	function dismissHowTo() {
		const result = persist.writeHowToSeen();
		if (!result.ok) {
			setSaveWarning(true);
		}
		setHowToOpen(false);
	}

	return (
		<div className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
			<header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
				<div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
					<a
						{...wordmarkLinkProps}
						className="flex items-center gap-2 text-lg font-bold tracking-tight"
					>
						<span aria-hidden="true" className="grid grid-cols-2 gap-0.5">
							<span className="h-2 w-2 rounded-[2px] bg-zinc-400 dark:bg-zinc-600" />
							<span className="h-2 w-2 rounded-[2px] bg-emerald-500" />
							<span className="h-2 w-2 rounded-[2px] bg-emerald-500" />
							<span className="h-2 w-2 rounded-[2px] bg-zinc-400 dark:bg-zinc-600" />
						</span>
						Portdle
					</a>
					<nav
						aria-label="Main"
						className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-zinc-200 bg-zinc-50 pb-[env(safe-area-inset-bottom)] md:static md:flex md:gap-1 md:border-0 md:bg-transparent md:pb-0 dark:border-zinc-800 dark:bg-zinc-950"
					>
						{NAV.map((item) => {
							const isActive = (item.matchPaths as readonly string[]).includes(
								pathname,
							);
							return (
								<Link
									key={item.to}
									to={item.to}
									activeOptions={{ exact: true }}
									activeProps={{}}
									aria-current={isActive ? "page" : undefined}
									className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-medium md:flex-row md:rounded-full md:px-3 md:py-1.5 md:text-sm ${
										isActive
											? "text-zinc-900 dark:text-zinc-100 md:bg-zinc-200 md:dark:bg-zinc-800"
											: "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
									}`}
								>
									<span className="md:hidden">
										<NavIcon d={item.icon} />
									</span>
									{item.label}
								</Link>
							);
						})}
					</nav>
					<div className="flex items-center gap-1">
						<button
							type="button"
							aria-label="How to play"
							className={ICON_BUTTON}
							onClick={() => setHowToOpen(true)}
						>
							<NavIcon d={HELP} />
						</button>
						<button
							type="button"
							aria-label="Toggle color theme"
							className={ICON_BUTTON}
							onClick={() => {
								const next = oppositeTheme(effective);
								const result = persist.writeTheme(next);
								if (!result.ok) {
									setSaveWarning(true);
								}
								setStoredTheme(next);
							}}
						>
							{effective === "dark" ? <MoonIcon /> : <SunIcon />}
						</button>
					</div>
				</div>
			</header>
			<div className="mx-auto max-w-3xl px-4 pt-6 pb-24 md:pb-6">
				<ProgressNotice show={saveWarning} />
				<Outlet />
			</div>
			<HowTo open={howToOpen} onDismiss={dismissHowTo} />
		</div>
	);
}
