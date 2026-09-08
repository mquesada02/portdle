import { expect, test } from "vitest";
import { catalogFor } from "./catalog";
import type { CatalogEntry } from "./types";

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

test("catalogFor mixed unions protocols then applications", () => {
	expect(catalogFor("mixed", [http], [vite]).map((entry) => entry.id)).toEqual([
		"http",
		"vite",
	]);
});

test("catalogFor protocols and applications are the source arrays", () => {
	expect(catalogFor("protocols", [http], [vite])).toEqual([http]);
	expect(catalogFor("applications", [http], [vite])).toEqual([vite]);
});
