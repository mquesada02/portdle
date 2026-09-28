// PROTOTYPE — Variant A: leaderboards live inside the Blitz arena as a
// second tab ("Play" / "Leaderboards"). Account stays a small top-bar
// dropdown, same as variant B. See issue #126.
import { AccountMenuButton } from "./account-menu";
import { BlitzArenaPreview } from "./blitz-arena-preview";
import { BOLT, BOOK, CLOCK, GRID } from "./icons";
import { LeaderboardContent } from "./leaderboard-content";
import { NameConfirmScreen } from "./name-confirm";
import { href, type NavItem, PrototypeShell } from "./shell";

const NAV: NavItem[] = [
	{ key: "daily", label: "Daily", icon: GRID, href: href({ screen: undefined }), active: false },
	{ key: "blitz", label: "Blitz", icon: BOLT, href: href({ screen: undefined }), active: true },
	{ key: "history", label: "History", icon: CLOCK, href: href({ screen: undefined }), active: false },
	{ key: "codex", label: "Codex", icon: BOOK, href: href({ screen: undefined }), active: false },
];

function BlitzTabs({ leaderboard }: { leaderboard: boolean }) {
	return (
		<div className="mb-4 flex gap-1.5 border-b border-zinc-200 pb-3 dark:border-zinc-800">
			<a
				href={href({ screen: undefined })}
				className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
					!leaderboard
						? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
						: "text-zinc-600 dark:text-zinc-400"
				}`}
			>
				Play
			</a>
			<a
				href={href({ screen: "leaderboard" })}
				className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
					leaderboard
						? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
						: "text-zinc-600 dark:text-zinc-400"
				}`}
			>
				Leaderboards
			</a>
		</div>
	);
}

export function VariantA({ screen, signedIn }: { screen: string; signedIn: boolean }) {
	const leaderboard = screen === "leaderboard";
	return (
		<PrototypeShell
			navItems={NAV}
			accountSlot={<AccountMenuButton open={screen === "account"} signedIn={signedIn} />}
		>
			<h1 className="text-2xl font-bold tracking-tight">Blitz</h1>
			<div className="mt-4">
				<BlitzTabs leaderboard={leaderboard} />
				{leaderboard ? <LeaderboardContent compact /> : <BlitzArenaPreview heading={false} />}
			</div>
			{screen === "name-confirm" ? <NameConfirmScreen /> : null}
		</PrototypeShell>
	);
}
