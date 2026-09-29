import { expect, test } from "vitest";
import { validateDisplayName } from "./display-name";

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
	["a superscript digit", "Ada²"],
])("rejects %s with a message", (_label, name) => {
	expect(validateDisplayName(name)).toEqual(expect.any(String));
});
