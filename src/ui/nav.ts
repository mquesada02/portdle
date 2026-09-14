const GRID = "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z";
const BOLT = "M13 3 4 14h7l-1 7 9-11h-7l1-7z";
const CLOCK = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2";
const BOOK =
	"M4 5.5a1.5 1.5 0 0 1 1.5-1.5H11a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5zM20 5.5a1.5 1.5 0 0 0-1.5-1.5H13a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h5.5a1.5 1.5 0 0 0 1.5-1.5z";

export const NAV = [
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
	{ to: "/codex", label: "Codex", icon: BOOK, matchPaths: ["/codex"] },
] as const;

// Looks up which nav screen a pathname belongs to, via NAV's own
// matchPaths, mirroring the lookup the shell's active-link highlighting
// already does.
export function screenFor(pathname: string): string | undefined {
	return NAV.find((item) =>
		(item.matchPaths as readonly string[]).includes(pathname),
	)?.to;
}
