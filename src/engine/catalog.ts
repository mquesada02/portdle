import type { CatalogEntry, DailyCategory } from "./types";

export type CatalogIssue =
	| { kind: "duplicate-id"; id: string }
	| { kind: "duplicate-name"; name: string }
	| { kind: "invalid-port"; id: string }
	| { kind: "missing-blurb"; id: string }
	| { kind: "blurb-leaks-name"; id: string };

export function catalogFor(
	category: DailyCategory,
	protocols: CatalogEntry[],
	applications: CatalogEntry[],
): CatalogEntry[] {
	if (category === "protocols") {
		return protocols;
	}
	if (category === "applications") {
		return applications;
	}
	return [...protocols, ...applications];
}

export function answerPool(catalog: CatalogEntry[]): CatalogEntry[] {
	return catalog.filter((entry) => entry.answerEligible && !entry.retired);
}

function crowdedPorts(entries: CatalogEntry[]): Set<number> {
	const counts = new Map<number, number>();
	for (const entry of entries) {
		if (entry.retired) {
			continue;
		}
		counts.set(entry.port, (counts.get(entry.port) ?? 0) + 1);
	}
	return new Set(
		[...counts.entries()]
			.filter(([, count]) => count >= 2)
			.map(([port]) => port),
	);
}

function blurbLeaks(entry: CatalogEntry): boolean {
	if (entry.blurb === undefined) {
		return false;
	}
	const haystack = entry.blurb.toLowerCase();
	const needles = [entry.name, ...(entry.aliases ?? [])].map((value) =>
		value.toLowerCase(),
	);
	return needles.some((needle) => haystack.includes(needle));
}

export function validateCatalog(entries: CatalogEntry[]): CatalogIssue[] {
	const issues: CatalogIssue[] = [];
	const seenIds = new Set<string>();
	const seenNames = new Map<string, string>();
	const crowded = crowdedPorts(entries);

	for (const entry of entries) {
		if (seenIds.has(entry.id)) {
			issues.push({ kind: "duplicate-id", id: entry.id });
		}
		seenIds.add(entry.id);

		const foldedName = entry.name.toLowerCase();
		const priorName = seenNames.get(foldedName);
		if (priorName !== undefined) {
			issues.push({ kind: "duplicate-name", name: entry.name });
		} else {
			seenNames.set(foldedName, entry.name);
		}

		if (!Number.isInteger(entry.port) || entry.port < 0 || entry.port > 65535) {
			issues.push({ kind: "invalid-port", id: entry.id });
		}

		if (!entry.retired && crowded.has(entry.port)) {
			if (entry.blurb === undefined || entry.blurb.length === 0) {
				issues.push({ kind: "missing-blurb", id: entry.id });
			} else if (blurbLeaks(entry)) {
				issues.push({ kind: "blurb-leaks-name", id: entry.id });
			}
		}
	}

	return issues;
}
