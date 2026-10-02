export type CatalogKind = "protocol" | "application";
export type DailyCategory = "mixed" | "protocols" | "applications";
export const DAILY_CATEGORIES: DailyCategory[] = [
	"mixed",
	"protocols",
	"applications",
];
export function isDailyCategory(value: string): value is DailyCategory {
	return (DAILY_CATEGORIES as string[]).includes(value);
}
export type Orientation = "default" | "inverted";
export type BlitzMode = "sprint" | "marathon" | "survival";
export type Transport = "tcp" | "udp" | "both";

export type Source = { label: string; url: string };

export type CatalogEntry = {
	id: string;
	name: string;
	aliases?: string[];
	port: number;
	transport: Transport;
	description: string;
	blurb?: string;
	answerEligible: boolean;
	retired?: boolean;
	sources?: Source[];
};

// One Schedule row: the entry that is the Daily of a category on a UTC day.
export type ScheduleRow = {
	category: DailyCategory;
	date: string;
	entryId: string;
};

export type Cycle = { startDay: number; order: string[] };
export type ScheduleFile = { epoch: string; cycles: Cycle[] };

export type Identified = { id: string; name: string; port: number };
export type GuessResult =
	| { status: "invalid" }
	| { status: "duplicate" }
	| { status: "correct"; port: number }
	| { status: "miss"; port: number; identified: Identified | null };

export type InvertedGuessResult =
	| { status: "duplicate" }
	| { status: "correct"; id: string }
	| { status: "miss"; id: string; identified: Identified; samePort: boolean };

export type CategoryStats = {
	currentStreak: number;
	bestStreak: number;
	played: number;
	wins: number;
	histogram: [number, number, number, number, number, number];
};

export type DailyPersist = {
	status: "playing" | "won" | "lost";
	guesses: Array<{
		port: number;
		result: "correct" | "miss";
		identified: Identified | null;
	}>;
};

export type BlitzBestsKey = `${DailyCategory}|${Orientation}|${BlitzMode}`;

export type BlitzBest = { score: number; timeToScoreMs?: number };
export type BlitzBests = Partial<Record<BlitzBestsKey, BlitzBest>>;
// A Best stored before time to score is a bare score.
export type StoredBlitzBests = Partial<
	Record<BlitzBestsKey, number | BlitzBest>
>;

export type RoundOutcome = "correct" | "miss";
export type WrongAnswer =
	| { kind: "typed"; port: number; owner: Identified | null }
	| { kind: "picked"; pick: Identified };
export type Round = {
	id: string;
	name: string;
	port: number;
	outcome: RoundOutcome;
	wrong: WrongAnswer | null;
};

export type BlitzRun = {
	category: DailyCategory;
	orientation: Orientation;
	mode: BlitzMode;
	ended: "lives" | "timeout";
	endedAt: string;
	score: number;
	timeToScoreMs?: number;
	rounds: Round[];
};

export type BlitzState = {
	category: DailyCategory;
	orientation: Orientation;
	mode: BlitzMode;
	lives: number;
	score: number;
	remainingIds: string[];
	currentId: string;
	startPool: string[];
	ended: null | "lives" | "timeout";
	rounds: Round[];
	startedAtMs: number;
	timeToScoreMs: number;
};

export type BlitzEvent =
	| { type: "default-guess"; digits: string }
	| { type: "inverted-guess"; id: string }
	| { type: "timeout" };

export type CodexState = "identified" | "missed" | "correct";
export type CodexRecord = { state: CodexState; fresh: boolean };
export type CodexMap = Record<string, CodexRecord>;
export type CodexEncounter = { state: CodexState; id: string };
export type CodexSort = "name" | "port";
