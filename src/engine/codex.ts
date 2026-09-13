import type {
	CatalogEntry,
	CatalogKind,
	CodexEncounter,
	CodexMap,
	CodexState,
} from "./types";

const RANK: Record<CodexState, number> = {
	identified: 1,
	missed: 2,
	correct: 3,
};

export function applyCodexEncounter(
	map: CodexMap,
	encounter: CodexEncounter,
): CodexMap {
	const current = map[encounter.id];
	const currentRank = current ? RANK[current.state] : 0;
	if (RANK[encounter.state] <= currentRank) {
		return map;
	}
	const fresh = current ? current.fresh : true;
	return { ...map, [encounter.id]: { state: encounter.state, fresh } };
}

export function clearCodexFresh(map: CodexMap): CodexMap {
	const next: CodexMap = {};
	for (const [id, record] of Object.entries(map)) {
		next[id] = record.fresh ? { ...record, fresh: false } : record;
	}
	return next;
}

export type CodexCard =
	| { status: "unseen"; entry: CatalogEntry }
	| { status: CodexState; entry: CatalogEntry; fresh: boolean };

export type CodexGroup = { kind: CatalogKind; cards: CodexCard[] };

function foldedName(entry: CatalogEntry): string {
	return entry.name.toLowerCase();
}

function compareEntries(
	a: CatalogEntry,
	b: CatalogEntry,
	sort: "name" | "port",
): number {
	if (sort === "port" && a.port !== b.port) {
		return a.port - b.port;
	}
	const nameA = foldedName(a);
	const nameB = foldedName(b);
	if (nameA < nameB) {
		return -1;
	}
	if (nameA > nameB) {
		return 1;
	}
	return 0;
}

function groupCards(
	entries: CatalogEntry[],
	map: CodexMap,
	sort: "name" | "port",
): CodexCard[] {
	return [...entries]
		.sort((a, b) => compareEntries(a, b, sort))
		.map((entry) => {
			const record = map[entry.id];
			return record
				? { status: record.state, entry, fresh: record.fresh }
				: { status: "unseen", entry };
		});
}

export function codexGroups(input: {
	map: CodexMap;
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
	sort: "name" | "port";
}): CodexGroup[] {
	return [
		{
			kind: "protocol",
			cards: groupCards(input.protocols, input.map, input.sort),
		},
		{
			kind: "application",
			cards: groupCards(input.applications, input.map, input.sort),
		},
	];
}

export function codexCounts(input: {
	map: CodexMap;
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
}): {
	seen: number;
	correct: number;
	byKind: Record<CatalogKind, { seen: number; correct: number }>;
} {
	function countFor(entries: CatalogEntry[]): {
		seen: number;
		correct: number;
	} {
		let seen = 0;
		let correct = 0;
		for (const entry of entries) {
			const record = input.map[entry.id];
			if (!record) {
				continue;
			}
			seen += 1;
			if (record.state === "correct") {
				correct += 1;
			}
		}
		return { seen, correct };
	}
	const protocol = countFor(input.protocols);
	const application = countFor(input.applications);
	return {
		seen: protocol.seen + application.seen,
		correct: protocol.correct + application.correct,
		byKind: { protocol, application },
	};
}
