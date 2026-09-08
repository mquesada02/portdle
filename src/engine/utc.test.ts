import { expect, test } from "vitest";
import { addUtcDays, utcDateString, utcDayIndex, yesterdayUtc } from "./utc";

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
