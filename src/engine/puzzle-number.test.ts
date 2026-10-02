import { expect, test } from "vitest";
import { puzzleNumber } from "./puzzle-number";

test("the first Daily is #1", () => {
	expect(puzzleNumber("2026-09-09")).toBe(1);
	expect(puzzleNumber("2026-09-10")).toBe(2);
});

test("a later day counts the days since the epoch plus one", () => {
	expect(puzzleNumber("2026-09-30")).toBe(22);
	expect(puzzleNumber("2026-10-01")).toBe(23);
	expect(puzzleNumber("2026-10-02")).toBe(24);
});
