import { useRouteContext } from "@tanstack/react-router";
import { applications, protocols, schedules } from "../catalogs/production";
import type { HistoryRow } from "../engine/history";
import { historyRows } from "../engine/history";
import { CATEGORY_LABEL } from "../engine/share";
import type { DailyPersist } from "../engine/types";

const HEADING_ID = "history-heading";

function isFinished(status: DailyPersist["status"] | undefined): boolean {
	return status === "won" || status === "lost";
}

type HistoryGroup = { date: string; rows: HistoryRow[] };

function groupByDate(rows: HistoryRow[]): HistoryGroup[] {
	const groups: HistoryGroup[] = [];
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

export function HistoryPage() {
	const { persist, utcToday } = useRouteContext({ from: "__root__" });
	const rows = historyRows({
		utcToday,
		schedules,
		protocols,
		applications,
		finishedToday: {
			mixed: isFinished(persist.readDaily("mixed", utcToday)?.status),
			protocols: isFinished(persist.readDaily("protocols", utcToday)?.status),
			applications: isFinished(
				persist.readDaily("applications", utcToday)?.status,
			),
		},
	});
	const groups = groupByDate(rows);
	return (
		<main>
			<h1 id={HEADING_ID}>History</h1>
			<ul className="mt-4 space-y-6" aria-labelledby={HEADING_ID}>
				{groups.map((group) => {
					const dateHeadingId = `history-date-${group.date}`;
					return (
						<li key={group.date}>
							<h2 id={dateHeadingId} className="text-sm font-semibold">
								{group.date}
							</h2>
							<ul className="mt-2 space-y-2" aria-labelledby={dateHeadingId}>
								{group.rows.map((row) => (
									<li key={`${row.date}:${row.category}`}>
										<span className="mr-2 inline-block rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
											{CATEGORY_LABEL[row.category]}
										</span>{" "}
										{row.name} <span className="font-mono">{row.port}</span>
									</li>
								))}
							</ul>
						</li>
					);
				})}
			</ul>
		</main>
	);
}
