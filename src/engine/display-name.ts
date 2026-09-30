import {
	DISPLAY_NAME_ANCHOR_RANGES,
	DISPLAY_NAME_RANGES,
} from "./display-name-ranges.ts";

const codePoint = (n: number) => `\\u{${n.toString(16)}}`;
const toClass = (ranges: readonly (readonly [number, number])[]) =>
	ranges
		.map(([lo, hi]) =>
			lo === hi ? codePoint(lo) : `${codePoint(lo)}-${codePoint(hi)}`,
		)
		.join("");
const ALLOWED = new RegExp(`^[${toClass(DISPLAY_NAME_RANGES)} '.-]+$`, "u");
const HAS_LETTER_OR_DIGIT = new RegExp(
	`[${toClass(DISPLAY_NAME_ANCHOR_RANGES)}]`,
	"u",
);
const MAX_LENGTH = 30;

// Matches the `accounts_display_name_valid` CHECK. Both sides use the same
// explicit code point ranges (letters, non-spacing and spacing marks, decimal
// digits) so neither depends on a locale or on a Unicode version. A name also
// needs at least one letter or decimal digit.
export function validateDisplayName(name: string): string | null {
	const length = [...name].length;
	if (length < 1 || length > MAX_LENGTH) {
		return "Use 1 to 30 characters.";
	}
	if (!ALLOWED.test(name)) {
		return "Use letters, digits, spaces, apostrophes, hyphens, and periods.";
	}
	if (!HAS_LETTER_OR_DIGIT.test(name)) {
		return "Include at least one letter or digit.";
	}
	return null;
}
