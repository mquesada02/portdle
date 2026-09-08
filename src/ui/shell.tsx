import { Link, Outlet, useRouteContext } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { HowTo } from "./how-to";
import { syncUtcDay } from "./sync-utc";
import {
	applyHtmlTheme,
	effectiveTheme,
	oppositeTheme,
	prefersDarkScheme,
} from "./theme";

const NAV = [
	{ to: "/", label: "Mixed" },
	{ to: "/protocols", label: "Protocols" },
	{ to: "/applications", label: "Applications" },
	{ to: "/blitz", label: "Blitz" },
	{ to: "/history", label: "History" },
	{ to: "/help", label: "Help" },
] as const;

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

export function Shell() {
	const { persist, utcToday } = useRouteContext({ from: "__root__" });
	const [storedTheme, setStoredTheme] = useState(() => persist.readTheme());
	const [howToOpen, setHowToOpen] = useState(() => !persist.readHowToSeen());
	const [saveWarning, setSaveWarning] = useState(false);
	const effective = effectiveTheme(storedTheme, prefersDarkScheme());

	useLayoutEffect(() => {
		applyHtmlTheme(effective);
	}, [effective]);

	useEffect(() => {
		const synced = syncUtcDay(persist, utcToday);
		if (!synced.ok) {
			setSaveWarning(true);
		}
	}, [persist, utcToday]);

	return (
		<div className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
			<header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
				<nav aria-label="Main" className="flex flex-wrap gap-3">
					{NAV.map((item) => (
						<Link
							key={item.to}
							to={item.to}
							className="underline-offset-4 hover:underline"
						>
							{item.label}
						</Link>
					))}
				</nav>
				<button
					type="button"
					aria-label="Toggle color theme"
					className="rounded p-1"
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
			</header>
			{saveWarning ? (
				<p className="px-4 py-2 text-sm" role="status">
					Progress may not save.
				</p>
			) : null}
			<div className="px-4 py-6">
				<Outlet />
			</div>
			<HowTo
				open={howToOpen}
				onDismiss={() => {
					const result = persist.writeHowToSeen();
					if (!result.ok) {
						setSaveWarning(true);
					}
					setHowToOpen(false);
				}}
			/>
		</div>
	);
}
