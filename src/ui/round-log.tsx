import type { Round } from "../engine/types";

function RoundOutcomeDot({ outcome }: { outcome: Round["outcome"] }) {
	return (
		<span
			role="img"
			aria-label={outcome}
			className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
				outcome === "correct"
					? "bg-emerald-500"
					: "bg-zinc-500 dark:bg-zinc-600"
			}`}
		/>
	);
}

function WrongAnswerText({ wrong }: { wrong: Round["wrong"] }) {
	if (!wrong) {
		return null;
	}
	if (wrong.kind === "typed") {
		return wrong.owner ? (
			<>
				you typed <span className="font-mono">{wrong.port}</span> (
				{wrong.owner.name})
			</>
		) : (
			<>
				you typed <span className="font-mono">{wrong.port}</span>
			</>
		);
	}
	return <>you picked {wrong.pick.name}</>;
}

function RoundLine({ round }: { round: Round }) {
	return (
		<li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
			<RoundOutcomeDot outcome={round.outcome} />
			<span>{round.name}</span>
			<span className="font-mono">{round.port}</span>
			{round.wrong ? (
				<span className="text-zinc-500 dark:text-zinc-400">
					<WrongAnswerText wrong={round.wrong} />
				</span>
			) : null}
		</li>
	);
}

export function RoundLog({ rounds }: { rounds: Round[] }) {
	return (
		<ul className="pt-4 space-y-1.5 text-left">
			{rounds.map((round, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: a round's id is the prompt entry's catalog id, which can repeat across rounds; RoundLine holds no state, so index-derived keys are safe here.
				<RoundLine key={`${round.id}-${index}`} round={round} />
			))}
		</ul>
	);
}
