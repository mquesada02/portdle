import type { PointerEvent, RefObject } from "react";
import type { Mark } from "../engine/marks";
import { type DigitSlotsHandle, useCoarsePointer } from "./digit-slots";
import { MARK_BACKGROUND, markLabel, UNKNOWN_MARK } from "./mark-style";

const BACKSPACE = "Backspace";

// The dialer order: 1 to 9, then Backspace, 0 and the Submit key.
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", BACKSPACE, "0"];

// The focus ring matches the digit slots', for a hardware keyboard.
const FOCUS_RING =
	"outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/40 dark:focus-visible:ring-zinc-100/40";
const KEY = `h-14 rounded-lg text-xl font-semibold ${FOCUS_RING}`;
const PLAIN_KEY_COLOURS =
	"bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

function keyLabel(
	key: string,
	marks: ReadonlyMap<string, Mark> | undefined,
): string | undefined {
	if (key === BACKSPACE) return BACKSPACE;
	return marks ? markLabel(key, marks.get(key)) : undefined;
}

function keyColours(
	key: string,
	marks: ReadonlyMap<string, Mark> | undefined,
): string {
	if (!marks || key === BACKSPACE) return PLAIN_KEY_COLOURS;
	const mark = marks.get(key);
	return mark ? MARK_BACKGROUND[mark] : UNKNOWN_MARK;
}

// A key keeps the focus where it was: on a slot, so the next key goes in
// after it, and off the keypad, so no native keyboard opens.
const keepFocus = (event: PointerEvent) => event.preventDefault();

// The Submit control of the digit slots. A fine pointer gets the Submit
// button; a touch screen gets a 3x4 keypad whose last key submits, so the
// native keyboard never opens (issue 325). The stylesheet picks one from the
// first paint; `aria-hidden` hides the other one from assistive tech once the
// page knows the pointer. With `marks` (the Daily), each digit key takes the
// colours and the name of its best-known mark (issue 338); without it (Blitz)
// the keys stay plain.
export function DigitSubmit({
	slots,
	marks,
	onSubmit,
	buttonClassName,
}: {
	slots: RefObject<DigitSlotsHandle | null>;
	marks?: ReadonlyMap<string, Mark>;
	onSubmit: () => void;
	buttonClassName: string;
}) {
	const coarse = useCoarsePointer();
	return (
		<>
			<div aria-hidden={coarse || undefined} className="pointer-coarse:hidden">
				<button type="button" onClick={onSubmit} className={buttonClassName}>
					Submit
				</button>
			</div>
			<fieldset
				aria-hidden={!coarse || undefined}
				className="mt-3 hidden grid-cols-3 gap-2 pointer-coarse:grid"
			>
				<legend className="sr-only">Keypad</legend>
				{KEYS.map((key) => (
					<button
						key={key}
						type="button"
						aria-label={keyLabel(key, marks)}
						className={`${KEY} ${keyColours(key, marks)}`}
						onPointerDown={keepFocus}
						onClick={() =>
							key === BACKSPACE
								? slots.current?.backspace()
								: slots.current?.insert(key)
						}
					>
						{key === BACKSPACE ? <span aria-hidden="true">⌫</span> : key}
					</button>
				))}
				<button
					type="button"
					className={`h-14 rounded-lg bg-zinc-900 text-base font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900 ${FOCUS_RING}`}
					onPointerDown={keepFocus}
					onClick={onSubmit}
				>
					Submit
				</button>
			</fieldset>
		</>
	);
}
