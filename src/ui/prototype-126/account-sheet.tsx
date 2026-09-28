// PROTOTYPE — throwaway. Variant C only: top-bar avatar opens a slide-over
// sheet hosting BOTH the account surface and leaderboards, as two internal
// sections. See issue #126.
import { AccountSignedIn, AccountSignedOut } from "./account-content";
import { ICON_BUTTON, NavIcon, PERSON } from "./icons";
import { LeaderboardContent } from "./leaderboard-content";
import { href } from "./shell";

export function AccountSheetButton({
	open,
	section,
	signedIn,
}: {
	open: boolean;
	section: "account" | "leaderboard";
	signedIn: boolean;
}) {
	return (
		<div>
			<a
				href={open ? href({ screen: undefined }) : href({ screen: "account" })}
				aria-label="Account"
				className={ICON_BUTTON}
			>
				<NavIcon d={PERSON} />
			</a>
			{open ? (
				<div className="fixed inset-0 z-20">
					<div className="absolute inset-0 bg-black/30" />
					<div className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto border-l border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
						<div className="flex gap-1.5 border-b border-zinc-200 pb-3 dark:border-zinc-800">
							<a
								href={href({ screen: "account" })}
								className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
									section === "account"
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "text-zinc-600 dark:text-zinc-400"
								}`}
							>
								Account
							</a>
							<a
								href={href({ screen: "leaderboard" })}
								className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
									section === "leaderboard"
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "text-zinc-600 dark:text-zinc-400"
								}`}
							>
								Leaderboards
							</a>
						</div>
						<div className="pt-4">
							{section === "account" ? (
								signedIn ? (
									<AccountSignedIn />
								) : (
									<AccountSignedOut />
								)
							) : (
								<LeaderboardContent compact />
							)}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
