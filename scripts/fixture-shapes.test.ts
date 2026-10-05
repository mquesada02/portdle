import { expect, test } from "vitest";
import {
	compareShapes,
	shapeOfDefinition,
	shapeOfRows,
} from "./fixture-shapes.ts";

test("collects the types of the non-null values of each key over all rows", () => {
	const shape = shapeOfRows([
		{ id: "a", blurb: null, n: 1, tags: [], meta: { x: 1 }, ok: true },
		{ id: "b", blurb: "text", n: 2, tags: ["x"], meta: {}, ok: false },
	]);
	expect(shape).toEqual({
		id: ["string"],
		blurb: ["string"],
		n: ["number"],
		tags: ["array"],
		meta: ["object"],
		ok: ["boolean"],
	});
});

test("gives a key that is null in every row an empty type set", () => {
	expect(shapeOfRows([{ blurb: null }, { blurb: null }])).toEqual({
		blurb: [],
	});
});

test("maps OpenAPI property types and gives a typeless property an empty set", () => {
	expect(
		shapeOfDefinition({
			properties: {
				category: { type: "string" },
				players: { type: "integer" },
				ratio: { type: "number" },
				ok: { type: "boolean" },
				aliases: { type: "array" },
				sources: { format: "jsonb" },
			},
		}),
	).toEqual({
		category: ["string"],
		players: ["number"],
		ratio: ["number"],
		ok: ["boolean"],
		aliases: ["array"],
		sources: [],
	});
});

test("rejects an OpenAPI property type that has no mapping", () => {
	expect(() =>
		shapeOfDefinition({ properties: { id: { type: "uuid" } } }),
	).toThrow(/uuid/);
});

test("passes equal shapes", () => {
	expect(
		compareShapes("schedule", { a: ["string"] }, { a: ["string"] }),
	).toEqual([]);
});

test("reports a key that the fixture lacks", () => {
	expect(
		compareShapes(
			"schedule",
			{ a: ["string"] },
			{ a: ["string"], b: ["number"] },
		),
	).toEqual(["schedule: b is missing in the fixture"]);
});

test("reports a key that the backend lacks", () => {
	expect(
		compareShapes(
			"schedule",
			{ a: ["string"], b: ["number"] },
			{ a: ["string"] },
		),
	).toEqual(["schedule: b is missing in the backend"]);
});

test("reports a changed type with both types", () => {
	expect(
		compareShapes("schedule", { a: ["string"] }, { a: ["number"] }),
	).toEqual(["schedule: a: fixture string, backend number"]);
});

test("ignores a key whose type set is empty on one side", () => {
	expect(compareShapes("catalog", { a: [] }, { a: ["string"] })).toEqual([]);
	expect(compareShapes("catalog", { a: ["string"] }, { a: [] })).toEqual([]);
});
