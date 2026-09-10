export function ProgressNotice({ show }: { show: boolean }) {
	if (!show) {
		return null;
	}
	return (
		<p
			role="status"
			className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
		>
			Progress may not save.
		</p>
	);
}
