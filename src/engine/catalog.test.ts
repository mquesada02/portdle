import { expect, test } from "vitest";
import { catalogFor } from "./catalog";
import { http, vite } from "./test-fixtures";

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
