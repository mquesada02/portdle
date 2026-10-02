import { expect, test } from "vitest";
import type { Mark } from "./marks";
import { formatShare } from "./share";

test("share win on try 3", () => {
	const rows: Mark[][] = [
		["absent", "present", "absent", "placed"],
		["present", "placed", "absent", "present"],
		["placed", "placed", "placed", "placed"],
	];
	expect(
		formatShare({
			category: "mixed",
			date: "2026-09-09",
			status: "won",
			rows,
			late: false,
		}),
	).toBe("Portdle #1 · Mixed · 3/6\n\n⬜🟨⬜🟩\n🟨🟩⬜🟨\n🟩🟩🟩🟩");
});

test("share win on try 1", () => {
	const rows: Mark[][] = [["placed", "placed", "placed"]];
	expect(
		formatShare({
			category: "mixed",
			date: "2026-09-09",
			status: "won",
			rows,
			late: false,
		}),
	).toBe("Portdle #1 · Mixed · 1/6\n\n🟩🟩🟩");
});

test("share loss is X/6 with six rows", () => {
	const rows: Mark[][] = [
		["absent", "absent"],
		["present", "absent"],
		["absent", "present"],
		["placed", "absent"],
		["absent", "placed"],
		["present", "present"],
	];
	expect(
		formatShare({
			category: "mixed",
			date: "2026-09-09",
			status: "lost",
			rows,
			late: false,
		}),
	).toBe("Portdle #1 · Mixed · X/6\n\n⬜⬜\n🟨⬜\n⬜🟨\n🟩⬜\n⬜🟩\n🟨🟨");
});

test("share win completed on the sixth try reads 6/6, distinct from a six-row loss", () => {
	const rows: Mark[][] = [
		["absent", "absent"],
		["present", "absent"],
		["absent", "present"],
		["placed", "absent"],
		["absent", "placed"],
		["placed", "placed"],
	];
	expect(
		formatShare({
			category: "mixed",
			date: "2026-09-09",
			status: "won",
			rows,
			late: false,
		}),
	).toBe("Portdle #1 · Mixed · 6/6\n\n⬜⬜\n🟨⬜\n⬜🟨\n🟩⬜\n⬜🟩\n🟩🟩");
});

test("share labels Protocols and Applications", () => {
	expect(
		formatShare({
			category: "protocols",
			date: "2026-09-09",
			status: "won",
			rows: [["placed"]],
			late: false,
		}),
	).toBe("Portdle #1 · Protocols · 1/6\n\n🟩");
	expect(
		formatShare({
			category: "applications",
			date: "2026-09-09",
			status: "lost",
			rows: [
				["absent"],
				["absent"],
				["absent"],
				["absent"],
				["absent"],
				["absent"],
			],
			late: false,
		}),
	).toBe("Portdle #1 · Applications · X/6\n\n⬜\n⬜\n⬜\n⬜\n⬜\n⬜");
});

test("a late win and a late loss end with late", () => {
	expect(
		formatShare({
			category: "mixed",
			date: "2026-09-30",
			status: "won",
			rows: [["placed"], ["placed"], ["placed"]],
			late: true,
		}),
	).toBe("Portdle #22 · Mixed · 3/6 · late\n\n🟩\n🟩\n🟩");
	expect(
		formatShare({
			category: "mixed",
			date: "2026-09-30",
			status: "lost",
			rows: [["absent"]],
			late: true,
		}),
	).toBe("Portdle #22 · Mixed · X/6 · late\n\n⬜");
});

test("a four-digit puzzle number has no thousands separator", () => {
	expect(
		formatShare({
			category: "mixed",
			date: "2029-06-04",
			status: "won",
			rows: [["placed"]],
			late: false,
		}),
	).toBe("Portdle #1000 · Mixed · 1/6\n\n🟩");
});
