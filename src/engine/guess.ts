import type { CatalogEntry, DailyPersist, GuessResult } from "./types";

export function digitLength(port: number): number {
	return String(port).length;
}

export function evaluateDefaultGuess(input: {
	digits: string;
	answer: CatalogEntry;
	previousPorts: number[];
	catalog: CatalogEntry[];
}): GuessResult {
	const { digits, answer, previousPorts, catalog } = input;
	if (!/^\d+$/.test(digits) || digits.length !== digitLength(answer.port)) {
		return { status: "invalid" };
	}
	const port = Number.parseInt(digits, 10);
	if (port > 65535) {
		return { status: "invalid" };
	}
	if (previousPorts.includes(port)) {
		return { status: "duplicate" };
	}
	if (port === answer.port) {
		return { status: "correct", port };
	}
	const matches = catalog
		.filter((entry) => entry.port === port)
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	const match = matches[0];
	if (!match) {
		return { status: "miss", port, identified: null };
	}
	return {
		status: "miss",
		port,
		identified: { id: match.id, name: match.name, port: match.port },
	};
}

// `late` marks a new record; a stored record keeps the mark it has.
export function applyCommittedGuess(
	current: DailyPersist | null,
	result: GuessResult,
	late: boolean,
): DailyPersist | { status: "invalid" } | { status: "duplicate" } {
	if (result.status === "invalid" || result.status === "duplicate") {
		return { status: result.status };
	}
	const guesses = current?.guesses ?? [];
	const nextGuess =
		result.status === "correct"
			? { port: result.port, result: "correct" as const, identified: null }
			: {
					port: result.port,
					result: "miss" as const,
					identified: result.identified,
				};
	const nextGuesses = [...guesses, nextGuess];
	// An absent `late` on a stored record stays absent: it reads as on-day.
	const mark = current ? current.late : late;
	const withMark = mark === undefined ? {} : { late: mark };
	if (result.status === "correct") {
		return { status: "won", guesses: nextGuesses, ...withMark };
	}
	if (nextGuesses.length >= 6) {
		return { status: "lost", guesses: nextGuesses, ...withMark };
	}
	return { status: "playing", guesses: nextGuesses, ...withMark };
}
