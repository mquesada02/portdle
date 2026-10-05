import { useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { DailyCategory, DailyPersist } from "../engine/types";
import type { DailyGlobalStats } from "../remote/remote";

type Result =
	| { status: "loading" }
	| { status: "error" }
	| { status: "ready"; stats: DailyGlobalStats };

const TRIES = [1, 2, 3, 4, 5, 6] as const;

function percent(count: number, players: number): number {
	return players === 0 ? 0 : Math.round((count / players) * 100);
}

function Bar({
	label,
	count,
	players,
	own,
}: {
	label: string;
	count: number;
	players: number;
	own: boolean;
}) {
	const value = percent(count, players);
	return (
		<li
			aria-current={own ? "true" : undefined}
			className="flex items-center gap-2 text-xs"
		>
			<span className="w-8 text-right text-zinc-500">{label}</span>
			<div className="flex-1">
				<div
					className={`h-4 rounded-sm px-1.5 text-right leading-4 text-white ${
						own ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
					}`}
					style={{ width: `${Math.max(8, value)}%` }}
				>
					{value}%
				</div>
			</div>
		</li>
	);
}

function Totals({
	stats,
	board,
}: {
	stats: DailyGlobalStats;
	board: DailyPersist;
}) {
	const { players, wins, losses, byTries } = stats;
	const ownTries = board.status === "won" ? board.guesses.length : null;
	return (
		<>
			<dl className="mt-4 grid grid-cols-2 gap-2">
				<div>
					<dt className="text-[11px] uppercase tracking-wide text-zinc-500">
						Players
					</dt>
					<dd className="text-2xl font-bold tabular-nums">{players}</dd>
				</div>
				<div>
					<dt className="text-[11px] uppercase tracking-wide text-zinc-500">
						Solve rate
					</dt>
					<dd className="text-2xl font-bold tabular-nums">
						{players === 0 ? "-" : `${percent(wins, players)}%`}
					</dd>
				</div>
			</dl>
			<p className="mt-6 mb-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
				Global distribution
			</p>
			<ol className="space-y-1">
				{TRIES.map((tries) => (
					<Bar
						key={tries}
						label={String(tries)}
						count={byTries[tries - 1] ?? 0}
						players={players}
						own={ownTries === tries}
					/>
				))}
				<Bar
					label="Lost"
					count={losses}
					players={players}
					own={board.status === "lost"}
				/>
			</ol>
		</>
	);
}

// How the signed-in players who finished one Daily on-day did. Mount it only
// for a finished record. A signed-in player pushes pending changes first, so
// the just-finished result is counted.
export function GlobalStats({
	category,
	date,
	board,
}: {
	category: DailyCategory;
	date: string;
	board: DailyPersist;
}) {
	const { backend } = useRouteContext({ from: "__root__" });
	const remote = backend?.remote;
	const sync = backend?.sync;
	const [result, setResult] = useState<Result>({ status: "loading" });

	useEffect(() => {
		if (!remote || !sync) {
			return;
		}
		let current = true;
		// Aborts the request when the screen goes away or the Daily changes.
		const controller = new AbortController();
		setResult({ status: "loading" });
		sync
			.refresh()
			.then(() => remote.readDailyStats(category, date, controller.signal))
			.then(
				(stats: DailyGlobalStats) => {
					if (current) {
						setResult({ status: "ready", stats });
					}
				},
				() => {
					if (current) {
						setResult({ status: "error" });
					}
				},
			);
		return () => {
			current = false;
			controller.abort();
		};
	}, [remote, sync, category, date]);

	if (!remote) {
		return null;
	}
	return (
		<section className="mt-8 text-center">
			<h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
				Global stats
			</h2>
			{board.late === true ? (
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
					Late play, not counted
				</p>
			) : null}
			<div role="status">
				{result.status === "loading" ? (
					<p className="mt-4 text-sm">Loading global stats…</p>
				) : null}
			</div>
			{result.status === "error" ? (
				<p role="alert" className="mt-4 text-sm">
					Could not load the global stats.
				</p>
			) : null}
			{result.status === "ready" ? (
				<Totals stats={result.stats} board={board} />
			) : null}
		</section>
	);
}
