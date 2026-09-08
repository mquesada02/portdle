import type { CatalogEntry, DailyCategory } from "./types";

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
