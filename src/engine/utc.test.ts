import { expect, test } from "vitest";
import {
	addUtcDays,
	isLate,
	nextUtcMidnightMs,
	utcDateString,
	utcDayIndex,
	yesterdayUtc,
} from "./utc";

test("utcDateString uses UTC calendar date", () => {
	expect(utcDateString(new Date("2026-09-09T00:30:00Z"))).toBe("2026-09-09");
	expect(utcDateString(new Date("2026-09-09T23:59:00-03:00"))).toBe(
		"2026-09-10",
	);
});

test("utcDayIndex is 0 on epoch", () => {
	expect(utcDayIndex("2026-09-09", "2026-09-09")).toBe(0);
	expect(utcDayIndex("2026-09-10", "2026-09-09")).toBe(1);
});

test("yesterdayUtc and addUtcDays", () => {
	expect(yesterdayUtc("2026-09-09")).toBe("2026-09-08");
	expect(addUtcDays("2026-09-09", 7)).toBe("2026-09-16");
});

test("nextUtcMidnightMs is strictly after the instant", () => {
	const midnight = Date.parse("2026-09-10T00:00:00.000Z");
	expect(nextUtcMidnightMs(midnight - 1)).toBe(midnight);
	expect(nextUtcMidnightMs(midnight)).toBe(midnight + 86_400_000);
	expect(nextUtcMidnightMs(Date.parse("2026-09-10T13:30:00Z"))).toBe(
		midnight + 86_400_000,
	);
});

test("isLate is true only when the server today is after the day", () => {
	expect(isLate("2026-09-10", "2026-09-10")).toBe(false);
	expect(isLate("2026-09-10", "2026-09-11")).toBe(true);
	expect(isLate("2026-09-10", "2026-09-09")).toBe(false);
});
