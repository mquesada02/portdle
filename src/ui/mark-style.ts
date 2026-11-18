import type { Mark } from "../engine/marks";

// One color per mark, shared by the tiles, the tracker strip and the touch
// keypad. Placed reuses the correct-guess green, absent reuses the existing
// miss gray. Both placed and present use dark text for contrast against
// their bright backgrounds (white-on-emerald-500 and white-on-yellow-500
// both fail WCAG AA; dark zinc-900 text passes on both). Placed and present keep one shade for
// both themes (their saturated colors already read clearly on light and
// dark surfaces); absent, closer to gray, needs a dark: shade to stay
// legible against both.
export const MARK_BACKGROUND: Record<Mark, string> = {
	placed: "bg-emerald-500 text-zinc-900",
	present: "bg-yellow-500 text-zinc-900",
	absent: "bg-zinc-500 text-white dark:bg-zinc-600",
};

// A digit that has no mark yet (never typed).
const UNKNOWN_MARK =
	"bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

// The colours of a digit with its best-known mark, or of one with none.
export function markClasses(mark: Mark | undefined): string {
	return mark === undefined ? UNKNOWN_MARK : MARK_BACKGROUND[mark];
}

// The accessible text every tile, tracker digit and keypad key exposes, in
// the form "digit, mark" (or "digit, unknown" when the digit has never been
// typed).
export function markLabel(digit: string, mark: Mark | undefined): string {
	return mark ? `${digit}, ${mark}` : `${digit}, unknown`;
}
