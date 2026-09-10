import type { GuessResult } from "../engine/types";

export const NOT_IN_THIS_CATALOG = "Not in this catalog.";

export function defaultGuessMessage(guess: GuessResult): string {
	if (guess.status === "invalid") {
		return "Not a valid port.";
	}
	if (guess.status === "duplicate") {
		return "Already guessed.";
	}
	if (guess.status === "miss") {
		return guess.identified ? guess.identified.name : NOT_IN_THIS_CATALOG;
	}
	return "";
}
