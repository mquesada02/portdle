import {
	type FormEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { validateDisplayName } from "../engine/display-name";
import { AccountGoneError, type Provider, type Remote } from "../remote/remote";
import type { Sync } from "../sync/sync";
import {
	DISPLAY_NAME_HINT,
	SAVE_FAILURE,
	SIGN_OUT_FAILURE,
} from "./display-name-copy";
import { NameConfirm } from "./name-confirm";

type View =
	| { kind: "loading" }
	| { kind: "signedOut" }
	| { kind: "signedIn"; displayName: string; nameConfirmed: boolean }
	| { kind: "loadFailed" };

const PROVIDERS = [
	["google", "Google"],
	["github", "GitHub"],
] as const satisfies readonly (readonly [Provider, string])[];

const PENCIL = "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4";

const MENU_BUTTON =
	"w-full rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function AccountMenu({
	remote,
	sync,
	buttonClassName,
	icon,
}: {
	remote: Remote;
	sync?: Sync;
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
	const [editing, setEditing] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

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
						displayName: account.displayName,
						nameConfirmed: account.nameConfirmed,
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
	}, [remote, sync, redirectError]);

	useEffect(
		() =>
			sync?.onAccountGone(() => {
				setView({ kind: "signedOut" });
				setEditing(null);
				setError(null);
			}),
		[sync],
	);

	// A pending rename keeps the menu open, so its result lands on the field.
	const savingName = editing !== null && busy;

	const close = useCallback(() => {
		if (!savingName) {
			setOpen(false);
			setEditing(null);
		}
	}, [savingName]);

	useEffect(() => {
		if (!open) {
			return;
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
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
	}, [open, close]);

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

	function saveName(event: FormEvent) {
		event.preventDefault();
		if (editing === null || busy || validateDisplayName(editing) !== null) {
			return;
		}
		const name = editing;
		return run(async () => {
			await remote.changeDisplayName(name);
			setView((current) =>
				current.kind === "signedIn"
					? { ...current, displayName: name }
					: current,
			);
			setEditing(null);
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
												onClick={() => {
													setEditing(null);
													setError(null);
												}}
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
			{view.kind === "signedIn" && !view.nameConfirmed && (
				<NameConfirm
					initialName={view.displayName}
					onConfirm={async (name) => {
						await remote.confirmDisplayName(name);
						setView({
							kind: "signedIn",
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
