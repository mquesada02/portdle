export type CatalogKind = "protocol" | "application";
export type DailyCategory = "mixed" | "protocols" | "applications";
export const DAILY_CATEGORIES: DailyCategory[] = [
	"mixed",
	"protocols",
	"applications",
];
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
