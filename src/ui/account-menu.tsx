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
import { AccountGoneError, type Provider, type Remote } from "../remote/remote";
import { deviceChoicePending } from "../sync/device-progress";
import type { Sync } from "../sync/sync";
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
	sync?: Sync;
	remount: () => void;
	buttonClassName: string;
	icon: ReactNode;
}) {
	const [redirectError] = useState(() => remote.redirectError());
	const [open, setOpen] = useState(redirectError !== null);
	const [view, setView] = useState<View>(
		redirectError === null ? { kind: "loading" } : { kind: "signedOut" },
	);
	const [error, setError] = useState<string | null>(redirectError);
	const [busy, setBusy] = useState(false);
	const [choiceBusy, setChoiceBusy] = useState(false);
	const [choiceFailure, setChoiceFailure] = useState<string | null>(null);
	const [editing, setEditing] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const pencilRef = useRef<HTMLButtonElement>(null);
	const fieldRef = useRef<HTMLInputElement>(null);
	// Set when an edit ends by Save, Cancel, or Escape, so focus goes back to
	// the pencil; closing the menu never sets it.
	const pencilFocusPending = useRef(false);
	// Set when a save fails, so focus returns to the field once the call ends.
	const fieldFocusPending = useRef(false);

	useEffect(() => {
		remote.clearRedirectError();
		let cancelled = false;
		remote.getAccount().then(
			(account) => {
				if (cancelled) {
					return;
				}
				if (account.status === "signedIn") {
					setView({
						kind: "signedIn",
						accountId: account.accountId,
						displayName: account.displayName,
						nameConfirmed: account.nameConfirmed,
						choicePending: deviceChoicePending(persist, account.accountId),
					});
					setError(null);
				} else {
					setView({ kind: "signedOut" });
				}
			},
			(reason: unknown) => {
				if (cancelled) {
					return;
				}
				if (reason instanceof AccountGoneError) {
					void sync?.accountGone();
					setView({ kind: "signedOut" });
					return;
				}
				if (redirectError !== null) {
					return;
				}
				setView({ kind: "loadFailed" });
				setError("Could not load your account.");
			},
		);
		return () => {
			cancelled = true;
		};
	}, [remote, sync, persist, redirectError]);

	useEffect(
		() =>
			sync?.onAccountGone(() => {
				setView({ kind: "signedOut" });
				setEditing(null);
				setError(null);
			}),
		[sync],
	);

	// A name changed on another device shows after the next pull. A rename
	// here is followed by a refresh, so a stale read corrects itself.
	useEffect(
		() =>
			sync?.onAccount((account) => {
				if (account.status !== "signedIn") {
					return;
				}
				setView((current) =>
					current.kind === "signedIn"
						? {
								...current,
								displayName: account.displayName,
								nameConfirmed: account.nameConfirmed,
							}
						: current,
				);
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
		sync?.stop();
		setView({ kind: "signedOut" });
		setEditing(null);
	}

	function signOut() {
		return run(endSession, SIGN_OUT_FAILURE);
	}

	async function choose(start: boolean) {
		if (view.kind !== "signedIn") {
			return;
		}
		const { accountId } = view;
		setChoiceFailure(null);
		// Another tab may have chosen already; then this tab must not act.
		if (!deviceChoicePending(persist, accountId)) {
			setView({ ...view, choicePending: false });
			return;
		}
		if (start) {
			setChoiceBusy(true);
			sync?.stop();
			persist.clearAll();
			// Ignored on failure: an empty device is not pending, and the pull
			// writes the id again.
			persist.writeSyncAccount(accountId);
			await sync?.refresh();
			remount();
			return;
		}
		if (!persist.writeSyncAccount(accountId).ok) {
			setChoiceFailure(DEVICE_CHOICE_FAILURE);
			return;
		}
		setView({ ...view, choicePending: false });
		void sync?.refresh();
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
			void sync?.refresh();
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
			<div ref={containerRef} className="relative">
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
			{view.kind === "signedIn" && view.choicePending && (
				<DeviceProgressChoice
					busy={choiceBusy}
					failure={choiceFailure}
					onAdd={() => void choose(false)}
					onStart={() => void choose(true)}
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
							void sync?.refresh();
						}}
						onSignOut={endSession}
					/>
				)}
		</>
	);
}
