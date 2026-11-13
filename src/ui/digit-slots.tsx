import { useEffect, useRef } from "react";

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
}: {
	length: number;
	value: string;
	disabled: boolean;
	onChange: (digits: string) => void;
	onSubmit: () => void;
	shakeKey?: number;
}) {
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
	function commit(next: string, focusIndex: number) {
		valueRef.current = next;
		onChange(next);
		focusSlot(focusIndex);
	}

	// Mount only: the slot at the current value length is focused, unless the
	// focus is already inside a dialog. A modal dialog (the Name confirm) can
	// open before the page behind it mounts its slots, and the dialog keeps the
	// focus then.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount, per the slot behavior table.
	useEffect(() => {
		if (!document.activeElement?.closest("dialog")) {
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

	function insertAt(index: number, text: string) {
		const digits = text.replace(/\D/g, "");
		if (digits.length === 0) {
			return;
		}
		const next = (
			value.slice(0, index) +
			digits +
			value.slice(index + digits.length)
		).slice(0, length);
		commit(next, index + digits.length);
	}

	function deleteAt(index: number) {
		if (index < value.length) {
			commit(value.slice(0, index) + value.slice(index + 1), index);
		} else if (index > 0) {
			commit(value.slice(0, index - 1), index - 1);
		}
	}

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
						inputMode="numeric"
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
