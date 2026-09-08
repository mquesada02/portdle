import { expect, test } from "vitest";
import { formatShare } from "./share";

test("share win on try 3", () => {
	expect(
		formatShare({
			category: "mixed",
			date: "2026-09-09",
			status: "won",
			committed: 3,
		}),
	).toBe("Portdle · Mixed · 2026-09-09 · 3/6\n\n⬜⬜🟩");
});

test("share win on try 1", () => {
	expect(
		formatShare({
			category: "mixed",
			date: "2026-09-09",
			status: "won",
			committed: 1,
		}),
	).toBe("Portdle · Mixed · 2026-09-09 · 1/6\n\n🟩");
});

test("share loss is X/6 and six empty squares", () => {
	expect(
		formatShare({
			category: "mixed",
			date: "2026-09-09",
			status: "lost",
			committed: 6,
		}),
	).toBe("Portdle · Mixed · 2026-09-09 · X/6\n\n⬜⬜⬜⬜⬜⬜");
});

test("share labels Protocols and Applications", () => {
	expect(
		formatShare({
			category: "protocols",
			date: "2026-09-09",
			status: "won",
			committed: 1,
		}),
	).toBe("Portdle · Protocols · 2026-09-09 · 1/6\n\n🟩");
	expect(
		formatShare({
			category: "applications",
			date: "2026-09-09",
			status: "lost",
			committed: 6,
		}),
	).toBe("Portdle · Applications · 2026-09-09 · X/6\n\n⬜⬜⬜⬜⬜⬜");
});
