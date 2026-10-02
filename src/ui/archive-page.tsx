import { Link, useRouteContext } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";
import { archiveRows, boardEntryId, dailyResult } from "../engine/archive";
import { entryById } from "../engine/catalog";
import { isDailyCategory } from "../engine/types";
import { isValidUtcDate } from "../engine/utc";
import { DailyBoard, DailyLoading, MissingPuzzle } from "./daily-page";
import { DailyGroupList, DailyRowLink } from "./daily-row";
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
	const [, current, schedule] = data.status === "ready" ? data.value : [];
	// Every row's saved result is read once per load, not on every render.
	const rows = useMemo(
		() =>
			current && schedule
				? archiveRows(schedule, current.today).map((row) => {
						const record = persist.readDaily(row.category, row.date);
						return { ...row, result: record && dailyResult(record) };
					})
				: [],
		[persist, current, schedule],
	);
	return (
		<main>
			<h1 id={HEADING_ID}>Archive</h1>
			{data.status === "ready" ? (
				<DailyGroupList
					rows={rows}
					idPrefix="archive-date"
					labelledBy={HEADING_ID}
					renderRow={({ category, date, result }) => (
						<DailyRowLink category={category} date={date} result={result} />
					)}
				/>
			) : (
				<LoadStatus state={data.status} onRetry={retry} />
			)}
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
