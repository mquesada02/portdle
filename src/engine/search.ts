import type { CatalogEntry } from "./types";

export type SearchHit = { id: string; name: string };
export type SearchIndex = {
	entries: Array<{ id: string; name: string; tokens: string[] }>;
};

export function buildSearchIndex(catalog: CatalogEntry[]): SearchIndex {
	return {
		entries: catalog.map((entry) => ({
			id: entry.id,
			name: entry.name,
			tokens: [entry.name, ...(entry.aliases ?? [])].map((token) =>
				token.toLowerCase(),
			),
		})),
	};
}

export function searchNames(index: SearchIndex, query: string): SearchHit[] {
	const needle = query.trim().toLowerCase();
	if (needle.length === 0) {
		return [];
	}
	const nameHits: SearchHit[] = [];
	const aliasHits: SearchHit[] = [];
	for (const entry of index.entries) {
		const nameToken = entry.tokens[0] ?? "";
		if (nameToken.startsWith(needle)) {
			nameHits.push({ id: entry.id, name: entry.name });
			continue;
		}
		if (entry.tokens.slice(1).some((token) => token.startsWith(needle))) {
			aliasHits.push({ id: entry.id, name: entry.name });
		}
	}
	const byName = (left: SearchHit, right: SearchHit) =>
		left.name.localeCompare(right.name);
	nameHits.sort(byName);
	aliasHits.sort(byName);
	return [...nameHits, ...aliasHits].slice(0, 20);
}
