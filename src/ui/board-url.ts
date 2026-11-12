// The one source of Archive board URLs: /archive/board?category=<c>&date=<d>.

// The props of a link to one board, for `<Link {...boardLink(category, date)} />`.
export function boardLink(category: string, date: string) {
	return { to: "/archive/board", search: { category, date } } as const;
}

export type BoardSearch = { category: string; date: string };

// The route's `validateSearch`. A value that is not a string (missing, or
// parsed by the router as a number, array or object) becomes "", which no
// board has, so the page shows its note for an unknown board. It never throws.
export function parseBoardSearch(search: Record<string, unknown>): BoardSearch {
	const text = (value: unknown) => (typeof value === "string" ? value : "");
	return { category: text(search.category), date: text(search.date) };
}
