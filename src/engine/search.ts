import uFuzzy from "@leeoniya/ufuzzy";
import type { CatalogEntry } from "./types";

export type SearchHit = { id: string; name: string };
export type SearchIndex = {
	uf: uFuzzy;
	haystack: string[];
	tokenEntryIndex: number[];
	entries: SearchHit[];
	tokenName: Map<string, string>;
};

const UFUZZY_OPTIONS: uFuzzy.Options = {
	intraMode: 1,
};

// uFuzzy's instance `sort` method itself is typed with no 4th parameter at
// all, but it's really just its `Options.sort` (whose type does declare a
// 4th, optional `compare`) — and it's required here, since passing it is
// what makes tie-breaking locale aware (see the comment in searchNames).
// This local, non-optional type keeps that a compile error if ever dropped.
type SortWithCompare = (
	info: uFuzzy.Info,
	haystack: string[],
	needle: string,
	compare: (a: string, b: string) => number,
) => uFuzzy.InfoIdxOrder;

export function buildSearchIndex(catalog: CatalogEntry[]): SearchIndex {
	const entries = catalog.map((entry) => ({ id: entry.id, name: entry.name }));
	const haystack: string[] = [];
	const tokenEntryIndex: number[] = [];
	const tokenName = new Map<string, string>();
	catalog.forEach((entry, entryIndex) => {
		for (const token of [entry.name, ...(entry.aliases ?? [])]) {
			haystack.push(token);
			tokenEntryIndex.push(entryIndex);
			// First entry to claim a token string wins its name mapping; two
			// different entries sharing one alias/name string verbatim would
			// mis-map the loser's token, but no catalog entry does today.
			if (!tokenName.has(token)) {
				tokenName.set(token, entry.name);
			}
		}
	});
	return {
		uf: new uFuzzy(UFUZZY_OPTIONS),
		haystack,
		tokenEntryIndex,
		entries,
		tokenName,
	};
}

export function searchNames(index: SearchIndex, query: string): SearchHit[] {
	const needle = query.trim();
	if (needle.length === 0) {
		return [];
	}
	const idxs = index.uf.filter(index.haystack, needle);
	if (idxs == null || idxs.length === 0) {
		return [];
	}
	const info = index.uf.info(idxs, index.haystack, needle);
	// uFuzzy's public `sort` defaults its final tie-break to plain code-unit
	// comparison unless a `compare` is passed explicitly (its locale-aware
	// default is only auto-applied inside its all-in-one `search()` method,
	// which this index does not use) — pass one so ties really do resolve by
	// locale-aware name comparison, not code-unit order. Compare by each
	// token's canonical entry name (not the raw matched token, which could be
	// an alias) so ties are broken by name exactly as the spec says.
	const sortWithCompare = index.uf.sort as SortWithCompare;
	const order = sortWithCompare(info, index.haystack, needle, (a, b) =>
		(index.tokenName.get(a) ?? a).localeCompare(index.tokenName.get(b) ?? b),
	);

	// `order` is already best-rank-first; the first time an entry's id shows up
	// here is its best rank, since later occurrences (its other matched alias
	// tokens) can only be an equal or worse rank.
	const seen = new Set<number>();
	const hits: SearchHit[] = [];
	for (const infoIdx of order) {
		const haystackIdx = info.idx[infoIdx];
		if (haystackIdx === undefined) {
			continue;
		}
		const entryIndex = index.tokenEntryIndex[haystackIdx];
		if (entryIndex === undefined || seen.has(entryIndex)) {
			continue;
		}
		seen.add(entryIndex);
		const entry = index.entries[entryIndex];
		if (entry) {
			hits.push(entry);
			if (hits.length === 20) {
				break;
			}
		}
	}
	return hits;
}
