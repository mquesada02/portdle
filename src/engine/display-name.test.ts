import { expect, test } from "vitest";
import { validateDisplayName } from "./display-name";
import { DISPLAY_NAME_CASES } from "./display-name-cases";

test.each(DISPLAY_NAME_CASES.filter((c) => c.valid))(
	"accepts the shared case: $label",
	({ name }) => {
		expect(validateDisplayName(name)).toBeNull();
	},
);

test.each(DISPLAY_NAME_CASES.filter((c) => !c.valid))(
	"rejects the shared case: $label",
	({ name }) => {
		expect(validateDisplayName(name)).toEqual(expect.any(String));
	},
);

test.each([
	"Ada",
	"A",
	"Zoë-李 O'Neil.",
	"a".repeat(30),
	"\u{20000}".repeat(30),
	"Agent 007",
])("accepts %j", (name) => {
	expect(validateDisplayName(name)).toBeNull();
});

test.each([
	["empty", ""],
	["spaces only", "   "],
	["31 characters", "a".repeat(31)],
	["31 astral letters", "\u{20000}".repeat(31)],
	["emoji", "Ada 😀"],
	["punctuation", "Ada!"],
	["a tab", "Ada\tL"],
	["a newline", "Ada\nL"],
	["U+0000", "Ada\u0000"],
])("rejects %s with a message", (_label, name) => {
	expect(validateDisplayName(name)).toEqual(expect.any(String));
});
