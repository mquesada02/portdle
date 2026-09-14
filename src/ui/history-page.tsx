import { Link, useRouteContext } from "@tanstack/react-router";
import { applications, protocols, schedules } from "../catalogs/production";
import type { HistoryRow } from "../engine/history";
import { groupBlitzRunsByDate, historyRows } from "../engine/history";
import { CATEGORY_LABEL } from "../engine/share";
import type { BlitzRun, DailyPersist } from "../engine/types";
import type { Persist } from "../persist/storage";
import { localDate, localTime, SetupBadges } from "./blitz-badges";
import { RoundLog } from "./round-log";

const HEADING_ID = "history-heading";

const ENDED_LABEL: Record<BlitzRun["ended"], string> = {
	lives: "Out of lives",
	timeout: "Time's up",
};

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

function DailySegmentList({
	persist,
	utcToday,
}: {
	persist: Persist;
	utcToday: string;
}) {
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
		<ul
			className="mt-4 space-y-6 [view-transition-name:switcher-content]"
			aria-labelledby={HEADING_ID}
		>
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
	);
}

function BlitzRunRow({ run }: { run: BlitzRun }) {
	return (
		<li>
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				<SetupBadges
					category={run.category}
					orientation={run.orientation}
					mode={run.mode}
				/>
				<span>{ENDED_LABEL[run.ended]}</span>
				<span className="font-mono">{localTime(run.endedAt)}</span>
				<span>Score {run.score}</span>
			</div>
			<details className="mt-1">
				<summary className="cursor-pointer text-sm">{`Rounds (${run.rounds.length})`}</summary>
				<RoundLog rounds={run.rounds} />
			</details>
		</li>
	);
}

function BlitzSegmentList({ runs }: { runs: BlitzRun[] }) {
	const groups = groupBlitzRunsByDate(runs, localDate);
	return (
		<ul
			className="mt-4 space-y-6 [view-transition-name:switcher-content]"
			aria-labelledby={HEADING_ID}
		>
			{groups.length === 0 ? (
				<li>No runs yet.</li>
			) : (
				groups.map((group) => {
					const dateHeadingId = `history-blitz-date-${group.date}`;
					return (
						<li key={group.date}>
							<h2 id={dateHeadingId} className="text-sm font-semibold">
								{group.date}
							</h2>
							<ul className="mt-2 space-y-2" aria-labelledby={dateHeadingId}>
								{group.runs.map((run) => (
									// A run has no id of its own; its ISO 8601 end instant
									// orders and identifies it, so it doubles as the list key.
									<BlitzRunRow key={run.endedAt} run={run} />
								))}
							</ul>
						</li>
					);
				})
			)}
		</ul>
	);
}

const HISTORY_SEGMENTS: Array<{
	value: "daily" | "blitz";
	to: "/history" | "/history/blitz";
	label: string;
}> = [
	{ value: "daily", to: "/history", label: "Daily" },
	{ value: "blitz", to: "/history/blitz", label: "Blitz" },
];

function HistorySwitcher({ segment }: { segment: "daily" | "blitz" }) {
	return (
		<nav
			aria-label="History switcher"
			className="flex border-b border-zinc-200 dark:border-zinc-800"
		>
			{HISTORY_SEGMENTS.map((item) => (
				<Link
					key={item.value}
					to={item.to}
					activeOptions={{ exact: true }}
					activeProps={{}}
					aria-current={segment === item.value ? "page" : undefined}
					className={`-mb-px flex-1 border-b-2 py-2.5 text-center text-sm font-medium transition-colors ${
						segment === item.value
							? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
							: "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
					}`}
				>
					{item.label}
				</Link>
			))}
		</nav>
	);
}

export function HistoryPage({ segment }: { segment: "daily" | "blitz" }) {
	const { persist, utcToday } = useRouteContext({ from: "__root__" });
	return (
		<main>
			<h1 id={HEADING_ID}>History</h1>
			<HistorySwitcher segment={segment} />
			{segment === "daily" ? (
				<DailySegmentList persist={persist} utcToday={utcToday} />
			) : (
				<BlitzSegmentList runs={persist.readBlitzRuns()} />
			)}
		</main>
	);
}
