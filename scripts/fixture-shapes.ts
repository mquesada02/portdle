// The pure part of the fixture shape check (scripts/check-fixture-shapes.ts):
// the shape of a list of rows or of an OpenAPI definition, and the comparison
// of two shapes. A shape maps each key to the sorted JSON types of its
// non-null values. An empty list means the type is unknown.

export type Shape = Record<string, string[]>;

function jsonType(value: unknown): string {
	return Array.isArray(value) ? "array" : typeof value;
}

export function shapeOfRows(rows: Record<string, unknown>[]): Shape {
	const types: Record<string, Set<string>> = {};
	for (const row of rows) {
		for (const [key, value] of Object.entries(row)) {
			const set = types[key] ?? new Set<string>();
			types[key] = set;
			if (value !== null) {
				set.add(jsonType(value));
			}
		}
	}
	return Object.fromEntries(
		Object.entries(types).map(([key, set]) => [key, [...set].sort()]),
	);
}

const OPENAPI_TYPES: Record<string, string> = {
	string: "string",
	integer: "number",
	number: "number",
	boolean: "boolean",
	array: "array",
	object: "object",
};

// A property with no `type` (a jsonb column) has an unknown type.
export function shapeOfDefinition(definition: {
	properties: Record<string, { type?: string }>;
}): Shape {
	return Object.fromEntries(
		Object.entries(definition.properties).map(([key, property]) => {
			if (property.type === undefined) {
				return [key, []];
			}
			const type = OPENAPI_TYPES[property.type];
			if (!type) {
				throw new Error(
					`The OpenAPI property ${key} has the type ${property.type}, which the shape check does not map.`,
				);
			}
			return [key, [type]];
		}),
	);
}

// One line per difference; an empty list means the shapes match. A key whose
// type is unknown on one side matches any type.
export function compareShapes(
	endpoint: string,
	fixture: Shape,
	backend: Shape,
): string[] {
	const lines: string[] = [];
	for (const key of Object.keys(backend)) {
		if (!(key in fixture)) {
			lines.push(`${endpoint}: ${key} is missing in the fixture`);
		}
	}
	for (const [key, fixtureTypes] of Object.entries(fixture)) {
		const backendTypes = backend[key];
		if (!backendTypes) {
			lines.push(`${endpoint}: ${key} is missing in the backend`);
		} else if (
			fixtureTypes.length > 0 &&
			backendTypes.length > 0 &&
			fixtureTypes.join() !== backendTypes.join()
		) {
			lines.push(
				`${endpoint}: ${key}: fixture ${fixtureTypes.join(", ")}, backend ${backendTypes.join(", ")}`,
			);
		}
	}
	return lines;
}
