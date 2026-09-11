import { useEffect, useState } from "react";
import { digitLength } from "../engine/guess";
import { computeMarks } from "../engine/marks";
import { formatShare } from "../engine/share";
import { winPercent } from "../engine/stats";
import type {
	CatalogEntry,
	CategoryStats,
	DailyCategory,
	DailyPersist,
} from "../engine/types";

const TRIES = [1, 2, 3, 4, 5, 6] as const;

function transportLabel(transport: CatalogEntry["transport"]): string {
	if (transport === "tcp") {
		return "TCP";
	}
	if (transport === "udp") {
		return "UDP";
	}
	return "TCP/UDP";
}

function Badge({ children }: { children: string }) {
	return (
		<span className="inline-flex items-center rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
			{children}
		</span>
	);
}

function Histogram({
	stats,
	highlight,
}: {
	stats: CategoryStats;
	highlight: number | null;
}) {
	const max = Math.max(1, ...stats.histogram);
	return (
		<ol className="space-y-1">
			{TRIES.map((tryNumber) => {
				const count = stats.histogram[tryNumber - 1] ?? 0;
				return (
					<li key={tryNumber} className="flex items-center gap-2 text-xs">
						<span className="w-3 text-right text-zinc-500">{tryNumber}</span>
						<div className="flex-1">
							<div
								className={`h-4 rounded-sm px-1.5 text-right leading-4 text-white ${
									tryNumber === highlight
										? "bg-emerald-500"
										: "bg-zinc-400 dark:bg-zinc-600"
								}`}
								style={{ width: `${Math.max(8, (count / max) * 100)}%` }}
							>
								{count}
							</div>
						</div>
					</li>
				);
			})}
		</ol>
	);
}

export function DailyReveal({
	category,
	puzzle,
	board,
	stats,
	utcToday,
	finishedThisSession,
}: {
	category: DailyCategory;
	puzzle: CatalogEntry;
	board: DailyPersist;
	stats: CategoryStats;
	utcToday: string;
	finishedThisSession: boolean;
}) {
	const [shareFallback, setShareFallback] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const won = board.status === "won";
	const highlight = won ? board.guesses.length : null;

	// Smooth scroll to the reveal, but only when the Daily finished during
	// this page session — a reload of an already-finished Daily never
	// scrolls. Reduced motion skips the delay and the smooth behavior.
	useEffect(() => {
		if (!finishedThisSession) {
			return;
		}
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const timer = window.setTimeout(
			() =>
				window.scrollTo({
					top: document.documentElement.scrollHeight,
					behavior: reduced ? "auto" : "smooth",
				}),
			reduced ? 0 : 250,
		);
		return () => window.clearTimeout(timer);
	}, [finishedThisSession]);

	// "Copied!" reverts to "Share" after 1.5s.
	useEffect(() => {
		if (!copied) {
			return;
		}
		const timer = window.setTimeout(() => setCopied(false), 1500);
		return () => window.clearTimeout(timer);
	}, [copied]);

	async function share() {
		if (board.status !== "won" && board.status !== "lost") {
			return;
		}
		// Same padding convention the board's tiles use: pad the typed port and
		// the answer port to the answer's digit length before computing marks.
		const length = digitLength(puzzle.port);
		const answerDigits = String(puzzle.port).padStart(length, "0");
		const rows = board.guesses.map((guess) =>
			computeMarks(String(guess.port).padStart(length, "0"), answerDigits),
		);
		const text = formatShare({
			category,
			date: utcToday,
			status: board.status,
			rows,
		});
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				setShareFallback(null);
				setCopied(true);
				return;
			}
		} catch {
			setShareFallback(text);
			return;
		}
		setShareFallback(text);
	}

	return (
		<section className="mt-8 text-center">
			<div
				aria-hidden="true"
				className="animate-draw h-px w-full bg-zinc-300 dark:bg-zinc-700"
			/>
			<div className="animate-rise pt-6">
				<p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
					{won ? "Solved" : "The answer was"}
				</p>
				<p className="mt-2 font-mono text-5xl font-bold tabular-nums">
					{puzzle.port}
				</p>
				<p className="mt-2">
					<Badge>{transportLabel(puzzle.transport)}</Badge>
				</p>
				<p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
					{puzzle.description}
				</p>
				<dl className="mt-8 grid grid-cols-4 gap-2">
					<div>
						<dt className="text-[11px] uppercase tracking-wide text-zinc-500">
							Played
						</dt>
						<dd className="text-2xl font-bold tabular-nums">{stats.played}</dd>
					</div>
					<div>
						<dt className="text-[11px] uppercase tracking-wide text-zinc-500">
							Win %
						</dt>
						<dd className="text-2xl font-bold tabular-nums">
							{Math.round(winPercent(stats) * 100)}
						</dd>
					</div>
					<div>
						<dt className="text-[11px] uppercase tracking-wide text-zinc-500">
							Streak
						</dt>
						<dd className="text-2xl font-bold tabular-nums">
							{stats.currentStreak}
						</dd>
					</div>
					<div>
						<dt className="text-[11px] uppercase tracking-wide text-zinc-500">
							Best streak
						</dt>
						<dd className="text-2xl font-bold tabular-nums">
							{stats.bestStreak}
						</dd>
					</div>
				</dl>
				<div className="mt-6 text-left">
					<p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
						Guess distribution
					</p>
					<Histogram stats={stats} highlight={highlight} />
				</div>
				<button
					type="button"
					onClick={() => void share()}
					className="mt-6 w-full rounded-lg bg-emerald-500 py-3 text-base font-semibold text-white"
				>
					{copied ? "Copied!" : "Share"}
				</button>
				{shareFallback ? (
					<textarea
						readOnly
						value={shareFallback}
						className="mt-2 block w-full"
					/>
				) : null}
			</div>
		</section>
	);
}
