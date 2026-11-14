import {
	type Ref,
	useEffect,
	useImperativeHandle,
	useRef,
	useSyncExternalStore,
} from "react";

const COARSE_POINTER = "(pointer: coarse)";

function subscribeCoarsePointer(onChange: () => void) {
	const query = window.matchMedia(COARSE_POINTER);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

// A touch screen: the digit keypad replaces the native keyboard and the
// separate Submit button. The stylesheet shows and hides them on the same
// query from the first paint, so the prerendered page does not shift; this
// value only sets what JavaScript must set (the input mode, and which of the
// two controls assistive tech sees). The prerender and hydration assume a
// fine pointer.
export function useCoarsePointer(): boolean {
	return useSyncExternalStore(
		subscribeCoarsePointer,
		() => window.matchMedia(COARSE_POINTER).matches,
		() => false,
	);
}

// What the digit keypad drives: a key goes in the way a typed key does.
export type DigitSlotsHandle = {
	press(key: string): void;
};

export const SLOT_KEYS = [
	"digit-1",
	"digit-2",
	"digit-3",
	"digit-4",
	"digit-5",
] as const;

export function DigitSlots({
	length,
	value,
	disabled,
	onChange,
	onSubmit,
	shakeKey = 0,
	ref,
}: {
	length: number;
	value: string;
	disabled: boolean;
	onChange: (digits: string) => void;
	onSubmit: () => void;
	shakeKey?: number;
	ref?: Ref<DigitSlotsHandle>;
}) {
	const coarse = useCoarsePointer();
	const refs = useRef<Array<HTMLInputElement | null>>([]);
	// Mirrors `value`, but updated synchronously inside insertAt/deleteAt
	// before the resulting focusSlot() call. A .focus() call fires its
	// target's onFocus handler synchronously, before React has committed
	// the onChange update, so that handler must read this ref rather than
	// the (still stale) `value` closure to avoid redirecting focus using
	// last render's digit count.
	const valueRef = useRef(value);
	valueRef.current = value;

	function focusSlot(index: number) {
		refs.current[Math.max(0, Math.min(index, length - 1))]?.focus();
	}

	function focusForValue() {
		focusSlot(Math.min(valueRef.current.length, length - 1));
	}

	// Updates the value ref (synchronously, so a focus handler triggered by
	// the focusSlot() call below never reads a stale digit count) and moves
	// focus to the given slot.
	function commit(next: string, focusIndex: number, moveFocus = true) {
		valueRef.current = next;
		onChange(next);
		if (moveFocus) {
			focusSlot(focusIndex);
		}
	}

	// Mount only: the slot at the current value length is focused, unless the
	// focus is inside an open overlay: a dialog (the Name confirm) or the open
	// Account menu, either of which can open before the slots mount.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount, per the slot behavior table.
	useEffect(() => {
		if (!document.activeElement?.closest("dialog, [data-open-overlay]")) {
			focusForValue();
		}
	}, []);

	// Shake key changes: the row plays the shake animation and focus
	// returns to the slot at the current value length.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only shakeKey should retrigger this.
	useEffect(() => {
		if (shakeKey > 0) {
			focusForValue();
		}
	}, [shakeKey]);

	function insertAt(index: number, text: string, moveFocus = true) {
		const digits = text.replace(/\D/g, "");
		if (digits.length === 0) {
			return;
		}
		const next = (
			value.slice(0, index) +
			digits +
			value.slice(index + digits.length)
		).slice(0, length);
		commit(next, index + digits.length, moveFocus);
	}

	function deleteAt(index: number, moveFocus = true) {
		if (index < value.length) {
			commit(value.slice(0, index) + value.slice(index + 1), index, moveFocus);
		} else if (index > 0) {
			commit(value.slice(0, index - 1), index - 1, moveFocus);
		}
	}

	// A key goes in at the focused slot, and the focus moves as it does for a
	// typed key. With no slot focused (a screen reader on the keypad), it goes
	// in at the end and the focus stays on the keypad.
	useImperativeHandle(ref, () => ({
		press(key: string) {
			const focused = refs.current.indexOf(
				document.activeElement as HTMLInputElement | null,
			);
			const inSlot = focused >= 0;
			const index = inSlot ? focused : valueRef.current.length;
			if (key === "Backspace") {
				deleteAt(index, inSlot);
			} else {
				insertAt(index, key, inSlot);
			}
		},
	}));

	return (
		<fieldset disabled={disabled}>
			<legend className="sr-only">Port digits</legend>
			<div
				key={shakeKey}
				className={`flex gap-1.5 ${shakeKey > 0 ? "animate-shake" : ""}`}
			>
				{SLOT_KEYS.slice(0, length).map((key, index) => (
					<input
						key={key}
						ref={(element) => {
							refs.current[index] = element;
						}}
						aria-label={`Digit ${index + 1} of ${length}`}
						inputMode={coarse ? "none" : "numeric"}
						autoComplete="one-time-code"
						value={value[index] ?? ""}
						onChange={(event) => {
							const data = (event.nativeEvent as InputEvent).data;
							if (data) {
								insertAt(index, data);
							} else if (event.target.value === "") {
								deleteAt(index);
							}
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								onSubmit();
							} else if (event.key === "Backspace") {
								event.preventDefault();
								deleteAt(index);
							} else if (event.key === "ArrowLeft") {
								event.preventDefault();
								focusSlot(index - 1);
							} else if (event.key === "ArrowRight") {
								event.preventDefault();
								focusSlot(Math.min(index + 1, value.length));
							} else if (/^\d$/.test(event.key)) {
								event.preventDefault();
								insertAt(index, event.key);
							}
						}}
						onPaste={(event) => {
							event.preventDefault();
							insertAt(index, event.clipboardData.getData("text"));
						}}
						onFocus={(event) => {
							if (index > valueRef.current.length) {
								focusSlot(valueRef.current.length);
								return;
							}
							event.target.select();
						}}
						className={`h-14 w-12 rounded-md border-2 bg-transparent text-center font-mono text-2xl font-bold caret-transparent outline-none transition-colors ${
							value[index]
								? "border-zinc-500 dark:border-zinc-400"
								: "border-zinc-300 dark:border-zinc-700"
						} focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/20`}
					/>
				))}
			</div>
		</fieldset>
	);
}
