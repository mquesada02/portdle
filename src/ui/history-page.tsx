import { useRouteContext } from "@tanstack/react-router";
import { applications, protocols, schedules } from "../catalogs/production";
import { historyRows } from "../engine/history";
import { CATEGORY_LABEL } from "../engine/share";
import type { DailyPersist } from "../engine/types";

const HEADING_ID = "history-heading";

function isFinished(status: DailyPersist["status"] | undefined): boolean {
	return status === "won" || status === "lost";
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
	return (
		<main>
			<h1 id={HEADING_ID}>History</h1>
			<ul className="mt-4 space-y-2" aria-labelledby={HEADING_ID}>
				{rows.map((row) => (
					<li key={`${row.date}:${row.category}`}>
						{row.date} {CATEGORY_LABEL[row.category]} {row.name}{" "}
						<span className="font-mono">{row.port}</span>
					</li>
				))}
			</ul>
		</main>
	);
}
