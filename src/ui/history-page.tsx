import { Link, useRouteContext } from "@tanstack/react-router";
import { useMemo } from "react";
import { dailyResult } from "../engine/archive";
import {
	groupBlitzRunsByDate,
	historyRows,
	type SavedDaily,
} from "../engine/history";
import type { BlitzRun } from "../engine/types";
import { DAILY_CATEGORIES } from "../engine/types";
import type { Persist } from "../persist/storage";
import { useAfterFirstRender } from "./after-first-render";
import { localDate, localTime, SetupBadges } from "./blitz-badges";
import { DailyGroupList, DailyRowLink } from "./daily-row";
import { RoundLog } from "./round-log";
import { useScheduleReads } from "./schedule-rows";

const HEADING_ID = "history-heading";

const ENDED_LABEL: Record<BlitzRun["ended"], string> = {
	lives: "Out of lives",
	timeout: "Time's up",
};

function savedDailyRows(persist: Persist): SavedDaily[] {
	return DAILY_CATEGORIES.flatMap((category) =>
		persist.listDailyDates(category).flatMap((date) => {
			const record = persist.readDaily(category, date);
			return record ? [{ date, category, ...dailyResult(record) }] : [];
		}),
	);
}

// The saved Dailies before they are read, after the first render.
const NO_SAVED: SavedDaily[] = [];

function DailySegmentList({ persist }: { persist: Persist }) {
	const { data } = useScheduleReads();
	// The player's finished Dailies are listed at once and read once. Their
	// names join in once every read has succeeded; until then the rows carry
	// none.
	const [saved] = useAfterFirstRender(() => savedDailyRows(persist), NO_SAVED);
	const [catalog, , schedule] = data.status === "ready" ? data.value : [];
	const rows = useMemo(
		() =>
			historyRows({
				saved,
				schedule: schedule ?? [],
				protocols: catalog?.protocols ?? [],
				applications: catalog?.applications ?? [],
			}),
		[saved, catalog, schedule],
	);
	return (
		<>
			<p className="mt-4 text-sm">
				<Link to="/archive" className="underline">
					Archive
				</Link>
			</p>
			<DailyGroupList
				rows={rows}
				idPrefix="history-date"
				labelledBy={HEADING_ID}
				renderRow={(row) => (
					<DailyRowLink
						category={row.category}
						date={row.date}
						result={row}
						answer={
							row.name !== undefined && row.port !== undefined
								? { name: row.name, port: row.port }
								: undefined
						}
					/>
				)}
			/>
		</>
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

// `runs` is null until the Blitz runs are read, after the first render; the
// list then shows neither runs nor the empty text.
function BlitzSegmentList({ runs }: { runs: BlitzRun[] | null }) {
	const groups = groupBlitzRunsByDate(runs ?? [], localDate);
	return (
		<ul
			className="mt-4 space-y-6 [view-transition-name:switcher-content]"
			aria-labelledby={HEADING_ID}
		>
			{runs === null ? null : groups.length === 0 ? (
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

export const HISTORY_SEGMENTS: Array<{
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

function BlitzSegment({ persist }: { persist: Persist }) {
	const [runs] = useAfterFirstRender<BlitzRun[] | null>(
		() => persist.readBlitzRuns(),
		null,
	);
	return <BlitzSegmentList runs={runs} />;
}

export function HistoryPage({ segment }: { segment: "daily" | "blitz" }) {
	const { persist } = useRouteContext({ from: "__root__" });
	return (
		<main>
			<h1 id={HEADING_ID}>History</h1>
			<HistorySwitcher segment={segment} />
			{segment === "daily" ? (
				<DailySegmentList persist={persist} />
			) : (
				<BlitzSegment persist={persist} />
			)}
		</main>
	);
}
