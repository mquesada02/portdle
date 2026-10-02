import type { DailyCategory, ScheduleRow } from "../engine/types";
import {
	AccountGoneError,
	type AccountState,
	type Catalog,
	type CurrentDailies,
	LEADERBOARD_TOP,
	type LeaderboardPage,
	type LeaderboardQuery,
	type LeaderboardRow,
	NEWEST_RUNS,
	type Provider,
	type Remote,
	type SyncedRows,
} from "../remote/remote";
import {
	fixtureCatalog,
	fixtureEntryIds,
	fixtureScheduleRows,
	UTC_TODAY,
} from "./dailies";

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

export function leaderboardId(query: LeaderboardQuery): string {
	return `${query.window}|${query.category}|${query.orientation}|${query.mode}`;
}

export type FakeRemote = Remote & {
	state: AccountState;
	signInCalls: Provider[];
	signOutCalls: number;
	deleteCalls: number;
	preloadCalls: number;
	confirmCalls: string[];
	changeCalls: string[];
	failGetAccount: boolean;
	failSignIn: boolean;
	failSignOut: boolean;
	failDeleteAccount: boolean;
	failConfirmDisplayName: boolean;
	failChangeDisplayName: boolean;
	rows: SyncedRows;
	getAccountCalls: number;
	pullCalls: number;
	pushCalls: SyncedRows[];
	pushAccounts: string[];
	failPull: boolean;
	failPush: boolean;
	// Ranked rows per `leaderboardId`, as the views return them.
	leaderboards: Record<string, LeaderboardRow[]>;
	leaderboardCalls: LeaderboardQuery[];
	// How many pushes had completed when each leaderboard read arrived.
	pushesAtRead: number[];
	failLeaderboard: boolean;
	gone: boolean;
	reorderKeys: boolean;
	// What the public reads serve. `today` is the server's UTC date; the
	// current Dailies and the Schedule rows follow it unless overridden.
	catalog: Catalog;
	today: string;
	entryIds: Record<DailyCategory, string> | null;
	scheduleRows: ScheduleRow[] | null;
	catalogCalls: number;
	dailiesCalls: number;
	scheduleCalls: number;
	failCatalog: boolean;
	failDailies: boolean;
	failSchedule: boolean;
	holdCatalog(): () => void;
	holdDailies(): () => void;
	holdSchedule(): () => void;
	holdPull(): () => void;
	holdPush(): () => void;
	holdLeaderboard(): () => void;
	holdConfirmDisplayName(): () => void;
	holdChangeDisplayName(): () => void;
	holdDeleteAccount(): () => void;
	holdGetAccount(): () => void;
	setRedirectError(text: string | null): void;
};

// Fakes that share one `rows` object act as devices of the same account.
export function createFakeRemote(
	state: AccountState = { status: "signedOut" },
	rows: SyncedRows = emptyRows(),
): FakeRemote {
	let catalogGate: Promise<void> | null = null;
	let dailiesGate: Promise<void> | null = null;
	let scheduleGate: Promise<void> | null = null;
	let pullGate: Promise<void> | null = null;
	let pushGate: Promise<void> | null = null;
	let leaderboardGate: Promise<void> | null = null;
	let completedPushes = 0;
	let redirectText: string | null = null;
	let gate: Promise<void> | null = null;
	let confirmGate: Promise<void> | null = null;
	let changeGate: Promise<void> | null = null;
	let deleteGate: Promise<void> | null = null;
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
		deleteCalls: 0,
		preloadCalls: 0,
		confirmCalls: [],
		changeCalls: [],
		failGetAccount: false,
		failSignIn: false,
		failSignOut: false,
		failDeleteAccount: false,
		failConfirmDisplayName: false,
		failChangeDisplayName: false,
		rows,
		getAccountCalls: 0,
		pullCalls: 0,
		pushCalls: [],
		pushAccounts: [],
		failPull: false,
		failPush: false,
		leaderboards: {},
		leaderboardCalls: [],
		pushesAtRead: [],
		failLeaderboard: false,
		gone: false,
		reorderKeys: false,
		catalog: fixtureCatalog(),
		today: UTC_TODAY,
		entryIds: null,
		scheduleRows: null,
		catalogCalls: 0,
		dailiesCalls: 0,
		scheduleCalls: 0,
		failCatalog: false,
		failDailies: false,
		failSchedule: false,
		holdCatalog() {
			return hold((g) => {
				catalogGate = g;
			});
		},
		holdDailies() {
			return hold((g) => {
				dailiesGate = g;
			});
		},
		holdSchedule() {
			return hold((g) => {
				scheduleGate = g;
			});
		},
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
		holdLeaderboard() {
			return hold((g) => {
				leaderboardGate = g;
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
		holdDeleteAccount() {
			return hold((g) => {
				deleteGate = g;
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
			fake.getAccountCalls += 1;
			// The state a request sees is the state when it is sent.
			const current = fake.state;
			if (gate) {
				await gate;
			}
			// A dropped sign-in has no user left to look up.
			if (current.status === "signedOut") {
				return current;
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
		async deleteAccount() {
			fake.deleteCalls += 1;
			if (deleteGate) {
				await deleteGate;
			}
			if (fake.gone) {
				throw new AccountGoneError();
			}
			if (fake.failDeleteAccount) {
				throw new Error("delete failed");
			}
			fake.state = { status: "signedOut" };
			// In place: fakes that share `rows` are devices of this account.
			Object.assign(fake.rows, emptyRows());
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
			completedPushes += 1;
		},
		async readLeaderboard(query): Promise<LeaderboardPage> {
			fake.leaderboardCalls.push(query);
			fake.pushesAtRead.push(completedPushes);
			// The answer a request gets is the one held when it is sent.
			const viewerId =
				fake.state.status === "signedIn" ? fake.state.accountId : null;
			const held = clone(fake.leaderboards[leaderboardId(query)] ?? []);
			if (leaderboardGate) {
				await leaderboardGate;
			}
			if (fake.failLeaderboard) {
				throw new Error("leaderboard failed");
			}
			const rows = held
				.filter(
					(row) => row.rank <= LEADERBOARD_TOP || row.accountId === viewerId,
				)
				.sort((a, b) => a.rank - b.rank);
			return { rows, viewerId };
		},
		async readCatalog(): Promise<Catalog> {
			fake.catalogCalls += 1;
			if (catalogGate) {
				await catalogGate;
			}
			if (fake.failCatalog) {
				throw new Error("catalog failed");
			}
			return clone(fake.catalog);
		},
		async readCurrentDailies(): Promise<CurrentDailies> {
			fake.dailiesCalls += 1;
			if (dailiesGate) {
				await dailiesGate;
			}
			if (fake.failDailies) {
				throw new Error("current Dailies failed");
			}
			return {
				today: fake.today,
				entryIds: clone(fake.entryIds ?? fixtureEntryIds(fake.today)),
			};
		},
		async readSchedule(): Promise<ScheduleRow[]> {
			fake.scheduleCalls += 1;
			if (scheduleGate) {
				await scheduleGate;
			}
			if (fake.failSchedule) {
				throw new Error("schedule failed");
			}
			return clone(fake.scheduleRows ?? fixtureScheduleRows(fake.today));
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
