const pgEscape = (c: number) =>
	c <= 0xffff
		? `\\u${c.toString(16).padStart(4, "0")}`
		: `\\U${c.toString(16).padStart(8, "0")}`;

// PostgreSQL bracket-expression body for code point ranges. The escapes work
// inside a bracket expression and do not depend on the database locale.
export function rangesToPgClass(
	ranges: readonly (readonly [number, number])[],
): string {
	return ranges
		.map(([lo, hi]) =>
			lo === hi ? pgEscape(lo) : `${pgEscape(lo)}-${pgEscape(hi)}`,
		)
		.join("");
}

// E'...' literal for a test string; every character except ASCII letters,
// digits, and the space is escaped, so the literal is safe and readable.
export function toPgLiteral(s: string): string {
	const body = [...s]
		.map((ch) =>
			/[A-Za-z0-9 ]/.test(ch) ? ch : pgEscape(ch.codePointAt(0) as number),
		)
		.join("");
	return `E'${body}'`;
}
