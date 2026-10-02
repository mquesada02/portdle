import { Link } from "@tanstack/react-router";
import { type DailyResult, resultLabel } from "../engine/archive";
import { puzzleNumber } from "../engine/puzzle-number";
import { CATEGORY_LABEL } from "../engine/share";
import type { DailyCategory } from "../engine/types";

export type DailyGroup<Row extends { date: string }> = {
	date: string;
	rows: Row[];
};

// Rows already sorted by date, grouped by date in the same order.
export function groupByDate<Row extends { date: string }>(
	rows: Row[],
): DailyGroup<Row>[] {
	const groups: DailyGroup<Row>[] = [];
	for (const row of rows) {
		const current = groups.at(-1);
		if (current && current.date === row.date) {
			current.rows.push(row);
		} else {
			groups.push({ date: row.date, rows: [row] });
		}
	}
	return groups;
}

// One Daily on the Archive or in History: a link to its board reading
// category badge, puzzle number, result, and the answer when it is known.
export function DailyRowLink({
	category,
	date,
	result,
	answer,
}: {
	category: DailyCategory;
	date: string;
	result: DailyResult | null;
	answer?: { name: string; port: number };
}) {
	return (
		<Link to="/archive/$category/$date" params={{ category, date }}>
			<span className="mr-2 inline-block rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
				{CATEGORY_LABEL[category]}
			</span>
			#{puzzleNumber(date)} · {resultLabel(result)}
			{answer && (
				<>
					{" "}
					· {answer.name} <span className="font-mono">{answer.port}</span>
				</>
			)}
		</Link>
	);
}
