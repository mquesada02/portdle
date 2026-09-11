import { expect, test } from "vitest";
import { bestMarkByDigit, computeMarks } from "./marks";

test("repeated digits with equal counts on both sides are all present", () => {
	expect(computeMarks("2233", "3322")).toEqual([
		"present",
		"present",
		"present",
		"present",
	]);
});

test("mix of placed and absent, with a leftover digit not consumed by placed", () => {
	expect(computeMarks("1230", "1200")).toEqual([
		"placed",
		"placed",
		"absent",
		"placed",
	]);
});

test("a digit typed twice with only one copy in the answer marks one placed and one absent", () => {
	expect(computeMarks("22", "21")).toEqual(["placed", "absent"]);
});

test("typed digits identical to the answer are all placed", () => {
	expect(computeMarks("5173", "5173")).toEqual([
		"placed",
		"placed",
		"placed",
		"placed",
	]);
});

test("a padded leading zero is marked the same way as any other digit", () => {
	expect(computeMarks("0080", "0090")).toEqual([
		"placed",
		"placed",
		"absent",
		"placed",
	]);
});

test("a digit's best mark wins even when the same row also marks another occurrence lower", () => {
	// "8080" vs "8000" marks digit 8 placed at position 0 and absent at
	// position 2, within the same row; the digit's best mark is placed.
	const best = bestMarkByDigit(["8080"], "8000");
	expect(best.get("8")).toBe("placed");
	expect(best.get("0")).toBe("placed");
});

test("a digit's best mark upgrades across rows and a digit never typed is absent from the map", () => {
	const best = bestMarkByDigit(["21", "12"], "12");
	expect(best.get("1")).toBe("placed");
	expect(best.get("2")).toBe("placed");
	expect(best.has("3")).toBe(false);
});
