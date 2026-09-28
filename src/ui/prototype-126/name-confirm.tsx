// PROTOTYPE — throwaway. One-time name-confirm screen (#124 decision 8).
// Same full-page takeover regardless of placement variant. See issue #126.
import { useState } from "react";
import { SEEDED_NAME } from "./fake-data";

export function NameConfirmScreen() {
	const [name, setName] = useState(SEEDED_NAME);
	return (
		<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
			<div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
				<h1 className="text-xl font-bold">Confirm your display name</h1>
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
					We've filled in the name from your GitHub account. It's public on
					leaderboards — edit it now if you'd rather not use it.
				</p>
				<input
					value={name}
					onChange={(event) => setName(event.target.value)}
					maxLength={30}
					className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-950"
				/>
				<p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">
					1–30 characters. Letters, digits, spaces, apostrophe, hyphen, period.
				</p>
				<button
					type="button"
					className="mt-4 w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
				>
					Continue
				</button>
			</div>
		</div>
	);
}
