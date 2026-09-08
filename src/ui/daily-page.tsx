import { Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import applicationsJson from "../catalogs/applications.json";
import protocolsJson from "../catalogs/protocols.json";
import applicationsScheduleJson from "../catalogs/schedules/applications.json";
import mixedScheduleJson from "../catalogs/schedules/mixed.json";
import protocolsScheduleJson from "../catalogs/schedules/protocols.json";
import { catalogFor } from "../engine/catalog";
import { getDaily } from "../engine/daily";
import {
	applyCommittedGuess,
	digitLength,
	evaluateDefaultGuess,
} from "../engine/guess";
import { applyDailyFinish, emptyStats } from "../engine/stats";
import type {
	CatalogEntry,
	CategoryStats,
	DailyCategory,
	DailyPersist,
	ScheduleFile,
} from "../engine/types";
import { DailyReveal } from "./daily-reveal";
import { DigitSlots } from "./digit-slots";
import { categoryStreakGap } from "./sync-utc";

const protocols = protocolsJson as CatalogEntry[];
const applications = applicationsJson as CatalogEntry[];
const schedules: Record<DailyCategory, ScheduleFile> = {
	mixed: mixedScheduleJson as ScheduleFile,
	protocols: protocolsScheduleJson as ScheduleFile,
	applications: applicationsScheduleJson as ScheduleFile,
};
const NOT_IN_THIS_CATALOG = "Not in this catalog.";

function padPort(port: number, length: number): string {
	return String(port).padStart(length, "0");
}

export function DailyPage({ category }: { category: DailyCategory }) {
	const { persist, utcToday } = useRouteContext({ from: "__root__" });
	const answer = getDaily(
		category,
		utcToday,
		schedules[category],
		protocols,
		applications,
	);
	const catalog = catalogFor(category, protocols, applications);
	const [board, setBoard] = useState<DailyPersist | null>(() =>
		persist.readDaily(category, utcToday),
	);
	const [digits, setDigits] = useState("");
	const [message, setMessage] = useState("");
	const [saveWarning, setSaveWarning] = useState(false);

	if (!answer) {
		return (
			<main>
				<h1>Puzzle unavailable</h1>
				<p>
					<Link to="/help">Help</Link>
				</p>
			</main>
		);
	}

	const puzzle = answer;
	const length = digitLength(puzzle.port);
	const frozen = board?.status === "won" || board?.status === "lost";
	const stats: CategoryStats = persist.readStats(category) ?? emptyStats();

	function noteWrite(result: { ok: boolean }) {
		if (!result.ok) {
			setSaveWarning(true);
		}
	}

	function submitGuess() {
		const stored = persist.readDaily(category, utcToday);
		if (stored?.status === "won" || stored?.status === "lost") {
			setBoard(stored);
			return;
		}
		const current: DailyPersist | null = stored ?? board;
		if (current?.status === "won" || current?.status === "lost") {
			setBoard(current);
			return;
		}
		const previousPorts = current?.guesses.map((guess) => guess.port) ?? [];
		const result = evaluateDefaultGuess({
			digits,
			answer: puzzle,
			previousPorts,
			catalog,
		});
		const next = applyCommittedGuess(current, result);
		if (next.status === "invalid") {
			setMessage("Not a valid port.");
			return;
		}
		if (next.status === "duplicate") {
			setMessage("Already guessed.");
			return;
		}
		setDigits("");
		if (result.status === "miss") {
			setMessage(
				result.identified ? result.identified.name : NOT_IN_THIS_CATALOG,
			);
		} else {
			setMessage("");
		}
		setBoard(next);
		noteWrite(persist.writeDaily(category, utcToday, next));
		if (next.status === "won" || next.status === "lost") {
			if (persist.readLastPlayed(category) !== utcToday) {
				const gapped = categoryStreakGap(persist, category, utcToday);
				const finished = applyDailyFinish({
					stats: gapped,
					result: next.status,
					tries: next.guesses.length,
				});
				noteWrite(persist.writeStats(category, finished));
				noteWrite(persist.writeLastPlayed(category, utcToday));
			}
			noteWrite(persist.writeLastSeenUtc(utcToday));
		}
	}

	return (
		<main>
			<h1 className="text-2xl">{puzzle.name}</h1>
			{saveWarning ? <p role="status">Progress may not save.</p> : null}
			<ol className="mt-4 space-y-2 font-mono">
				{(board?.guesses ?? []).map((guess) => (
					<li key={`${guess.port}-${guess.result}`}>
						<span>{padPort(guess.port, length)}</span>
						{guess.result === "miss" ? (
							<span className="ml-2 font-sans">
								{guess.identified ? guess.identified.name : NOT_IN_THIS_CATALOG}
							</span>
						) : null}
					</li>
				))}
			</ol>
			{frozen ? null : (
				<div className="mt-4">
					<DigitSlots
						length={length}
						value={digits}
						disabled={false}
						onChange={setDigits}
						onSubmit={submitGuess}
					/>
					<button type="button" className="mt-2" onClick={submitGuess}>
						Submit
					</button>
				</div>
			)}
			<p aria-live="polite" className="mt-2">
				{message}
			</p>
			{frozen && board ? (
				<DailyReveal
					category={category}
					puzzle={puzzle}
					board={board}
					stats={stats}
					utcToday={utcToday}
				/>
			) : null}
		</main>
	);
}
