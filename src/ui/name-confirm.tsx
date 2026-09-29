import { type FormEvent, useEffect, useRef, useState } from "react";
import { validateDisplayName } from "../engine/display-name";
import {
	DISPLAY_NAME_HINT,
	SAVE_FAILURE,
	SIGN_OUT_FAILURE,
} from "./display-name-copy";

export function NameConfirm({
	initialName,
	onConfirm,
	onSignOut,
}: {
	initialName: string;
	onConfirm: (name: string) => Promise<void>;
	onSignOut: () => Promise<void>;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [name, setName] = useState(initialName);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const invalid = validateDisplayName(name);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (dialog && !dialog.open) {
			dialog.showModal();
		}
	}, []);

	async function attempt(action: () => Promise<void>, message: string) {
		setFailure(null);
		setBusy(true);
		try {
			await action();
		} catch {
			setFailure(message);
		} finally {
			setBusy(false);
		}
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		if (invalid !== null || busy) {
			return;
		}
		attempt(() => onConfirm(name), SAVE_FAILURE);
	}

	const alert = invalid ?? failure;

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="name-confirm-title"
			className="m-0 h-full max-h-none w-full max-w-none bg-white p-0 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
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
			<form
				onSubmit={submit}
				className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6"
			>
				<h2 id="name-confirm-title" className="text-2xl font-bold">
					Confirm your display name
				</h2>
				<p className="text-zinc-700 dark:text-zinc-300">
					Other players see this name on the Leaderboards.
				</p>
				<label className="flex flex-col gap-1 text-sm font-semibold">
					Display name
					<input
						type="text"
						value={name}
						readOnly={busy}
						aria-invalid={invalid !== null}
						onChange={(event) => {
							setName(event.target.value);
							setFailure(null);
						}}
						className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base font-normal dark:border-zinc-700"
					/>
				</label>
				<p className="text-sm text-zinc-500 dark:text-zinc-400">
					{DISPLAY_NAME_HINT}
				</p>
				<p
					role="alert"
					className="min-h-5 text-sm text-red-600 dark:text-red-400"
				>
					{alert}
				</p>
				<button
					type="submit"
					disabled={busy || invalid !== null}
					className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
				>
					Continue
				</button>
				<button
					type="button"
					disabled={busy}
					onClick={() => attempt(onSignOut, SIGN_OUT_FAILURE)}
					className="self-center text-sm text-zinc-500 underline disabled:opacity-50 dark:text-zinc-400"
				>
					Sign out
				</button>
			</form>
		</dialog>
	);
}
