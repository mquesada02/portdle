// PROTOTYPE — throwaway. Small top-bar dropdown used by variants A and B
// (account only; leaderboards live elsewhere for both). See issue #126.
import { ICON_BUTTON, NavIcon, PERSON } from "./icons";
import { AccountSignedIn, AccountSignedOut } from "./account-content";
import { href } from "./shell";

export function AccountMenuButton({
	open,
	signedIn,
}: {
	open: boolean;
	signedIn: boolean;
}) {
	return (
		<div className="relative">
			<a
				href={open ? href({ screen: undefined }) : href({ screen: "account" })}
				aria-label="Account"
				className={ICON_BUTTON}
			>
				<NavIcon d={PERSON} />
			</a>
			{open ? (
				<div className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
					{signedIn ? <AccountSignedIn /> : <AccountSignedOut />}
				</div>
			) : null}
		</div>
	);
}
