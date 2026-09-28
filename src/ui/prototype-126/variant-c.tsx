// PROTOTYPE — Variant C: nav stays exactly four items; a top-bar avatar
// opens a slide-over sheet hosting BOTH the account surface and
// leaderboards as two sections. See issue #126.
import { AccountSheetButton } from "./account-sheet";
import { BlitzArenaPreview } from "./blitz-arena-preview";
import { BOLT, BOOK, CLOCK, GRID } from "./icons";
import { NameConfirmScreen } from "./name-confirm";
import { href, type NavItem, PrototypeShell } from "./shell";

const NAV: NavItem[] = [
	{ key: "daily", label: "Daily", icon: GRID, href: href({ screen: undefined }), active: false },
	{ key: "blitz", label: "Blitz", icon: BOLT, href: href({ screen: undefined }), active: true },
	{ key: "history", label: "History", icon: CLOCK, href: href({ screen: undefined }), active: false },
	{ key: "codex", label: "Codex", icon: BOOK, href: href({ screen: undefined }), active: false },
];

export function VariantC({ screen, signedIn }: { screen: string; signedIn: boolean }) {
	const sheetOpen = screen === "account" || screen === "leaderboard";
	const section = screen === "leaderboard" ? "leaderboard" : "account";
	return (
		<PrototypeShell
			navItems={NAV}
			accountSlot={
				<AccountSheetButton open={sheetOpen} section={section} signedIn={signedIn} />
			}
		>
			<BlitzArenaPreview />
			{screen === "name-confirm" ? <NameConfirmScreen /> : null}
		</PrototypeShell>
	);
}
