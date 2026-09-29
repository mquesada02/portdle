const ALLOWED = /^[\p{L}\p{Nd} '.-]+$/u;
const MAX_LENGTH = 30;

// Matches the `accounts_display_name_valid` CHECK. `\p{Nd}` keeps the client
// from accepting number-like characters that `[[:alnum:]]` may reject.
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
