import type { RefObject } from "react";
import { type DigitSlotsHandle, useCoarsePointer } from "./digit-slots";

const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const KEY =
	"h-14 rounded-lg bg-zinc-100 text-xl font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

// The Submit control of the digit slots. A fine pointer gets the Submit
// button; a touch screen gets a 3x4 keypad whose last key submits, so the
// native keyboard never opens (issue 325). The stylesheet picks one from the
// first paint; `aria-hidden` hides the other one from assistive tech once the
// page knows the pointer.
export function DigitSubmit({
	slots,
	onSubmit,
	buttonClassName,
}: {
	slots: RefObject<DigitSlotsHandle | null>;
	onSubmit: () => void;
	buttonClassName: string;
}) {
	const coarse = useCoarsePointer();
	const press = (key: string) => slots.current?.press(key);
	// The key keeps the focus where it was: on a slot, so the next key goes in
	// after it, and off the keypad, so no native keyboard opens.
	const keepFocus = (event: { preventDefault(): void }) =>
		event.preventDefault();
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
				{DIGIT_KEYS.map((key) => (
					<button
						key={key}
						type="button"
						className={KEY}
						onPointerDown={keepFocus}
						onClick={() => press(key)}
					>
						{key}
					</button>
				))}
				<button
					type="button"
					aria-label="Backspace"
					className={KEY}
					onPointerDown={keepFocus}
					onClick={() => press("Backspace")}
				>
					<span aria-hidden="true">⌫</span>
				</button>
				<button
					type="button"
					className={KEY}
					onPointerDown={keepFocus}
					onClick={() => press("0")}
				>
					0
				</button>
				<button
					type="button"
					className="h-14 rounded-lg bg-zinc-900 text-base font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
					onPointerDown={keepFocus}
					onClick={onSubmit}
				>
					Submit
				</button>
			</fieldset>
		</>
	);
}
