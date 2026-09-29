import type { AccountState, Provider, Remote } from "../remote/remote";

export type FakeRemote = Remote & {
	state: AccountState;
	signInCalls: Provider[];
	signOutCalls: number;
	preloadCalls: number;
	confirmCalls: string[];
	changeCalls: string[];
	failGetAccount: boolean;
	failSignIn: boolean;
	failSignOut: boolean;
	failConfirmDisplayName: boolean;
	failChangeDisplayName: boolean;
	holdConfirmDisplayName(): () => void;
	holdChangeDisplayName(): () => void;
	holdGetAccount(): () => void;
	setRedirectError(text: string | null): void;
};

export function createFakeRemote(
	state: AccountState = { status: "signedOut" },
): FakeRemote {
	let redirectText: string | null = null;
	let gate: Promise<void> | null = null;
	let confirmGate: Promise<void> | null = null;
	let changeGate: Promise<void> | null = null;
	function hold(assign: (gate: Promise<void>) => void): () => void {
		let release: () => void = () => {};
		assign(
			new Promise<void>((resolve) => {
				release = resolve;
			}),
		);
		return release;
	}
	function renameOwnAccount(name: string, confirm: boolean) {
		if (fake.state.status !== "signedIn") {
			throw new Error("not signed in");
		}
		fake.state = {
			...fake.state,
			displayName: name,
			nameConfirmed: confirm || fake.state.nameConfirmed,
		};
	}
	const fake: FakeRemote = {
		state,
		signInCalls: [],
		signOutCalls: 0,
		preloadCalls: 0,
		confirmCalls: [],
		changeCalls: [],
		failGetAccount: false,
		failSignIn: false,
		failSignOut: false,
		failConfirmDisplayName: false,
		failChangeDisplayName: false,
		holdConfirmDisplayName() {
			return hold((g) => {
				confirmGate = g;
			});
		},
		holdChangeDisplayName() {
			return hold((g) => {
				changeGate = g;
			});
		},
		holdGetAccount() {
			return hold((g) => {
				gate = g;
			});
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
		async confirmDisplayName(name) {
			fake.confirmCalls.push(name);
			if (confirmGate) {
				await confirmGate;
			}
			if (fake.failConfirmDisplayName) {
				throw new Error("confirm failed");
			}
			renameOwnAccount(name, true);
		},
		async changeDisplayName(name) {
			fake.changeCalls.push(name);
			if (changeGate) {
				await changeGate;
			}
			if (fake.failChangeDisplayName) {
				throw new Error("change failed");
			}
			renameOwnAccount(name, false);
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
