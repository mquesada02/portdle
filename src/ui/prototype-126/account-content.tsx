// PROTOTYPE — throwaway. Shared account-surface content (sign-in, display
// name edit, sign-out, delete) reused inside each variant's own placement
// (dropdown for A/B, sheet section for C). See issue #126.
import { useState } from "react";
import { FAKE_USER } from "./fake-data";

const PRIMARY_BUTTON =
	"w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900";
const OAUTH_BUTTON =
	"flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800";

export function AccountSignedOut() {
	return (
		<div>
			<h2 className="text-sm font-semibold">Sign in</h2>
			<p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
				Syncs your Codex, bests, and streaks across devices, and adds you to
				leaderboards. Local play stays as-is either way.
			</p>
			<div className="mt-3 flex flex-col gap-2">
				<button type="button" className={OAUTH_BUTTON}>
					<span aria-hidden="true">●</span> Continue with Google
				</button>
				<button type="button" className={OAUTH_BUTTON}>
					<span aria-hidden="true">◆</span> Continue with GitHub
				</button>
			</div>
		</div>
	);
}

export function AccountSignedIn() {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(FAKE_USER.displayName);
	const [confirmDelete, setConfirmDelete] = useState(false);

	return (
		<div>
			<h2 className="text-sm font-semibold">Account</h2>
			<div className="mt-3">
				<span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
					Display name
				</span>
				{editing ? (
					<div className="mt-1 flex gap-2">
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							maxLength={30}
							className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
						/>
						<button
							type="button"
							className="rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
							onClick={() => setEditing(false)}
						>
							Save
						</button>
					</div>
				) : (
					<div className="mt-1 flex items-center justify-between">
						<span className="text-base font-semibold">{name}</span>
						<button
							type="button"
							className="text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
							onClick={() => setEditing(true)}
						>
							Edit
						</button>
					</div>
				)}
				<p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">
					Signed in with {FAKE_USER.provider === "github" ? "GitHub" : "Google"}
				</p>
			</div>
			<button
				type="button"
				className={`mt-4 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
			>
				Sign out
			</button>
			<div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
				{confirmDelete ? (
					<div className="rounded-lg border border-rose-300 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
						<p className="text-xs text-rose-800 dark:text-rose-300">
							Deletes your account, sync data, and leaderboard rows. This
							device's local data is cleared too. Cannot be undone.
						</p>
						<div className="mt-2 flex gap-2">
							<button
								type="button"
								className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
							>
								Delete account
							</button>
							<button
								type="button"
								className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
								onClick={() => setConfirmDelete(false)}
							>
								Cancel
							</button>
						</div>
					</div>
				) : (
					<button
						type="button"
						className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
						onClick={() => setConfirmDelete(true)}
					>
						Delete account
					</button>
				)}
			</div>
		</div>
	);
}

export { PRIMARY_BUTTON };
