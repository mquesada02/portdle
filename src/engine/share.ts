import type { DailyCategory } from "./types";

const CATEGORY_LABEL: Record<DailyCategory, string> = {
	mixed: "Mixed",
	protocols: "Protocols",
	applications: "Applications",
};

export function formatShare(input: {
	category: DailyCategory;
	date: string;
	status: "won" | "lost";
	committed: number;
}): string {
	if (input.status === "lost") {
		return `Portdle · ${CATEGORY_LABEL[input.category]} · ${input.date} · X/6\n\n⬜⬜⬜⬜⬜⬜`;
	}
	const squares = `${"⬜".repeat(Math.max(0, input.committed - 1))}🟩`;
	return `Portdle · ${CATEGORY_LABEL[input.category]} · ${input.date} · ${input.committed}/6\n\n${squares}`;
}
