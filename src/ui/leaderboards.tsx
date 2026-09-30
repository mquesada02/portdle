import { useEffect, useRef, useState } from "react";
import type { BlitzMode, DailyCategory, Orientation } from "../engine/types";
import {
	LEADERBOARD_TOP,
	type LeaderboardPage,
	type LeaderboardRow,
	type LeaderboardWindow,
	type Remote,
} from "../remote/remote";
import type { Sync } from "../sync/sync";
import { CATEGORIES, MODES, ORIENTATIONS, Pill } from "./blitz-choices";

const WINDOWS: Array<{ value: LeaderboardWindow; label: string }> = [
	{ value: "allTime", label: "All-time" },
	{ value: "weekly", label: "Weekly" },
	{ value: "today", label: "Today" },
];
type Result =
	| { status: "loading" }
	| { status: "error" }
	| { status: "ready"; page: LeaderboardPage };

function Choice<T extends string>({
	legend,
	name,
	items,
	value,
	onChange,
}: {
	legend: string;
	name: string;
	items: Array<{ value: T; label: string }>;
	value: T;
	onChange: (value: T) => void;
}) {
	return (
		<fieldset className="flex flex-wrap gap-2">
			<legend className="sr-only">{legend}</legend>
			{items.map((item) => (
				<Pill
					key={item.value}
					name={name}
					checked={value === item.value}
					label={item.label}
					onChange={() => onChange(item.value)}
				/>
			))}
		</fieldset>
	);
}

function YouBadge() {
	return (
		<span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
			You
		</span>
	);
}

function RankRow({
	row,
	you,
	className,
}: {
	row: LeaderboardRow;
	you: boolean;
	className: string;
}) {
	return (
		<tr className={className}>
			<td className="py-2 pr-1 pl-3 tabular-nums">{row.rank}</td>
			<td className="py-2">
				{row.displayName}
				{you ? <YouBadge /> : null}
			</td>
			<td className="py-2 pr-3 text-right font-mono tabular-nums">
				{row.score}
			</td>
		</tr>
	);
}

function RankedList({ page }: { page: LeaderboardPage }) {
	if (page.rows.length === 0) {
		return (
			<p className="mt-4 text-sm">Nobody has played this Leaderboard yet.</p>
		);
	}
	const top = page.rows.filter((row) => row.rank <= LEADERBOARD_TOP);
	const own = page.rows.find((row) => row.accountId === page.viewerId);
	const pinned = own && own.rank > LEADERBOARD_TOP ? own : undefined;
	return (
		<div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
			<table className="w-full text-sm">
				<thead className="sr-only">
					<tr>
						<th>Rank</th>
						<th>Player</th>
						<th>Score</th>
					</tr>
				</thead>
				<tbody>
					{top.map((row) => (
						<RankRow
							key={row.accountId}
							row={row}
							you={row === own}
							className="border-t border-zinc-200 first:border-t-0 dark:border-zinc-800"
						/>
					))}
				</tbody>
				{pinned ? (
					<tfoot>
						<RankRow
							row={pinned}
							you
							className="border-t border-zinc-300 bg-zinc-100 font-semibold dark:border-zinc-700 dark:bg-zinc-800"
						/>
					</tfoot>
				) : null}
			</table>
		</div>
	);
}

export type LeaderboardPicker = {
	window: LeaderboardWindow;
	category: DailyCategory;
	orientation: Orientation;
	mode: BlitzMode;
};

export function Leaderboards({
	remote,
	sync,
	picker,
	onPickerChange,
}: {
	remote: Remote;
	sync?: Sync;
	picker: LeaderboardPicker;
	onPickerChange: (picker: LeaderboardPicker) => void;
}) {
	const { window: windowKey, category, orientation, mode } = picker;
	const [result, setResult] = useState<Result>({ status: "loading" });
	// Opening the panel pushes pending changes once; every read waits for it.
	const synced = useRef<Promise<void> | null>(null);

	useEffect(() => {
		let current = true;
		setResult({ status: "loading" });
		synced.current ??= sync ? sync.refresh() : Promise.resolve();
		synced.current
			.then(() =>
				remote.readLeaderboard({
					window: windowKey,
					category,
					orientation,
					mode,
				}),
			)
			.then(
				(page) => {
					if (current) {
						setResult({ status: "ready", page });
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
		};
	}, [remote, sync, windowKey, category, orientation, mode]);

	return (
		<div>
			<div className="mt-4 space-y-2">
				<Choice
					legend="Window"
					name="leaderboard-window"
					items={WINDOWS}
					value={windowKey}
					onChange={(value) => onPickerChange({ ...picker, window: value })}
				/>
				<Choice
					legend="Daily category"
					name="leaderboard-category"
					items={CATEGORIES}
					value={category}
					onChange={(value) => onPickerChange({ ...picker, category: value })}
				/>
				<div className="flex flex-wrap gap-x-2 gap-y-2">
					<Choice
						legend="Orientation"
						name="leaderboard-orientation"
						items={ORIENTATIONS}
						value={orientation}
						onChange={(value) =>
							onPickerChange({ ...picker, orientation: value })
						}
					/>
					<Choice
						legend="Blitz mode"
						name="leaderboard-mode"
						items={MODES}
						value={mode}
						onChange={(value) => onPickerChange({ ...picker, mode: value })}
					/>
				</div>
			</div>
			<div role="status">
				{result.status === "loading" ? (
					<p className="mt-4 text-sm">Loading…</p>
				) : null}
			</div>
			{result.status === "error" ? (
				<p role="alert" className="mt-4 text-sm">
					Could not load this Leaderboard.
				</p>
			) : null}
			{result.status === "ready" ? <RankedList page={result.page} /> : null}
		</div>
	);
}
