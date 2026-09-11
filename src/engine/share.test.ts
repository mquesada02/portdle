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
		}),
	).toBe("Portdle · Mixed · 2026-09-09 · 3/6\n\n⬜🟨⬜🟩\n🟨🟩⬜🟨\n🟩🟩🟩🟩");
});

test("share win on try 1", () => {
	const rows: Mark[][] = [["placed", "placed", "placed"]];
	expect(
		formatShare({
			category: "mixed",
			date: "2026-09-09",
			status: "won",
			rows,
		}),
	).toBe("Portdle · Mixed · 2026-09-09 · 1/6\n\n🟩🟩🟩");
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
		}),
	).toBe(
		"Portdle · Mixed · 2026-09-09 · X/6\n\n⬜⬜\n🟨⬜\n⬜🟨\n🟩⬜\n⬜🟩\n🟨🟨",
	);
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
		}),
	).toBe(
		"Portdle · Mixed · 2026-09-09 · 6/6\n\n⬜⬜\n🟨⬜\n⬜🟨\n🟩⬜\n⬜🟩\n🟩🟩",
	);
});

test("share labels Protocols and Applications", () => {
	expect(
		formatShare({
			category: "protocols",
			date: "2026-09-09",
			status: "won",
			rows: [["placed"]],
		}),
	).toBe("Portdle · Protocols · 2026-09-09 · 1/6\n\n🟩");
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
		}),
	).toBe("Portdle · Applications · 2026-09-09 · X/6\n\n⬜\n⬜\n⬜\n⬜\n⬜\n⬜");
});
