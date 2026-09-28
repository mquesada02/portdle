// PROTOTYPE — throwaway. Fake data only, no backend calls. See issue #126.
import type { BlitzMode, DailyCategory, Orientation } from "../../engine/types";

export type FakeUser = {
	displayName: string;
	provider: "github" | "google";
};

export const SEEDED_NAME = "shadowbyte";

export const FAKE_USER: FakeUser = {
	displayName: "shadowbyte",
	provider: "github",
};

export type LeaderboardWindow = "allTime" | "weekly" | "daily";

export const WINDOWS: Array<{ value: LeaderboardWindow; label: string }> = [
	{ value: "allTime", label: "All-time" },
	{ value: "weekly", label: "Weekly" },
	{ value: "daily", label: "Daily" },
];

export const BOARD_CATEGORIES: Array<{ value: DailyCategory; label: string }> = [
	{ value: "mixed", label: "Mixed" },
	{ value: "protocols", label: "Protocols" },
	{ value: "applications", label: "Applications" },
];

export const BOARD_ORIENTATIONS: Array<{ value: Orientation; label: string }> = [
	{ value: "default", label: "Default" },
	{ value: "inverted", label: "Inverted" },
];

export const BOARD_MODES: Array<{ value: BlitzMode; label: string }> = [
	{ value: "sprint", label: "Sprint" },
	{ value: "marathon", label: "Marathon" },
	{ value: "survival", label: "Survival" },
];

export type LeaderboardRow = {
	rank: number;
	name: string;
	score: number;
	you?: boolean;
};

const FAKE_NAMES = [
	"packetwhisper",
	"nullrouteNina",
	"crontab_carl",
	"ipv6ghost",
	"subnetSage",
	"latencylena",
	"tcphandshake",
	"ohmy_dmz",
	"pfSenseParty",
	"grepgremlin",
	"regexronin",
	"daemon_dana",
	"loopback_lou",
	"firewallfinn",
];

export function fakeLeaderboard(): LeaderboardRow[] {
	const top = FAKE_NAMES.map((name, index) => ({
		rank: index + 1,
		name,
		score: 4200 - index * 137 - (index % 3) * 11,
	}));
	return [...top, { rank: 47, name: FAKE_USER.displayName, score: 1180, you: true }];
}

export const FAKE_LAST_RUN = {
	category: "mixed" as DailyCategory,
	orientation: "default" as Orientation,
	mode: "sprint" as BlitzMode,
	endedLabel: "Time's up",
	when: "Today 14:02",
	score: 1180,
};

export const FAKE_BESTS: Array<{
	category: DailyCategory;
	orientation: Orientation;
	mode: BlitzMode;
	score: number;
}> = [
	{ category: "mixed", orientation: "default", mode: "sprint", score: 1180 },
	{ category: "mixed", orientation: "default", mode: "marathon", score: 3920 },
	{ category: "protocols", orientation: "inverted", mode: "sprint", score: 860 },
];
