import type {
	BlitzBests,
	BlitzRun,
	CodexState,
	DailyPersist,
} from "../engine/types";

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
};

// A pull returns this many of the newest runs.
export const NEWEST_RUNS = 50;

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
	redirectError(): string | null;
	clearRedirectError(): void;
	preload(): void;
};
