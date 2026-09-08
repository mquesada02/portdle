import { expect, test } from "vitest";
import { getDaily } from "./daily";
import type { CatalogEntry, ScheduleFile } from "./types";

const http: CatalogEntry = {
	id: "http",
	name: "HTTP",
	port: 80,
	transport: "tcp",
	description: "Hypertext Transfer Protocol.",
	answerEligible: true,
};
const vite: CatalogEntry = {
	id: "vite",
	name: "Vite",
	port: 5173,
	transport: "tcp",
	description: "Vite default development server.",
	answerEligible: true,
};

const mixedSchedule: ScheduleFile = {
	epoch: "2026-09-09",
	cycles: [{ startDay: 0, order: ["vite", "http"] }],
};

test("getDaily mixed day 0 is Vite", () => {
	const entry = getDaily("mixed", "2026-09-09", mixedSchedule, [http], [vite]);
	expect(entry?.id).toBe("vite");
	expect(entry?.name).toBe("Vite");
	expect(entry?.port).toBe(5173);
});

test("getDaily mixed day 1 is HTTP", () => {
	expect(
		getDaily("mixed", "2026-09-10", mixedSchedule, [http], [vite])?.id,
	).toBe("http");
});

test("getDaily returns null when uncovered", () => {
	expect(
		getDaily("mixed", "2026-12-01", mixedSchedule, [http], [vite]),
	).toBeNull();
});

test("getDaily returns null before epoch", () => {
	expect(
		getDaily("mixed", "2026-09-08", mixedSchedule, [http], [vite]),
	).toBeNull();
});
