import { utcDayIndex } from "./utc";

// The first Daily's UTC day. Not the generator's SCHEDULE_EPOCH: the public
// number and the generator's start day are different concepts.
export const PUZZLE_EPOCH = "2026-09-09";

export function puzzleNumber(date: string): number {
	return utcDayIndex(date, PUZZLE_EPOCH) + 1;
}
