import {
	AccountGoneError,
	type AccountState,
	NEWEST_RUNS,
	type Provider,
	type Remote,
	type SyncedRows,
} from "../remote/remote";

export function emptyRows(): SyncedRows {
	return { codex: {}, bests: {}, runs: [], dailies: {}, preferences: {} };
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

// The way a jsonb column returns objects: keys in another order.
function reverseKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(reverseKeys);
	}
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.reverse()
				.map(([key, item]) => [key, reverseKeys(item)]),
		);
	}
	return value;
}

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
	rows: SyncedRows;
	pullCalls: number;
	pushCalls: SyncedRows[];
	pushAccounts: string[];
	failPull: boolean;
	failPush: boolean;
	gone: boolean;
	reorderKeys: boolean;
	holdPull(): () => void;
	holdPush(): () => void;
	holdConfirmDisplayName(): () => void;
	holdChangeDisplayName(): () => void;
	holdGetAccount(): () => void;
	setRedirectError(text: string | null): void;
};

// Fakes that share one `rows` object act as devices of the same account.
export function createFakeRemote(
	state: AccountState = { status: "signedOut" },
	rows: SyncedRows = emptyRows(),
): FakeRemote {
	let pullGate: Promise<void> | null = null;
	let pushGate: Promise<void> | null = null;
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
		rows,
		pullCalls: 0,
		pushCalls: [],
		pushAccounts: [],
		failPull: false,
		failPush: false,
		gone: false,
		reorderKeys: false,
		holdPull() {
			return hold((g) => {
				pullGate = g;
			});
		},
		holdPush() {
			return hold((g) => {
				pushGate = g;
			});
		},
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
			// The state a request sees is the state when it is sent.
			const current = fake.state;
			if (gate) {
				await gate;
			}
			if (fake.gone) {
				throw new AccountGoneError();
			}
			if (fake.failGetAccount) {
				throw new Error("get account failed");
			}
			return current;
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
		async pull() {
			fake.pullCalls += 1;
			if (pullGate) {
				await pullGate;
			}
			if (fake.gone) {
				throw new AccountGoneError();
			}
			if (fake.failPull) {
				throw new Error("pull failed");
			}
			const newest = [...fake.rows.runs]
				.sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
				.slice(0, NEWEST_RUNS);
			const copy = clone({ ...fake.rows, runs: newest });
			return fake.reorderKeys ? (reverseKeys(copy) as SyncedRows) : copy;
		},
		async push(accountId, pushed) {
			fake.pushAccounts.push(accountId);
			fake.pushCalls.push(clone(pushed));
			if (pushGate) {
				await pushGate;
			}
			if (fake.gone) {
				throw new AccountGoneError();
			}
			if (fake.failPush) {
				throw new Error("push failed");
			}
			const incoming = clone(pushed);
			Object.assign(fake.rows.codex, incoming.codex);
			Object.assign(fake.rows.bests, incoming.bests);
			Object.assign(fake.rows.dailies, incoming.dailies);
			Object.assign(fake.rows.preferences, incoming.preferences);
			const byEndedAt = new Map(fake.rows.runs.map((r) => [r.endedAt, r]));
			for (const run of incoming.runs) {
				byEndedAt.set(run.endedAt, run);
			}
			fake.rows.runs = [...byEndedAt.values()];
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
