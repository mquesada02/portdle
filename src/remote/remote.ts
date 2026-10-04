import type {
	BlitzBests,
	BlitzMode,
	BlitzRun,
	CatalogEntry,
	CodexState,
	DailyCategory,
	DailyPersist,
	Orientation,
	ScheduleRow,
} from "../engine/types";
import type { Preferences } from "../persist/storage";

export type Provider = "google" | "github";

export type AccountState =
	| { status: "signedOut" }
	| {
			status: "signedIn";
			accountId: string;
			displayName: string;
			nameConfirmed: boolean;
	  };

// The account's synced records. `dailies` is keyed `category|date`. A push
// carries only the changed records.
export type SyncedRows = {
	codex: Record<string, CodexState>;
	bests: BlitzBests;
	runs: BlitzRun[];
	dailies: Record<string, DailyPersist>;
	// Only the set preferences.
	preferences: Preferences;
};

// A pull returns this many of the newest runs.
export const NEWEST_RUNS = 50;

export type LeaderboardWindow = "allTime" | "weekly" | "today";

export type LeaderboardQuery = {
	window: LeaderboardWindow;
	category: DailyCategory;
	orientation: Orientation;
	mode: BlitzMode;
};

export type LeaderboardRow = {
	accountId: string;
	displayName: string;
	score: number;
	timeToScoreMs: number | null;
	rank: number;
};

// The rows ranked up to LEADERBOARD_TOP, plus the viewer's own row when they
// are signed in and ranked. `viewerId` is the signed-in account, else null.
export type LeaderboardPage = {
	rows: LeaderboardRow[];
	viewerId: string | null;
};

export const LEADERBOARD_TOP = 100;

// The whole catalog, split by catalog kind.
export type Catalog = {
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
};

// The server's UTC date, the server's current time, and each category's
// Daily entry id.
export type CurrentDailies = {
	today: string;
	// Epoch milliseconds.
	serverNow: number;
	entryIds: Record<DailyCategory, string>;
};

// The on-day totals of one Daily: players who finished it, wins, wins by
// number of tries (1 to 6), and losses.
export type DailyGlobalStats = {
	players: number;
	wins: number;
	losses: number;
	byTries: [number, number, number, number, number, number];
};

export function emptyDailyStats(): DailyGlobalStats {
	return { players: 0, wins: 0, losses: 0, byTries: [0, 0, 0, 0, 0, 0] };
}

// Any Remote call may reject with this when the account no longer exists.
export class AccountGoneError extends Error {
	constructor() {
		super("The account no longer exists");
		this.name = "AccountGoneError";
	}
}

export type Remote = {
	getAccount(): Promise<AccountState>;
	signIn(provider: Provider): Promise<void>;
	signOut(): Promise<void>;
	// Removes the account on the backend, then drops this device's stored
	// sign-in. Rejects with AccountGoneError when the account is already gone.
	deleteAccount(): Promise<void>;
	confirmDisplayName(name: string): Promise<void>;
	changeDisplayName(name: string): Promise<void>;
	pull(): Promise<SyncedRows>;
	// Rows go to the given account; a sign-in for another account is refused.
	push(accountId: string, rows: SyncedRows): Promise<void>;
	readLeaderboard(query: LeaderboardQuery): Promise<LeaderboardPage>;
	// Public reads: no sign-in needed.
	readCatalog(): Promise<Catalog>;
	// Rejects when the server has no Daily for a category today.
	readCurrentDailies(): Promise<CurrentDailies>;
	// Every Schedule row the server shows: days up to the server's UTC date.
	readSchedule(): Promise<ScheduleRow[]>;
	// The totals of one Daily: all zeros when no one finished it on-day.
	readDailyStats(
		category: DailyCategory,
		date: string,
	): Promise<DailyGlobalStats>;
	redirectError(): string | null;
	clearRedirectError(): void;
	preload(): void;
};
