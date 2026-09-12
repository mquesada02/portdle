import { answerPool, catalogFor } from "./catalog";
import { getDaily } from "./daily";
import { evaluateDefaultGuess } from "./guess";
import { evaluateInvertedGuess } from "./inverted";
import type {
	BlitzEvent,
	BlitzMode,
	BlitzState,
	CatalogEntry,
	DailyCategory,
	GuessResult,
	InvertedGuessResult,
	Orientation,
	Round,
	RoundOutcome,
	ScheduleFile,
	WrongAnswer,
} from "./types";
import { DAILY_CATEGORIES } from "./types";

function shuffle<T>(items: T[], rng: () => number): T[] {
	const next = [...items];
	for (let index = next.length - 1; index > 0; index -= 1) {
		const swapWith = Math.floor(rng() * (index + 1));
		const current = next[index];
		const other = next[swapWith];
		if (current === undefined || other === undefined) {
			continue;
		}
		next[index] = other;
		next[swapWith] = current;
	}
	return next;
}

function deal(ids: string[]): Pick<BlitzState, "currentId" | "remainingIds"> {
	const currentId = ids[0];
	if (currentId === undefined) {
		throw new Error("empty-pool");
	}
	return { currentId, remainingIds: ids.slice(1) };
}

export function startBlitz(input: {
	category: DailyCategory;
	orientation: Orientation;
	mode: BlitzMode;
	utcToday: string;
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
	schedules: Record<DailyCategory, ScheduleFile>;
	rng: () => number;
}): BlitzState | { error: "empty-pool" } {
	const catalog = catalogFor(
		input.category,
		input.protocols,
		input.applications,
	);
	const excluded = new Set<string>();
	for (const category of DAILY_CATEGORIES) {
		const daily = getDaily(
			category,
			input.utcToday,
			input.schedules[category],
			input.protocols,
			input.applications,
		);
		if (daily) {
			excluded.add(daily.id);
		}
	}
	const pool = answerPool(catalog)
		.map((entry) => entry.id)
		.filter((id) => !excluded.has(id));
	if (pool.length === 0) {
		return { error: "empty-pool" };
	}
	const startPool = shuffle(pool, input.rng);
	const dealt = deal(startPool);
	return {
		category: input.category,
		orientation: input.orientation,
		mode: input.mode,
		lives: 3,
		score: 0,
		startPool,
		ended: null,
		rounds: [],
		...dealt,
	};
}

function advance(state: BlitzState, rng: () => number): BlitzState {
	if (state.remainingIds.length > 0) {
		return { ...state, ...deal(state.remainingIds) };
	}
	const shuffled = shuffle([...state.startPool], rng);
	return { ...state, ...deal(shuffled) };
}

function buildRound(
	answer: CatalogEntry,
	outcome: RoundOutcome,
	wrong: WrongAnswer | null,
): Round {
	return {
		id: answer.id,
		name: answer.name,
		port: answer.port,
		outcome,
		wrong,
	};
}

function afterCommitted(
	state: BlitzState,
	rng: () => number,
	round: Round,
): BlitzState {
	const rounds = [...state.rounds, round];
	if (round.outcome === "correct") {
		return advance({ ...state, score: state.score + 1, rounds }, rng);
	}
	const lives = state.lives - 1;
	if (lives === 0) {
		return { ...state, lives, rounds, ended: "lives" };
	}
	return advance({ ...state, lives, rounds }, rng);
}

export function reduceBlitz(input: {
	state: BlitzState;
	event: BlitzEvent;
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
	rng: () => number;
}): {
	state: BlitzState;
	guess?: GuessResult;
	inverted?: InvertedGuessResult;
} {
	const { state, event, protocols, applications, rng } = input;
	if (state.ended !== null) {
		return { state };
	}
	if (event.type === "timeout") {
		return { state: { ...state, ended: "timeout" } };
	}
	const catalog = catalogFor(state.category, protocols, applications);
	const answer = catalog.find((entry) => entry.id === state.currentId);
	if (!answer) {
		return { state };
	}
	if (event.type === "inverted-guess") {
		if (state.orientation !== "inverted") {
			return { state };
		}
		const inverted = evaluateInvertedGuess({
			id: event.id,
			answer,
			previousIds: [],
			catalog,
		});
		if (inverted.status === "duplicate") {
			return { state, inverted };
		}
		const wrong: WrongAnswer | null =
			inverted.status === "miss"
				? { kind: "picked", pick: inverted.identified }
				: null;
		return {
			state: afterCommitted(
				state,
				rng,
				buildRound(answer, inverted.status, wrong),
			),
			inverted,
		};
	}
	const guess = evaluateDefaultGuess({
		digits: event.digits,
		answer,
		previousPorts: [],
		catalog,
	});
	if (guess.status === "invalid" || guess.status === "duplicate") {
		return { state, guess };
	}
	const wrong: WrongAnswer | null =
		guess.status === "miss"
			? { kind: "typed", port: guess.port, owner: guess.identified }
			: null;
	return {
		state: afterCommitted(state, rng, buildRound(answer, guess.status, wrong)),
		guess,
	};
}
