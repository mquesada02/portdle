export type Provider = "google" | "github";

export type AccountState =
	| { status: "signedOut" }
	| {
			status: "signedIn";
			accountId: string;
			displayName: string;
			nameConfirmed: boolean;
	  };

export type Remote = {
	getAccount(): Promise<AccountState>;
	signIn(provider: Provider): Promise<void>;
	signOut(): Promise<void>;
	redirectError(): string | null;
	clearRedirectError(): void;
	preload(): void;
};
