// PROTOTYPE — throwaway. Shared board picker + top-100 list, reused inside
// each variant's own placement (Blitz tab for A, own page for B, account
// sheet for C). See issue #126.
import { useState } from "react";
import type { BlitzMode, DailyCategory, Orientation } from "../../engine/types";
import {
	BOARD_CATEGORIES,
	BOARD_MODES,
	BOARD_ORIENTATIONS,
	fakeLeaderboard,
	type LeaderboardWindow,
	WINDOWS,
} from "./fake-data";

function SegButton<T extends string>({
	value,
	current,
	label,
	onChange,
}: {
	value: T;
	current: T;
	label: string;
	onChange: (value: T) => void;
}) {
	const checked = value === current;
	return (
		<button
			type="button"
			onClick={() => onChange(value)}
			className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
				checked
					? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
					: "border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
			}`}
		>
			{label}
		</button>
	);
}

export function LeaderboardContent({ compact = false }: { compact?: boolean }) {
	const [windowKey, setWindowKey] = useState<LeaderboardWindow>("allTime");
	const [category, setCategory] = useState<DailyCategory>("mixed");
	const [orientation, setOrientation] = useState<Orientation>("default");
	const [mode, setMode] = useState<BlitzMode>("sprint");
	const rows = fakeLeaderboard();
	const top = rows.filter((row) => !row.you);
	const you = rows.find((row) => row.you);

	return (
		<div>
			{!compact ? <h1 className="text-2xl font-bold tracking-tight">Leaderboards</h1> : null}
			<div className="mt-3 flex flex-wrap gap-1.5">
				{WINDOWS.map((item) => (
					<SegButton
						key={item.value}
						value={item.value}
						current={windowKey}
						label={item.label}
						onChange={setWindowKey}
					/>
				))}
			</div>
			<div className="mt-3 flex flex-wrap gap-1.5">
				{BOARD_CATEGORIES.map((item) => (
					<SegButton
						key={item.value}
						value={item.value}
						current={category}
						label={item.label}
						onChange={setCategory}
					/>
				))}
			</div>
			<div className="mt-2 flex flex-wrap gap-1.5">
				{BOARD_ORIENTATIONS.map((item) => (
					<SegButton
						key={item.value}
						value={item.value}
						current={orientation}
						label={item.label}
						onChange={setOrientation}
					/>
				))}
				{BOARD_MODES.map((item) => (
					<SegButton
						key={item.value}
						value={item.value}
						current={mode}
						label={item.label}
						onChange={setMode}
					/>
				))}
			</div>
			<div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
				<div className="max-h-72 overflow-y-auto">
					<table className="w-full text-sm">
						<tbody>
							{top.map((row) => (
								<tr key={row.rank} className="border-t border-zinc-200 first:border-t-0 dark:border-zinc-800">
									<td className="py-2 pl-3 pr-1 tabular-nums text-zinc-500">{row.rank}</td>
									<td className="py-2">{row.name}</td>
									<td className="py-2 pr-3 text-right font-mono font-semibold tabular-nums">
										{row.score}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{you ? (
					<div className="flex items-center justify-between border-t border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-800">
						<span className="tabular-nums text-zinc-600 dark:text-zinc-300">
							{you.rank} · {you.name}{" "}
							<span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
								You
							</span>
						</span>
						<span className="font-mono tabular-nums">{you.score}</span>
					</div>
				) : null}
			</div>
		</div>
	);
}
