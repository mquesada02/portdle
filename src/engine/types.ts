export type CatalogKind = "protocol" | "application";
export type DailyCategory = "mixed" | "protocols" | "applications";
export const DAILY_CATEGORIES: DailyCategory[] = [
	"mixed",
	"protocols",
	"applications",
];
export type Orientation = "default" | "inverted";
export type BlitzMode = "sprint" | "marathon" | "survival";
export type Transport = "tcp" | "udp" | "both";

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

export type BlitzBests = Partial<
	Record<`${DailyCategory}|${Orientation}|${BlitzMode}`, number>
>;

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
};

export type BlitzEvent =
	| { type: "default-guess"; digits: string }
	| { type: "inverted-guess"; id: string }
	| { type: "timeout" };
