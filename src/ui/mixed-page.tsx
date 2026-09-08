import { Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import applicationsJson from "../catalogs/applications.json";
import protocolsJson from "../catalogs/protocols.json";
import mixedScheduleJson from "../catalogs/schedules/mixed.json";
import { catalogFor } from "../engine/catalog";
import { getDaily } from "../engine/daily";
import {
	applyCommittedGuess,
	digitLength,
	evaluateDefaultGuess,
} from "../engine/guess";
import { formatShare } from "../engine/share";
import {
	applyDailyFinish,
	applyStreakGap,
	emptyStats,
	winPercent,
} from "../engine/stats";
import type {
	CatalogEntry,
	CategoryStats,
	DailyPersist,
	ScheduleFile,
	Transport,
} from "../engine/types";
import { yesterdayUtc } from "../engine/utc";
import { DigitSlots } from "./digit-slots";

const protocols = protocolsJson as CatalogEntry[];
const applications = applicationsJson as CatalogEntry[];
const mixedSchedule = mixedScheduleJson as ScheduleFile;

function transportLabel(transport: Transport): string {
	if (transport === "tcp") {
		return "TCP";
	}
	if (transport === "udp") {
		return "UDP";
	}
	return "TCP/UDP";
}

function padPort(port: number, length: number): string {
	return String(port).padStart(length, "0");
}

export function MixedPage() {
	const { persist, utcToday } = useRouteContext({ from: "/" });
	const answer = getDaily(
		"mixed",
		utcToday,
		mixedSchedule,
		protocols,
		applications,
	);
	const catalog = catalogFor("mixed", protocols, applications);
	const [board, setBoard] = useState<DailyPersist | null>(() =>
		persist.readDaily("mixed", utcToday),
	);
	const [digits, setDigits] = useState("");
	const [message, setMessage] = useState("");
	const [saveWarning, setSaveWarning] = useState(false);
	const [shareFallback, setShareFallback] = useState<string | null>(null);

	useEffect(() => {
		const lastSeen = persist.readLastSeenUtc();
		if (lastSeen === null) {
			const written = persist.writeLastSeenUtc(utcToday);
			if (!written.ok) {
				setSaveWarning(true);
			}
			return;
		}
		if (lastSeen < utcToday) {
			const gapped = applyStreakGap({
				stats: persist.readStats("mixed") ?? emptyStats(),
				utcToday,
				lastPlayed: persist.readLastPlayed("mixed"),
				yesterdayPersist: persist.readDaily("mixed", yesterdayUtc(utcToday)),
			});
			const statsWrite = persist.writeStats("mixed", gapped);
			const seenWrite = persist.writeLastSeenUtc(utcToday);
			if (!statsWrite.ok || !seenWrite.ok) {
				setSaveWarning(true);
			}
		}
	}, [persist, utcToday]);

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
	const stats: CategoryStats = persist.readStats("mixed") ?? emptyStats();

	function noteWrite(result: { ok: boolean }) {
		if (!result.ok) {
			setSaveWarning(true);
		}
	}

	function submitGuess() {
		if (frozen) {
			return;
		}
		const result = evaluateDefaultGuess({
			digits,
			answer: puzzle,
			previousPorts: (board?.guesses ?? []).map((guess) => guess.port),
			catalog,
		});
		const next = applyCommittedGuess(board, result);
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
				result.identified ? result.identified.name : "Not in this catalog.",
			);
		} else {
			setMessage("");
		}
		setBoard(next);
		noteWrite(persist.writeDaily("mixed", utcToday, next));
		if (next.status === "won" || next.status === "lost") {
			const gapped = applyStreakGap({
				stats: persist.readStats("mixed") ?? emptyStats(),
				utcToday,
				lastPlayed: persist.readLastPlayed("mixed"),
				yesterdayPersist: persist.readDaily("mixed", yesterdayUtc(utcToday)),
			});
			const finished = applyDailyFinish({
				stats: gapped,
				result: next.status,
				tries: next.guesses.length,
			});
			noteWrite(persist.writeStats("mixed", finished));
			noteWrite(persist.writeLastPlayed("mixed", utcToday));
		}
	}

	async function share() {
		if (board?.status !== "won" && board?.status !== "lost") {
			return;
		}
		const text = formatShare({
			category: "mixed",
			date: utcToday,
			status: board.status,
			committed: board.guesses.length,
		});
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				setShareFallback(null);
				return;
			}
		} catch {
			setShareFallback(text);
			return;
		}
		setShareFallback(text);
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
								{guess.identified
									? guess.identified.name
									: "Not in this catalog."}
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
			{frozen ? (
				<section className="mt-6">
					<p>{puzzle.port}</p>
					<p>{transportLabel(puzzle.transport)}</p>
					<p>{puzzle.description}</p>
					<dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
						<div>
							<dt>Played</dt>
							<dd>{stats.played}</dd>
						</div>
						<div>
							<dt>Win %</dt>
							<dd>{Math.round(winPercent(stats) * 100)}</dd>
						</div>
						<div>
							<dt>Current streak</dt>
							<dd>{stats.currentStreak}</dd>
						</div>
						<div>
							<dt>Best streak</dt>
							<dd>{stats.bestStreak}</dd>
						</div>
					</dl>
					<ol className="mt-2">
						{([1, 2, 3, 4, 5, 6] as const).map((tryNumber) => (
							<li key={tryNumber}>
								{tryNumber}: {stats.histogram[tryNumber - 1]}
							</li>
						))}
					</ol>
					<button type="button" className="mt-4" onClick={() => void share()}>
						Share
					</button>
					{shareFallback ? (
						<textarea
							readOnly
							value={shareFallback}
							className="mt-2 block w-full"
						/>
					) : null}
				</section>
			) : null}
		</main>
	);
}
