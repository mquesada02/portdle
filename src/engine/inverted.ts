import type { CatalogEntry, InvertedGuessResult } from "./types";

export function evaluateInvertedGuess(input: {
	id: string;
	answer: CatalogEntry;
	previousIds: string[];
	catalog: CatalogEntry[];
}): InvertedGuessResult {
	if (input.previousIds.includes(input.id)) {
		return { status: "duplicate" };
	}
	if (input.id === input.answer.id) {
		return { status: "correct", id: input.id };
	}
	const picked = input.catalog.find((entry) => entry.id === input.id);
	if (!picked) {
		throw new Error("unknown id");
	}
	return {
		status: "miss",
		id: input.id,
		identified: { id: picked.id, name: picked.name, port: picked.port },
		samePort: picked.port === input.answer.port,
	};
}
