// PROTOTYPE — throwaway. Icon paths copied from src/ui/shell.tsx for visual
// parity; not wired to real theme/how-to behavior. See issue #126.

export const GRID = "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z";
export const BOLT = "M13 3 4 14h7l-1 7 9-11h-7l1-7z";
export const CLOCK = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2";
export const BOOK =
	"M4 5.5a1.5 1.5 0 0 1 1.5-1.5H11a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5zM20 5.5a1.5 1.5 0 0 0-1.5-1.5H13a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h5.5a1.5 1.5 0 0 0 1.5-1.5z";
export const TROPHY =
	"M8 4h8v3a4 4 0 0 1-8 0zM8 4H5a3 3 0 0 0 3 5M16 4h3a3 3 0 0 1-3 5M12 11v4M9 19h6M10 19v2h4v-2";
export const HELP =
	"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01";
export const PERSON =
	"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-4 5-6 8-6s6.5 2 8 6";

export function NavIcon({ d }: { d: string }) {
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

export function SunIcon() {
	return (
		<svg aria-hidden="true" viewBox="0 0 24 24" width="1.25rem" height="1.25rem">
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

export const ICON_BUTTON =
	"rounded-full p-2 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800";
