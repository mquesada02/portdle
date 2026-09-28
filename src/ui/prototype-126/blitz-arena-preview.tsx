// PROTOTYPE — throwaway. Visual stand-in for src/ui/blitz-page.tsx's arena
// (New run / Last run / Bests), fake data only, no engine/persist wiring.
// See issue #126.
import { FAKE_BESTS, FAKE_LAST_RUN } from "./fake-data";

const PRIMARY_BUTTON =
	"w-full rounded-lg bg-zinc-900 py-3 text-base font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900";

function Badge({ text }: { text: string }) {
	return (
		<span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
			{text}
		</span>
	);
}

export function BlitzArenaPreview({ heading = true }: { heading?: boolean }) {
	return (
		<div>
			{heading ? <h1 className="text-2xl font-bold tracking-tight">Blitz</h1> : null}
			<button type="button" className={`mt-4 ${PRIMARY_BUTTON}`}>
				New run
			</button>
			<section className="mt-8">
				<h2 className="text-sm font-semibold">Last run</h2>
				<div className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
					<div className="flex items-start justify-between gap-3">
						<div>
							<span className="inline-flex flex-wrap gap-1">
								<Badge text="Mixed" />
								<Badge text="Default" />
								<Badge text="Sprint" />
							</span>
							<p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
								{FAKE_LAST_RUN.endedLabel} · {FAKE_LAST_RUN.when}
							</p>
						</div>
						<p className="text-3xl font-bold tabular-nums">Score {FAKE_LAST_RUN.score}</p>
					</div>
				</div>
			</section>
			<section className="mt-8">
				<h2 className="text-sm font-semibold">Bests</h2>
				<table className="mt-2 w-full text-sm">
					<tbody>
						{FAKE_BESTS.map((row) => (
							<tr
								key={`${row.category}|${row.orientation}|${row.mode}`}
								className="border-t border-zinc-200 dark:border-zinc-800"
							>
								<td className="py-2">
									<span className="inline-flex flex-wrap gap-1">
										<Badge text={row.category} />
										<Badge text={row.orientation} />
										<Badge text={row.mode} />
									</span>
								</td>
								<td className="py-2 text-right font-mono font-semibold">Score {row.score}</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
		</div>
	);
}
