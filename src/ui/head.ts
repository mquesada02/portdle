// The head texts of each router route that renders a page, keyed by the
// route id (the route's full path). The tab title follows this table in the
// app. This file imports nothing, because the e2e suite imports it too; a
// later import here would break that suite.

export type Head = {
	title: string;
	description: string;
	// Null for the Archive board: one file serves every board, so its
	// canonical depends on its params (see boardCanonical).
	canonical: string | null;
};

export const SITE_URL = "https://mquesada02.github.io/portdle";

// The title of index.html: the tab title where no table entry applies (the
// not-found screen).
export const DEFAULT_TITLE = "Portdle";

function pageUrl(path: string): string {
	return `${SITE_URL}${path}`;
}

export const HEAD: Record<string, Head> = {
	"/": {
		title: "Portdle: guess the port of the day",
		description:
			"Guess the Daily port number in six tries. A new Mixed, Protocols and Applications Daily every day.",
		canonical: pageUrl("/"),
	},
	"/protocols": {
		title: "Protocols Daily - Portdle",
		description: "Guess today's protocol port in six tries.",
		canonical: pageUrl("/protocols"),
	},
	"/applications": {
		title: "Applications Daily - Portdle",
		description: "Guess today's application port in six tries.",
		canonical: pageUrl("/applications"),
	},
	"/archive": {
		title: "Archive - Portdle",
		description:
			"Every past Daily of Mixed, Protocols and Applications, ready to play.",
		canonical: pageUrl("/archive"),
	},
	"/archive/board": {
		title: "Archive board - Portdle",
		description: "A past Portdle Daily from the Archive.",
		canonical: null,
	},
	// The old board route's id, removed with the route by the contract step of
	// the board URL move.
	"/archive/$category/$date": {
		title: "Archive board - Portdle",
		description: "A past Portdle Daily from the Archive.",
		canonical: null,
	},
	"/blitz": {
		title: "Blitz - Portdle",
		description:
			"Timed, lives-based port practice: name as many ports as you can.",
		canonical: pageUrl("/blitz"),
	},
	"/history": {
		title: "History - Portdle",
		description: "Every Daily you finished, with your stats and streaks.",
		canonical: pageUrl("/history"),
	},
	"/history/blitz": {
		title: "Blitz history - Portdle",
		description: "Every saved Blitz run and your Bests.",
		canonical: pageUrl("/history/blitz"),
	},
	"/codex": {
		title: "Codex - Portdle",
		description:
			"Your collection of every port in the catalog, with its Codex state.",
		canonical: pageUrl("/codex"),
	},
};

// The canonical URL of one Archive board, with its params.
export function boardCanonical(board: {
	category: string;
	date: string;
}): string {
	const params = new URLSearchParams({
		category: board.category,
		date: board.date,
	});
	return `${SITE_URL}/archive/board?${params.toString()}`;
}
