export type Mark = "placed" | "present" | "absent";

// Wordle's two-pass rule. First pass: mark every position where the typed
// digit equals the answer digit at that position as placed, and consume that
// answer digit from the pool. Second pass, left to right over the remaining
// positions: mark present if an unconsumed copy of the typed digit remains
// in the pool, consuming it; otherwise absent. `typed` and `answer` must be
// the same length (the caller pads both to the answer's digit count).
export function computeMarks(typed: string, answer: string): Mark[] {
	const marks: Mark[] = new Array(typed.length).fill("absent");
	const pool: Array<string | null> = answer.split("");

	for (let index = 0; index < typed.length; index += 1) {
		if (typed.charAt(index) === answer.charAt(index)) {
			marks[index] = "placed";
			pool[index] = null;
		}
	}

	for (let index = 0; index < typed.length; index += 1) {
		if (marks[index] === "placed") {
			continue;
		}
		const poolIndex = pool.indexOf(typed.charAt(index));
		if (poolIndex !== -1) {
			marks[index] = "present";
			pool[poolIndex] = null;
		}
	}

	return marks;
}

const MARK_RANK: Record<Mark, number> = { absent: 0, present: 1, placed: 2 };

// The tracker strip's aggregation rule: each digit's best mark among every
// occurrence of that digit at every position of every committed row,
// ranked placed above present above absent. A digit missing from the
// returned map was never typed.
export function bestMarkByDigit(
	typedRows: string[],
	answer: string,
): Map<string, Mark> {
	const best = new Map<string, Mark>();
	for (const typed of typedRows) {
		computeMarks(typed, answer).forEach((mark, index) => {
			const digit = typed.charAt(index);
			const current = best.get(digit);
			if (!current || MARK_RANK[mark] > MARK_RANK[current]) {
				best.set(digit, mark);
			}
		});
	}
	return best;
}
