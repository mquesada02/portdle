import { useEffect, useRef } from "react";
import {
	DEVICE_CHOICE_ADD,
	DEVICE_CHOICE_START,
	DEVICE_CHOICE_TEXT,
	DEVICE_CHOICE_TITLE,
} from "./device-choice-copy";

const BUTTON =
	"rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function DeviceProgressChoice({
	busy,
	failure,
	onAdd,
	onStart,
}: {
	busy: boolean;
	failure: string | null;
	onAdd: () => void;
	onStart: () => void;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (dialog && !dialog.open) {
			dialog.showModal();
		}
	}, []);

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="device-choice-title"
			className="m-auto max-w-sm bg-transparent p-0 backdrop:bg-black/50 dark:backdrop:bg-black/70"
			// Escape must not reach the How-to's or the menu's document listeners,
			// and a browser may close a modal dialog even after `cancel` is prevented.
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
				}
			}}
			onCancel={(event) => event.preventDefault()}
			onClose={() => {
				const dialog = dialogRef.current;
				if (dialog && !dialog.open) {
					dialog.showModal();
				}
			}}
		>
			<div className="flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
				<h2 id="device-choice-title" className="text-xl font-bold">
					{DEVICE_CHOICE_TITLE}
				</h2>
				<p className="text-zinc-700 dark:text-zinc-300">{DEVICE_CHOICE_TEXT}</p>
				<button
					type="button"
					disabled={busy}
					onClick={onAdd}
					className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
				>
					{DEVICE_CHOICE_ADD}
				</button>
				<button
					type="button"
					disabled={busy}
					onClick={onStart}
					className={BUTTON}
				>
					{DEVICE_CHOICE_START}
				</button>
				<p
					role="alert"
					className="min-h-5 text-sm text-red-600 dark:text-red-400"
				>
					{failure}
				</p>
			</div>
		</dialog>
	);
}
