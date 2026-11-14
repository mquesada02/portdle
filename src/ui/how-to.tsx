import { useEffect, useLayoutEffect, useRef } from "react";
import { HowToRulesList } from "./how-to-copy";

export function HowTo({
	open,
	instant = false,
	onDismiss,
}: {
	open: boolean;
	// Opens with no fade-in. It still fades out when it closes.
	instant?: boolean;
	onDismiss: () => void;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	// A layout effect: the How-to opens in the commit that sets `open`, before
	// the passive effects of that commit, so a dialog that those effects open
	// (the Name confirm) stays above it.
	useLayoutEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	useEffect(() => {
		if (!open) {
			return;
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onDismiss();
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [open, onDismiss]);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled by the document-level listener above; Got it is the click's keyboard equivalent.
		<dialog
			ref={dialogRef}
			aria-labelledby="how-to-title"
			data-instant={instant || undefined}
			className="m-auto max-w-sm bg-transparent p-0 backdrop:bg-black/50 dark:backdrop:bg-black/70"
			onClick={(event) => {
				if (event.target === dialogRef.current) {
					onDismiss();
				}
			}}
		>
			<div className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
				<h2 id="how-to-title" className="text-xl font-bold">
					How-to
				</h2>
				<div className="mt-4 text-zinc-700 dark:text-zinc-300">
					<HowToRulesList />
				</div>
				{/* Got it comes first in the DOM so it keeps the initial focus. */}
				<div className="mt-5 flex flex-row-reverse items-center justify-between">
					<button
						type="button"
						onClick={onDismiss}
						className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
					>
						Got it
					</button>
					<a
						href={`${import.meta.env.BASE_URL}privacy.html`}
						target="_blank"
						rel="noopener"
						className="text-sm text-zinc-500 underline dark:text-zinc-400"
					>
						Privacy
					</a>
				</div>
			</div>
		</dialog>
	);
}
