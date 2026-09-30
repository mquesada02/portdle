import { dailyKey, parseDailyKey } from "../engine/daily-key";
import type {
	BlitzBest,
	BlitzBests,
	BlitzBestsKey,
	BlitzMode,
	BlitzRun,
	CodexSort,
	CodexState,
	DailyCategory,
	DailyPersist,
	Identified,
	Orientation,
	Round,
	WrongAnswer,
} from "../engine/types";
import { isValidTimestamp, isValidUtcDate } from "../engine/utc";
import type { Preferences, Theme } from "../persist/storage";
import type { SyncedRows } from "./remote";

// Database row shapes. The two jsonb columns come back with object keys in
// the database's order, so the mappers below rebuild every object field by
// field in the order the app writes it.
export type CodexRow = { entry_id: string; state: CodexState };
export type BestRow = {
	category: DailyCategory;
	orientation: Orientation;
	mode: BlitzMode;
	score: number;
	time_to_score_ms: number | null;
};
export type RunRow = {
	ended_at: string;
	category: DailyCategory;
	orientation: Orientation;
	mode: BlitzMode;
	ended: "lives" | "timeout";
	score: number;
	time_to_score_ms: number | null;
	rounds: Round[];
};
export type PreferencesRow = {
	theme: Theme | null;
	how_to_seen: true | null;
	codex_sort: CodexSort | null;
};
export type DailyRow = {
	category: DailyCategory;
	day: string;
	status: DailyPersist["status"];
	guesses: DailyPersist["guesses"];
};

function identified(value: Identified): Identified {
	return { id: value.id, name: value.name, port: value.port };
}

function wrongAnswer(value: WrongAnswer): WrongAnswer {
	return value.kind === "typed"
		? {
				kind: "typed",
				port: value.port,
				owner: value.owner === null ? null : identified(value.owner),
			}
		: { kind: "picked", pick: identified(value.pick) };
}

function round(value: Round): Round {
	return {
		id: value.id,
		name: value.name,
		port: value.port,
		outcome: value.outcome,
		wrong: value.wrong === null ? null : wrongAnswer(value.wrong),
	};
}

function guess(value: DailyPersist["guesses"][number]) {
	return {
		port: value.port,
		result: value.result,
		identified: value.identified === null ? null : identified(value.identified),
	};
}

export function fromRows(rows: {
	codex: CodexRow[];
	bests: BestRow[];
	runs: RunRow[];
	dailies: DailyRow[];
	preferences: PreferencesRow | null;
}): SyncedRows {
	const codex: SyncedRows["codex"] = {};
	for (const row of rows.codex) {
		codex[row.entry_id] = row.state;
	}
	const bests: BlitzBests = {};
	for (const row of rows.bests) {
		const best: BlitzBest = { score: row.score };
		if (row.time_to_score_ms !== null) {
			best.timeToScoreMs = row.time_to_score_ms;
		}
		bests[`${row.category}|${row.orientation}|${row.mode}` as BlitzBestsKey] =
			best;
	}
	const runs = rows.runs.map(
		(row): BlitzRun => ({
			category: row.category,
			orientation: row.orientation,
			mode: row.mode,
			ended: row.ended,
			endedAt: new Date(row.ended_at).toISOString(),
			score: row.score,
			...(row.time_to_score_ms !== null && {
				timeToScoreMs: row.time_to_score_ms,
			}),
			rounds: row.rounds.map(round),
		}),
	);
	const dailies: SyncedRows["dailies"] = {};
	for (const row of rows.dailies) {
		dailies[dailyKey(row.category, row.day)] = {
			status: row.status,
			guesses: row.guesses.map(guess),
		};
	}
	const preferences: Preferences = {};
	if (rows.preferences?.theme != null) {
		preferences.theme = rows.preferences.theme;
	}
	if (rows.preferences?.how_to_seen != null) {
		preferences.howToSeen = true;
	}
	if (rows.preferences?.codex_sort != null) {
		preferences.codexSort = rows.preferences.codex_sort;
	}
	return { codex, bests, runs, dailies, preferences };
}

// One row of only the changed columns, so a column left out keeps its value
// and its timestamp; none at all when nothing changed.
function preferencesRow(
	accountId: string,
	preferences: Preferences,
): Array<Partial<PreferencesRow> & { account_id: string }> {
	if (Object.keys(preferences).length === 0) {
		return [];
	}
	const row: Partial<PreferencesRow> & { account_id: string } = {
		account_id: accountId,
	};
	if (preferences.theme !== undefined) {
		row.theme = preferences.theme;
	}
	if (preferences.howToSeen !== undefined) {
		row.how_to_seen = preferences.howToSeen;
	}
	if (preferences.codexSort !== undefined) {
		row.codex_sort = preferences.codexSort;
	}
	return [row];
}

// Records with a value the database refuses (a run with an invalid `endedAt`,
// a Daily with an invalid date) are left out, so one bad local value never
// fails a whole chunk.
export function toRows(
	accountId: string,
	rows: SyncedRows,
): {
	codex_entries: Array<CodexRow & { account_id: string }>;
	blitz_bests: Array<BestRow & { account_id: string }>;
	blitz_runs: Array<RunRow & { account_id: string }>;
	dailies: Array<DailyRow & { account_id: string }>;
	preferences: Array<Partial<PreferencesRow> & { account_id: string }>;
} {
	return {
		codex_entries: Object.entries(rows.codex).map(([entry_id, state]) => ({
			account_id: accountId,
			entry_id,
			state,
		})),
		blitz_bests: Object.entries(rows.bests).flatMap(([key, best]) => {
			if (!best) {
				return [];
			}
			const [category, orientation, mode] = key.split("|") as [
				DailyCategory,
				Orientation,
				BlitzMode,
			];
			return [
				{
					account_id: accountId,
					category,
					orientation,
					mode,
					score: best.score,
					time_to_score_ms: best.timeToScoreMs ?? null,
				},
			];
		}),
		blitz_runs: rows.runs
			.filter((run) => isValidTimestamp(run.endedAt))
			.map((run) => ({
				account_id: accountId,
				ended_at: run.endedAt,
				category: run.category,
				orientation: run.orientation,
				mode: run.mode,
				ended: run.ended,
				score: run.score,
				time_to_score_ms: run.timeToScoreMs ?? null,
				rounds: run.rounds,
			})),
		preferences: preferencesRow(accountId, rows.preferences),
		dailies: Object.entries(rows.dailies).flatMap(([key, daily]) => {
			const [category, day] = parseDailyKey(key);
			if (!isValidUtcDate(day)) {
				return [];
			}
			return [
				{
					account_id: accountId,
					category,
					day,
					status: daily.status,
					guesses: daily.guesses,
				},
			];
		}),
	};
}
