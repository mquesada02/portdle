// PROTOTYPE — throwaway shell chrome shared by all three placement variants.
// Copies src/ui/shell.tsx's top-bar/nav markup for visual parity; nav is
// plain <a href> (URL-param navigation), not the real router. See #126.
import type { ReactNode } from "react";
import { ICON_BUTTON, NavIcon, SunIcon } from "./icons";

export type NavItem = { key: string; label: string; icon: string; href: string; active: boolean };

export function href(params: Record<string, string | undefined>): string {
	const current = new URLSearchParams(window.location.search);
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined) {
			current.delete(key);
		} else {
			current.set(key, value);
		}
	}
	return `?${current.toString()}`;
}

export function PrototypeShell({
	navItems,
	accountSlot,
	children,
}: {
	navItems: NavItem[];
	accountSlot: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
			<header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
				<div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
					<a
						href={href({})}
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
						className="fixed inset-x-0 bottom-0 z-10 grid border-t border-zinc-200 bg-zinc-50 pb-[env(safe-area-inset-bottom)] md:static md:flex md:gap-1 md:border-0 md:bg-transparent md:pb-0 dark:border-zinc-800 dark:bg-zinc-950"
						style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
					>
						{navItems.map((item) => (
							<a
								key={item.key}
								href={item.href}
								aria-current={item.active ? "page" : undefined}
								className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-medium transition-colors md:flex-row md:rounded-full md:px-3 md:py-1.5 md:text-sm ${
									item.active
										? "text-zinc-900 dark:text-zinc-100 md:bg-zinc-200 md:dark:bg-zinc-800"
										: "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
								}`}
							>
								<span className="md:hidden">
									<NavIcon d={item.icon} />
								</span>
								{item.label}
							</a>
						))}
					</nav>
					<div className="flex items-center gap-1">
						<button type="button" aria-label="How to play" className={ICON_BUTTON}>
							<NavIcon d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01" />
						</button>
						<button type="button" aria-label="Toggle color theme" className={ICON_BUTTON}>
							<SunIcon />
						</button>
						{accountSlot}
					</div>
				</div>
			</header>
			<div className="relative mx-auto max-w-3xl px-4 pt-6 pb-24 md:pb-6">{children}</div>
		</div>
	);
}

const VARIANTS = [
	{ key: "A", label: "Leaderboards inside Blitz" },
	{ key: "B", label: "Leaderboards as 5th nav item" },
	{ key: "C", label: "Account menu hosts both" },
];

export function PrototypeSwitcher({ variant }: { variant: string }) {
	if (import.meta.env.PROD) {
		return null;
	}
	const index = Math.max(0, VARIANTS.findIndex((v) => v.key === variant));
	// biome-ignore lint/style/noNonNullAssertion: index is always in bounds via modulo over the fixed VARIANTS array
	const prev = VARIANTS[(index - 1 + VARIANTS.length) % VARIANTS.length]!;
	// biome-ignore lint/style/noNonNullAssertion: index is always in bounds via modulo over the fixed VARIANTS array
	const next = VARIANTS[(index + 1) % VARIANTS.length]!;
	// biome-ignore lint/style/noNonNullAssertion: index is always in bounds via modulo over the fixed VARIANTS array
	const current = VARIANTS[index]!;
	return (
		<div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-lg md:bottom-4 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-200">
			<a href={href({ variant: prev.key })} aria-label="Previous variant" className="px-1">
				←
			</a>
			<span>
				{current.key} — {current.label}
			</span>
			<a href={href({ variant: next.key })} aria-label="Next variant" className="px-1">
				→
			</a>
		</div>
	);
}
