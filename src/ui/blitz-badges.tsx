import { CATEGORY_LABEL } from "../engine/share";
import type { BlitzMode, BlitzRun, Orientation } from "../engine/types";

const ORIENTATION_LABEL: Record<Orientation, string> = {
	default: "Default",
	inverted: "Inverted",
};

const MODE_LABEL: Record<BlitzMode, string> = {
	sprint: "Sprint",
	marathon: "Marathon",
	survival: "Survival",
};

// Shape, sizing, and light/dark colors match the Daily segment's category
// badge; spacing between badges comes from the caller's own flex gap rather
// than a margin utility, since these badges sit in a flex row.
function Badge({ children }: { children: string }) {
	return (
		<span className="inline-block rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
			{children}
		</span>
	);
}

export function SetupBadges({
	category,
	orientation,
	mode,
}: Pick<BlitzRun, "category" | "orientation" | "mode">) {
	return (
		<>
			<Badge>{CATEGORY_LABEL[category]}</Badge>
			<Badge>{ORIENTATION_LABEL[orientation]}</Badge>
			<Badge>{MODE_LABEL[mode]}</Badge>
		</>
	);
}

export function localDate(endedAt: string): string {
	const date = new Date(endedAt);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function localTime(endedAt: string): string {
	const date = new Date(endedAt);
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}
