import type {
	BlitzBests,
	BlitzMode,
	BlitzRun,
	CodexState,
	DailyCategory,
	DailyPersist,
	Orientation,
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
	confirmDisplayName(name: string): Promise<void>;
	changeDisplayName(name: string): Promise<void>;
	pull(): Promise<SyncedRows>;
	// Rows go to the given account; a sign-in for another account is refused.
	push(accountId: string, rows: SyncedRows): Promise<void>;
	readLeaderboard(query: LeaderboardQuery): Promise<LeaderboardPage>;
	redirectError(): string | null;
	clearRedirectError(): void;
	preload(): void;
};
