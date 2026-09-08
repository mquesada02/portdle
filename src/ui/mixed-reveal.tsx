import { formatShare } from "../engine/share";
import { winPercent } from "../engine/stats";
import type {
	CatalogEntry,
	CategoryStats,
	DailyPersist,
} from "../engine/types";

function transportLabel(transport: CatalogEntry["transport"]): string {
	if (transport === "tcp") {
		return "TCP";
	}
	if (transport === "udp") {
		return "UDP";
	}
	return "TCP/UDP";
}

export function MixedReveal({
	puzzle,
	board,
	stats,
	utcToday,
	shareFallback,
	onShareFallback,
}: {
	puzzle: CatalogEntry;
	board: DailyPersist;
	stats: CategoryStats;
	utcToday: string;
	shareFallback: string | null;
	onShareFallback: (text: string | null) => void;
}) {
	async function share() {
		if (board.status !== "won" && board.status !== "lost") {
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
				onShareFallback(null);
				return;
			}
		} catch {
			onShareFallback(text);
			return;
		}
		onShareFallback(text);
	}

	return (
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
	);
}
