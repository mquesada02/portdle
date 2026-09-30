import { DAILY_CATEGORIES } from "../engine/types";
import { isValidTimestamp } from "../engine/utc";
import type { Persist } from "../persist/storage";

// Rows Sync could import: a run needs a valid `endedAt`, a Daily must read back.
function holdsProgress(persist: Persist): boolean {
	return (
		Object.keys(persist.readCodex()).length > 0 ||
		Object.keys(persist.readBlitzBests()).length > 0 ||
		persist.readBlitzRuns().some((run) => isValidTimestamp(run.endedAt)) ||
		DAILY_CATEGORIES.some((category) =>
			persist
				.listDailyDates(category)
				.some((date) => persist.readDaily(category, date) !== null),
		)
	);
}

// A different account is signing in on a device that holds progress and last
// synced with another account: the player chooses before anything is pushed.
// A device that never synced is never pending.
export function deviceChoicePending(
	persist: Persist,
	accountId: string,
): boolean {
	const last = persist.readSyncAccount();
	return last !== null && last !== accountId && holdsProgress(persist);
}
