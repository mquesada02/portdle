import type { Mark } from "./marks";
import { puzzleNumber } from "./puzzle-number";
import type { DailyCategory } from "./types";

export const CATEGORY_LABEL: Record<DailyCategory, string> = {
	mixed: "Mixed",
	protocols: "Protocols",
	applications: "Applications",
};

const SQUARE: Record<Mark, string> = {
	placed: "🟩",
	present: "🟨",
	absent: "⬜",
};

function rowLine(marks: Mark[]): string {
	return marks.map((mark) => SQUARE[mark]).join("");
}

export function formatShare(input: {
	category: DailyCategory;
	date: string;
	status: "won" | "lost";
	rows: Mark[][];
	late: boolean;
}): string {
	const tries = input.status === "lost" ? "X/6" : `${input.rows.length}/6`;
	const grid = input.rows.map(rowLine).join("\n");
	const lateMark = input.late ? " · late" : "";
	return `Portdle #${puzzleNumber(input.date)} · ${CATEGORY_LABEL[input.category]} · ${tries}${lateMark}\n\n${grid}`;
}
