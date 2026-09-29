import type { AccountState, Provider, Remote } from "../remote/remote";

export type FakeRemote = Remote & {
	state: AccountState;
	signInCalls: Provider[];
	signOutCalls: number;
	preloadCalls: number;
	failGetAccount: boolean;
	failSignIn: boolean;
	failSignOut: boolean;
	holdGetAccount(): () => void;
	setRedirectError(text: string | null): void;
};

export function createFakeRemote(
	state: AccountState = { status: "signedOut" },
): FakeRemote {
	let redirectText: string | null = null;
	let gate: Promise<void> | null = null;
	const fake: FakeRemote = {
		state,
		signInCalls: [],
		signOutCalls: 0,
		preloadCalls: 0,
		failGetAccount: false,
		failSignIn: false,
		failSignOut: false,
		holdGetAccount() {
			let release: () => void = () => {};
			gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			return release;
		},
		setRedirectError(text) {
			redirectText = text;
		},
		async getAccount() {
			if (gate) {
				await gate;
			}
			if (fake.failGetAccount) {
				throw new Error("get account failed");
			}
			return fake.state;
		},
		async signIn(provider) {
			fake.signInCalls.push(provider);
			if (fake.failSignIn) {
				throw new Error("sign-in failed");
			}
		},
		async signOut() {
			fake.signOutCalls += 1;
			if (fake.failSignOut) {
				throw new Error("sign-out failed");
			}
			fake.state = { status: "signedOut" };
		},
		redirectError: () => redirectText,
		clearRedirectError() {
			redirectText = null;
		},
		preload() {
			fake.preloadCalls += 1;
		},
	};
	return fake;
}
