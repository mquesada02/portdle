// PROTOTYPE — Variant B: leaderboards get their own 5th nav item, alongside
// Daily, Blitz, History, Codex. Account stays a small top-bar dropdown, same
// as variant A. See issue #126.
import { AccountMenuButton } from "./account-menu";
import { BlitzArenaPreview } from "./blitz-arena-preview";
import { BOLT, BOOK, CLOCK, GRID, TROPHY } from "./icons";
import { LeaderboardContent } from "./leaderboard-content";
import { NameConfirmScreen } from "./name-confirm";
import { href, type NavItem, PrototypeShell } from "./shell";

export function VariantB({ screen, signedIn }: { screen: string; signedIn: boolean }) {
	const leaderboard = screen === "leaderboard";
	const nav: NavItem[] = [
		{ key: "daily", label: "Daily", icon: GRID, href: href({ screen: undefined }), active: false },
		{
			key: "blitz",
			label: "Blitz",
			icon: BOLT,
			href: href({ screen: undefined }),
			active: !leaderboard,
		},
		{
			key: "leaderboards",
			label: "Leaderboards",
			icon: TROPHY,
			href: href({ screen: "leaderboard" }),
			active: leaderboard,
		},
		{ key: "history", label: "History", icon: CLOCK, href: href({ screen: undefined }), active: false },
		{ key: "codex", label: "Codex", icon: BOOK, href: href({ screen: undefined }), active: false },
	];

	return (
		<PrototypeShell
			navItems={nav}
			accountSlot={<AccountMenuButton open={screen === "account"} signedIn={signedIn} />}
		>
			{leaderboard ? <LeaderboardContent /> : <BlitzArenaPreview />}
			{screen === "name-confirm" ? <NameConfirmScreen /> : null}
		</PrototypeShell>
	);
}
