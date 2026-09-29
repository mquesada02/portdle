import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Provider, Remote } from "../remote/remote";

type View =
	| { kind: "loading" }
	| { kind: "signedOut" }
	| { kind: "signedIn"; displayName: string }
	| { kind: "loadFailed" };

const PROVIDERS = [
	["google", "Google"],
	["github", "GitHub"],
] as const satisfies readonly (readonly [Provider, string])[];

const MENU_BUTTON =
	"w-full rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function AccountMenu({
	remote,
	buttonClassName,
	icon,
}: {
	remote: Remote;
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
					setView({ kind: "signedIn", displayName: account.displayName });
					setError(null);
				} else {
					setView({ kind: "signedOut" });
				}
			},
			() => {
				if (cancelled || redirectError !== null) {
					return;
				}
				setView({ kind: "loadFailed" });
				setError("Could not load your account.");
			},
		);
		return () => {
			cancelled = true;
		};
	}, [remote, redirectError]);

	useEffect(() => {
		if (!open) {
			return;
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setOpen(false);
				buttonRef.current?.focus();
			}
		}
		function handleMouseDown(event: MouseEvent) {
			if (!containerRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("mousedown", handleMouseDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("mousedown", handleMouseDown);
		};
	}, [open]);

	function toggle() {
		if (!open) {
			remote.preload();
		}
		setOpen(!open);
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

	function signOut() {
		return run(async () => {
			await remote.signOut();
			setView({ kind: "signedOut" });
		}, "Could not sign out. Try again.");
	}

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
							<p className="truncate font-semibold">{view.displayName}</p>
							{signOutButton}
						</>
					)}
					{view.kind === "loadFailed" && signOutButton}
					{error !== null && (
						<p role="alert" className="text-sm text-red-600 dark:text-red-400">
							{error}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
