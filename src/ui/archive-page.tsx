import { Link, useRouteContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { archiveRows, boardEntryId } from "../engine/archive";
import { entryById } from "../engine/catalog";
import { isDailyCategory } from "../engine/types";
import { isValidUtcDate } from "../engine/utc";
import { DailyBoard, DailyLoading, MissingPuzzle } from "./daily-page";
import { DailyRowLink, groupByDate } from "./daily-row";
import { useScheduleReads } from "./schedule-rows";
import { LoadStatus } from "./server-data";

const HEADING_ID = "archive-heading";

function BackLink() {
	return (
		<p className="mt-3 text-sm">
			<Link to="/archive" className="underline">
				Back to the Archive
			</Link>
		</p>
	);
}

export function ArchivePage() {
	const { persist } = useRouteContext({ from: "__root__" });
	const { data, retry } = useScheduleReads();
	if (data.status !== "ready") {
		return (
			<main>
				<h1 id={HEADING_ID}>Archive</h1>
				<LoadStatus state={data.status} onRetry={retry} />
			</main>
		);
	}
	const [, { today }, schedule] = data.value;
	const groups = groupByDate(archiveRows(schedule, today));
	return (
		<main>
			<h1 id={HEADING_ID}>Archive</h1>
			<ul
				className="mt-4 space-y-6 [view-transition-name:switcher-content]"
				aria-labelledby={HEADING_ID}
			>
				{groups.map((group) => {
					const dateHeadingId = `archive-date-${group.date}`;
					return (
						<li key={group.date}>
							<h2 id={dateHeadingId} className="text-sm font-semibold">
								{group.date}
							</h2>
							<ul className="mt-2 space-y-2" aria-labelledby={dateHeadingId}>
								{group.rows.map(({ category, date }) => {
									const record = persist.readDaily(category, date);
									return (
										<li key={category}>
											<DailyRowLink
												category={category}
												date={date}
												result={
													record && {
														status: record.status,
														tries: record.guesses.length,
													}
												}
											/>
										</li>
									);
								})}
							</ul>
						</li>
					);
				})}
			</ul>
		</main>
	);
}

function NoDaily({ top }: { top: ReactNode }) {
	return (
		<main className="mx-auto w-full max-w-md px-4 pb-6 sm:max-w-lg">
			{top}
			<p className="mt-8 text-center text-sm [view-transition-name:switcher-content]">
				No Daily on this day.
			</p>
		</main>
	);
}

export function ArchiveBoardPage({
	category,
	date,
}: {
	category: string;
	date: string;
}) {
	const { data, retry } = useScheduleReads();
	const top = <BackLink />;
	if (data.status !== "ready") {
		return <DailyLoading top={top} state={data.status} onRetry={retry} />;
	}
	const [{ protocols, applications }, current, schedule] = data.value;
	if (!isDailyCategory(category) || !isValidUtcDate(date)) {
		return <NoDaily top={top} />;
	}
	const entryId = boardEntryId(schedule, category, date, current.today);
	if (entryId === null) {
		return <NoDaily top={top} />;
	}
	const puzzle = entryById(protocols, applications, entryId);
	if (!puzzle) {
		return <MissingPuzzle top={top} />;
	}
	return (
		<DailyBoard
			key={`${category}|${date}`}
			top={top}
			category={category}
			puzzle={puzzle}
			protocols={protocols}
			applications={applications}
			date={date}
			serverToday={current.today}
		/>
	);
}
