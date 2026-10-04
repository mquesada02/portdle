import { expect, test } from "vitest";
import { validateSchedules } from "./schedule-gen";
import type { CatalogEntry } from "./types";

function entry(
	id: string,
	port: number,
	extra: Partial<CatalogEntry> = {},
): CatalogEntry {
	return {
		id,
		name: id,
		port,
		transport: "tcp",
		description: id,
		answerEligible: true,
		...extra,
	};
}

const epoch = "2026-09-09";
const protocols = [entry("http", 80), entry("ssh", 22), entry("dns", 53)];
const applications = [
	entry("vite", 5173),
	entry("flask", 5000),
	entry("django", 8000),
];

test("validateSchedules flags a same-day collision after today", () => {
	const colliding = {
		mixed: {
			epoch,
			cycles: [{ startDay: 0, order: ["vite", "http", "ssh"] }],
		},
		protocols: {
			epoch,
			cycles: [{ startDay: 0, order: ["http", "http", "dns"] }],
		},
		applications: {
			epoch,
			cycles: [{ startDay: 0, order: ["vite", "flask", "django"] }],
		},
	};
	expect(
		validateSchedules({
			utcToday: epoch,
			protocols,
			applications,
			schedules: colliding,
		}).some((issue) => issue.includes("same-day collision")),
	).toBe(true);
});
