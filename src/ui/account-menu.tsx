import {
	type FormEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { validateDisplayName } from "../engine/display-name";
import type { Persist } from "../persist/storage";
import type { Provider, Remote } from "../remote/remote";
import {
	addDeviceProgress,
	deviceChoicePending,
} from "../sync/device-progress";
import type { AccountReport, Sync } from "../sync/sync";
import { useAfterFirstRenderEffect } from "./after-first-render";
import { DeleteAccount } from "./delete-account";
import { DEVICE_CHOICE_FAILURE } from "./device-choice-copy";
import { DeviceProgressChoice } from "./device-progress-choice";
import {
	DISPLAY_NAME_HINT,
	SAVE_FAILURE,
	SIGN_OUT_FAILURE,
} from "./display-name-copy";
import { NameConfirm } from "./name-confirm";

type View =
	| { kind: "loading" }
	| { kind: "signedOut" }
	| {
			kind: "signedIn";
			accountId: string;
			displayName: string;
			nameConfirmed: boolean;
			// A pull cannot run while this is set, so a pull never changes it.
			choicePending: boolean;
	  }
	| { kind: "loadFailed" };

const PROVIDERS = [
	["google", "Google"],
	["github", "GitHub"],
] as const satisfies readonly (readonly [Provider, string])[];

const PENCIL = "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4";

const MENU_BUTTON =
	"w-full rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function AccountMenu({
	persist,
	remote,
	sync,
	remount,
	buttonClassName,
	icon,
}: {
	persist: Persist;
	remote: Remote;
	sync: Sync;
	remount: () => void;
	buttonClassName: string;
	icon: ReactNode;
}) {
	// The OAuth redirect error is browser-only state (the URL), so the first
	// render is closed and loading. A layout effect reads it once. It lives in a
	// ref as well: the account-report effect runs in the same commit, before the
	// state below updates, and must not report a failed read over this error.
	const redirectErrorRef = useRef<string | null>(null);
	const [open, setOpen] = useState(false);
	const [view, setView] = useState<View>({ kind: "loading" });
	const [error, setError] = useState<string | null>(null);
	useAfterFirstRenderEffect(() => {
		// Never overwrite with null: the passive effect below clears the error
		// at the source, and StrictMode runs this effect again after it.
		const pending = remote.redirectError();
		if (pending === null) {
			return;
		}
		redirectErrorRef.current = pending;
		setOpen(true);
		setView({ kind: "signedOut" });
		setError(pending);
	});
	const [busy, setBusy] = useState(false);
	const [choiceBusy, setChoiceBusy] = useState(false);
	const [choiceFailure, setChoiceFailure] = useState<string | null>(null);
	const [editing, setEditing] = useState<string | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const pencilRef = useRef<HTMLButtonElement>(null);
	const fieldRef = useRef<HTMLInputElement>(null);
	// Set when an edit ends by Save, Cancel, or Escape, so focus goes back to
	// the pencil; closing the menu never sets it.
	const pencilFocusPending = useRef(false);
	// Set when a save fails, so focus returns to the field once the call ends.
	const fieldFocusPending = useRef(false);

	const viewRef = useRef(view);
	viewRef.current = view;

	// Sync makes the account read at load and reports it.
	useEffect(() => {
		remote.clearRedirectError();
		function onReport(report: AccountReport) {
			if (report.status === "signedIn") {
				if (viewRef.current.kind === "signedIn") {
					setView((current) =>
						current.kind === "signedIn"
							? {
									...current,
									displayName: report.displayName,
									nameConfirmed: report.nameConfirmed,
								}
							: current,
					);
					return;
				}
				setView({
					kind: "signedIn",
					accountId: report.accountId,
					displayName: report.displayName,
					nameConfirmed: report.nameConfirmed,
					choicePending: deviceChoicePending(persist, report.accountId),
				});
				setError(null);
			} else if (viewRef.current.kind === "loading") {
				if (report.status === "signedOut") {
					setView({ kind: "signedOut" });
				} else if (redirectErrorRef.current === null) {
					setView({ kind: "loadFailed" });
					setError("Could not load your account.");
				}
			}
		}
		return sync.onAccount(onReport);
	}, [remote, sync, persist]);

	useEffect(
		() =>
			sync.onAccountGone(() => {
				setView({ kind: "signedOut" });
				setEditing(null);
				setError(null);
				setDeleteOpen(false);
			}),
		[sync],
	);

	// A pending rename keeps the menu open, so its result lands on the field.
	const savingName = editing !== null && busy;

	const close = useCallback(() => {
		if (!savingName) {
			pencilFocusPending.current = false;
			setOpen(false);
			setEditing(null);
		}
	}, [savingName]);

	const isEditing = editing !== null;

	useEffect(() => {
		if (isEditing) {
			fieldRef.current?.focus();
		} else if (pencilFocusPending.current) {
			pencilRef.current?.focus();
		}
		pencilFocusPending.current = false;
	}, [isEditing]);

	useEffect(() => {
		if (!busy && fieldFocusPending.current) {
			fieldFocusPending.current = false;
			fieldRef.current?.focus();
		}
	}, [busy]);

	const endEdit = useCallback(() => {
		pencilFocusPending.current = true;
		setEditing(null);
		setError(null);
	}, []);

	useEffect(() => {
		if (!open) {
			return;
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				if (isEditing) {
					// A pending call keeps the edit, like every other close.
					if (!busy) {
						endEdit();
					}
					return;
				}
				close();
				buttonRef.current?.focus();
			}
		}
		function handleMouseDown(event: MouseEvent) {
			if (!containerRef.current?.contains(event.target as Node)) {
				close();
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("mousedown", handleMouseDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("mousedown", handleMouseDown);
		};
	}, [open, close, endEdit, isEditing, busy]);

	function toggle() {
		if (open) {
			close();
			return;
		}
		remote.preload();
		setOpen(true);
	}

	async function run(action: () => Promise<void>, failure: string) {
		setError(null);
		setBusy(true);
		try {
			await action();
		} catch {
			setError(failure);
		} finally {
			setBusy(false);
		}
	}

	function signIn(provider: Provider) {
		return run(
			() => remote.signIn(provider),
			"Could not start sign-in. Try again.",
		);
	}

	async function endSession() {
		await remote.signOut();
		sync.stop();
		setView({ kind: "signedOut" });
		setEditing(null);
	}

	function signOut() {
		return run(endSession, SIGN_OUT_FAILURE);
	}

	function clearChoicePending() {
		setView((current) =>
			current.kind === "signedIn"
				? { ...current, choicePending: false }
				: current,
		);
	}

	// Another tab may have chosen already; then this tab must not act.
	function beginChoice(accountId: string): boolean {
		setChoiceFailure(null);
		if (deviceChoicePending(persist, accountId)) {
			return true;
		}
		clearChoicePending();
		return false;
	}

	function addProgress(accountId: string) {
		if (!beginChoice(accountId)) {
			return;
		}
		if (!addDeviceProgress(persist, accountId)) {
			setChoiceFailure(DEVICE_CHOICE_FAILURE);
			return;
		}
		clearChoicePending();
		void sync.refresh();
	}

	async function startFromAccount(accountId: string) {
		if (!beginChoice(accountId)) {
			return;
		}
		// Never reset: the remount below discards this state.
		setChoiceBusy(true);
		sync.stop();
		persist.clearAll();
		// Ignored on failure: an empty device is not pending, and the pull
		// writes the id again.
		persist.writeSyncAccount(accountId);
		await sync.refresh();
		remount();
	}

	function saveName(event: FormEvent) {
		event.preventDefault();
		if (editing === null || busy || validateDisplayName(editing) !== null) {
			return;
		}
		const name = editing;
		return run(async () => {
			fieldFocusPending.current = true;
			await remote.changeDisplayName(name);
			fieldFocusPending.current = false;
			setView((current) =>
				current.kind === "signedIn"
					? { ...current, displayName: name }
					: current,
			);
			pencilFocusPending.current = true;
			setEditing(null);
			void sync.refresh();
		}, SAVE_FAILURE);
	}

	const nameError = editing === null ? null : validateDisplayName(editing);
	const message = nameError ?? error;

	const signOutButton = (
		<button
			type="button"
			disabled={busy}
			onClick={signOut}
			className={MENU_BUTTON}
		>
			Sign out
		</button>
	);

	return (
		<>
			<div
				ref={containerRef}
				data-open-overlay={open ? "" : undefined}
				className="relative"
			>
				<button
					ref={buttonRef}
					type="button"
					aria-label="Account"
					aria-expanded={open}
					aria-controls={open ? "account-menu" : undefined}
					className={buttonClassName}
					onClick={toggle}
				>
					{icon}
				</button>
				{open && (
					<div
						id="account-menu"
						className="absolute right-0 top-full mt-2 flex w-64 flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
					>
						{view.kind === "loading" && (
							<p className="text-sm">Loading account.</p>
						)}
						{view.kind === "signedOut" &&
							PROVIDERS.map(([provider, label]) => (
								<button
									key={provider}
									type="button"
									disabled={busy}
									onClick={() => signIn(provider)}
									className={MENU_BUTTON}
								>
									Sign in with {label}
								</button>
							))}
						{view.kind === "signedIn" && (
							<>
								{editing === null ? (
									<div className="flex items-center gap-2">
										<p className="min-w-0 flex-1 truncate font-semibold">
											{view.displayName}
										</p>
										<button
											ref={pencilRef}
											type="button"
											aria-label="Edit display name"
											onClick={() => {
												setError(null);
												setEditing(view.displayName);
											}}
											className="rounded-full p-1 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
										>
											<svg
												aria-hidden="true"
												viewBox="0 0 24 24"
												className="size-4"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<path d={PENCIL} />
											</svg>
										</button>
									</div>
								) : (
									<form onSubmit={saveName} className="flex flex-col gap-2">
										<input
											ref={fieldRef}
											type="text"
											aria-label="Display name"
											value={editing}
											readOnly={busy}
											aria-invalid={nameError !== null}
											onChange={(event) => {
												setEditing(event.target.value);
												setError(null);
											}}
											className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
										/>
										<p className="text-xs text-zinc-500 dark:text-zinc-400">
											{DISPLAY_NAME_HINT}
										</p>
										<div className="flex gap-2">
											<button
												type="submit"
												disabled={busy || nameError !== null}
												className={MENU_BUTTON}
											>
												Save
											</button>
											<button
												type="button"
												disabled={busy}
												onClick={endEdit}
												className={MENU_BUTTON}
											>
												Cancel
											</button>
										</div>
									</form>
								)}
								{signOutButton}
								<button
									type="button"
									disabled={busy}
									onClick={() => {
										setOpen(false);
										setEditing(null);
										setError(null);
										setDeleteOpen(true);
									}}
									className={MENU_BUTTON}
								>
									Delete account
								</button>
							</>
						)}
						{view.kind === "loadFailed" && signOutButton}
						{message !== null && (
							<p
								role="alert"
								className="text-sm text-red-600 dark:text-red-400"
							>
								{message}
							</p>
						)}
					</div>
				)}
			</div>
			{deleteOpen && (
				<DeleteAccount
					onConfirm={() => sync.deleteAccount()}
					onCancel={() => {
						setDeleteOpen(false);
						buttonRef.current?.focus();
					}}
				/>
			)}
			{view.kind === "signedIn" && view.choicePending && (
				<DeviceProgressChoice
					busy={choiceBusy}
					failure={choiceFailure}
					onAdd={() => addProgress(view.accountId)}
					onStart={() => void startFromAccount(view.accountId)}
				/>
			)}
			{view.kind === "signedIn" &&
				!view.choicePending &&
				!view.nameConfirmed && (
					<NameConfirm
						initialName={view.displayName}
						onConfirm={async (name) => {
							await remote.confirmDisplayName(name);
							setView({
								...view,
								displayName: name,
								nameConfirmed: true,
							});
							void sync.refresh();
						}}
						onSignOut={endSession}
					/>
				)}
		</>
	);
}
