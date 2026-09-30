import { useEffect, useRef, useState } from "react";
import { DELETE_ACCOUNT_WARNING, DELETE_FAILURE } from "./display-name-copy";

export function DeleteAccount({
	onConfirm,
	onCancel,
}: {
	onConfirm: () => Promise<void>;
	onCancel: () => void;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (dialog && !dialog.open) {
			dialog.showModal();
		}
	}, []);

	function cancel() {
		if (!busy) {
			// A native modal makes the rest of the page inert, so the dialog must
			// close before onCancel moves focus outside it.
			dialogRef.current?.close();
			onCancel();
		}
	}

	async function confirm() {
		setFailure(null);
		setBusy(true);
		try {
			await onConfirm();
		} catch {
			setFailure(DELETE_FAILURE);
			setBusy(false);
		}
		// On success the buttons stay disabled: the remount replaces this dialog.
	}

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="delete-account-title"
			className="m-auto max-w-sm bg-transparent p-0 backdrop:bg-black/50 dark:backdrop:bg-black/70"
			// Escape must not reach the How-to's or the menu's document listeners,
			// and a native close would leave the dialog open in React while busy.
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					cancel();
				}
			}}
			onCancel={(event) => {
				event.preventDefault();
				cancel();
			}}
			onClose={() => {
				const dialog = dialogRef.current;
				if (busy && dialog && !dialog.open) {
					dialog.showModal();
				}
			}}
			onClick={(event) => {
				if (event.target === dialogRef.current) {
					cancel();
				}
			}}
		>
			<div className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
				<h2 id="delete-account-title" className="text-xl font-bold">
					Delete account
				</h2>
				<p className="mt-4 text-zinc-700 dark:text-zinc-300">
					{DELETE_ACCOUNT_WARNING}
				</p>
				<p
					role="alert"
					className="mt-3 min-h-5 text-sm text-red-600 dark:text-red-400"
				>
					{failure}
				</p>
				<div className="mt-3 flex justify-end gap-2">
					<button
						type="button"
						disabled={busy}
						onClick={cancel}
						className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={confirm}
						className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
					>
						Delete account
					</button>
				</div>
			</div>
		</dialog>
	);
}
