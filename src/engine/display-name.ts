import { DISPLAY_NAME_RANGES } from "./display-name-ranges.ts";

const codePoint = (n: number) => `\\u{${n.toString(16)}}`;
const CLASS = DISPLAY_NAME_RANGES.map(([lo, hi]) =>
	lo === hi ? codePoint(lo) : `${codePoint(lo)}-${codePoint(hi)}`,
).join("");
const ALLOWED = new RegExp(`^[${CLASS} '.-]+$`, "u");
const MAX_LENGTH = 30;

// Matches the `accounts_display_name_valid` CHECK. Both sides use the same
// explicit code point ranges (letters, non-spacing and spacing marks, decimal
// digits) so neither depends on a locale or on a Unicode version.
export function validateDisplayName(name: string): string | null {
	const length = [...name].length;
	if (length < 1 || length > MAX_LENGTH || !/[^ ]/.test(name)) {
		return "Use 1 to 30 characters.";
	}
	if (!ALLOWED.test(name)) {
		return "Use letters, digits, spaces, apostrophes, hyphens, and periods.";
	}
	return null;
}
