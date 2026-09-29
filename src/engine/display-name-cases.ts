// Edge-case names shared by the Vitest rule test and the database parity test
// (supabase/tests/display-name-parity.sql). Intended verdicts follow Spec 4:
// letters in any script (with their combining marks), decimal digits in any
// script, spaces, apostrophes, hyphens, periods; nothing else, and at least one
// letter or digit (a name of only marks and separators is invalid). Only the plain
// space is allowed; format characters (ZWJ, ZWNJ), symbols, and emoji are not.
export const DISPLAY_NAME_CASES: readonly {
	label: string;
	name: string;
	valid: boolean;
}[] = [
	{ label: "Latin, precomposed accent", name: "Zoë", valid: true },
	{ label: "Latin, decomposed accent", name: "Zoé", valid: true },
	{ label: "CJK", name: "李", valid: true },
	{ label: "CJK, astral", name: "\u{20000}", valid: true },
	{ label: "Cyrillic", name: "Иван", valid: true },
	{ label: "Arabic letters", name: "أحمد", valid: true },
	{
		label: "Devanagari with vowel signs",
		name: "हिंदी",
		valid: true,
	},
	{ label: "ASCII digits", name: "Agent 007", valid: true },
	{ label: "Arabic-Indic digit", name: "Ada٣", valid: true },
	{ label: "Fullwidth digit", name: "Ada３", valid: true },
	{ label: "Letter-like symbol N", name: "ℕ", valid: true },
	{
		label: "Apostrophe, hyphen, period",
		name: "O'Neil-Smith Jr.",
		valid: true,
	},
	{ label: "One digit", name: "7", valid: true },
	{ label: "One letter plus marks", name: "a\u0301\u0302", valid: true },
	{ label: "Marks only", name: "\u0301\u0302", valid: false },
	{ label: "Marks plus spaces", name: "\u0301 \u0302", valid: false },
	{ label: "Apostrophe, hyphen, period only", name: "'.-", valid: false },
	{ label: "Superscript digit", name: "Ada²", valid: false },
	{ label: "Vulgar fraction", name: "Ada½", valid: false },
	{ label: "Roman numeral", name: "AdaⅫ", valid: false },
	{ label: "Underscore", name: "Ada_L", valid: false },
	{ label: "Punctuation", name: "Ada!", valid: false },
	{ label: "Tab", name: "Ada\tL", valid: false },
	{ label: "Newline", name: "Ada\nL", valid: false },
	{ label: "C1 control", name: "Ada\u0085L", valid: false },
	{ label: "Non-breaking space", name: "Ada\u00a0L", valid: false },
	{ label: "Zero-width joiner", name: "Ada\u200dL", valid: false },
	{ label: "Zero-width non-joiner", name: "Ada\u200cL", valid: false },
	{ label: "Emoji", name: "Ada \u{1f600}", valid: false },
	{
		label: "Emoji ZWJ sequence",
		name: "\u{1f468}\u200d\u{1f469}",
		valid: false,
	},
	{ label: "Keycap emoji", name: "1\ufe0f\u20e3", valid: false },
	{ label: "Variation selector", name: "Ada\ufe0f", valid: false },
];
