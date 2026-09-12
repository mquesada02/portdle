import { useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { applications, protocols, schedules } from "../catalogs/production";
import { buildRun, prependRun, reduceBlitz, startBlitz } from "../engine/blitz";
import { catalogFor, invertedBlurb } from "../engine/catalog";
import { digitLength } from "../engine/guess";
import type {
	BlitzMode,
	BlitzState,
	CatalogEntry,
	DailyCategory,
	Orientation,
} from "../engine/types";
import type { Persist } from "../persist/storage";
import { DigitSlots } from "./digit-slots";
import { defaultGuessMessage, invertedGuessMessage } from "./guess-copy";
import { ProgressNotice } from "./notice";
import { RoundLog } from "./round-log";
import { Typeahead } from "./typeahead";

const EMPTY_POOL = "Cannot start Blitz: not enough unused answers today.";
const CATEGORIES: Array<{ value: DailyCategory; label: string }> = [
	{ value: "mixed", label: "Mixed" },
	{ value: "protocols", label: "Protocols" },
	{ value: "applications", label: "Applications" },
];
const MODES: Array<{ value: BlitzMode; label: string }> = [
	{ value: "sprint", label: "Sprint (1m)" },
	{ value: "marathon", label: "Marathon (5m)" },
	{ value: "survival", label: "Survival" },
];
const PRIMARY_BUTTON =
	"w-full rounded-lg bg-zinc-900 py-3 text-base font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900";

function durationMs(mode: BlitzMode): number | null {
	if (mode === "sprint") {
		return 60_000;
	}
	if (mode === "marathon") {
		return 300_000;
	}
	return null;
}

function formatTime(seconds: number): string {
	const whole = Math.max(0, Math.round(seconds));
	const minutes = Math.floor(whole / 60);
	const secs = String(whole % 60).padStart(2, "0");
	return `${minutes}:${secs}`;
}

function bestsKey(
	state: BlitzState,
): `${DailyCategory}|${Orientation}|${BlitzMode}` {
	return `${state.category}|${state.orientation}|${state.mode}`;
}

function recordBest(
	persist: Persist,
	state: BlitzState,
): { ok: boolean; newBest: boolean } {
	const key = bestsKey(state);
	const bests = persist.readBlitzBests();
	const best = bests[key];
	const beatsStored = best === undefined || state.score > best;
	const newBest = beatsStored && state.score > 0;
	if (beatsStored) {
		const result = persist.writeBlitzBests({ ...bests, [key]: state.score });
		return { ok: result.ok, newBest };
	}
	return { ok: true, newBest };
}

function currentEntry(state: BlitzState): CatalogEntry | undefined {
	return catalogFor(state.category, protocols, applications).find(
		(entry) => entry.id === state.currentId,
	);
}

function Pill({
	name,
	checked,
	label,
	onChange,
}: {
	name: string;
	checked: boolean;
	label: string;
	onChange: () => void;
}) {
	return (
		<label
			className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
				checked
					? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
					: "border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600"
			}`}
		>
			<input
				type="radio"
				name={name}
				checked={checked}
				onChange={onChange}
				className="sr-only"
			/>
			{label}
		</label>
	);
}

function HeartIcon({ filled }: { filled: boolean }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			width="22"
			height="22"
			fill={filled ? "currentColor" : "none"}
			stroke="currentColor"
			strokeWidth="1.8"
			className={
				filled
					? "text-rose-500 dark:text-rose-400"
					: "text-zinc-300 dark:text-zinc-700"
			}
		>
			<path d="M12 21s-7.5-4.6-10-9.1C.5 8.4 2.4 5 6 5c2 0 3.5 1.2 4.5 2.6C11.5 6.2 13 5 15 5c3.6 0 5.5 3.4 4 6.9C19.5 16.4 12 21 12 21z" />
		</svg>
	);
}

function Hearts({ lives }: { lives: number }) {
	return (
		<span
			role="img"
			aria-label={`Lives: ${lives}`}
			className="inline-flex gap-1"
		>
			{[0, 1, 2].map((index) => (
				<HeartIcon key={index} filled={index < lives} />
			))}
		</span>
	);
}

export function BlitzPage() {
	const { persist, utcToday } = useRouteContext({ from: "__root__" });
	const [category, setCategory] = useState<DailyCategory>("mixed");
	const [orientation, setOrientation] = useState<Orientation>("default");
	const [mode, setMode] = useState<BlitzMode>("sprint");
	const [run, setRun] = useState<BlitzState | null>(null);
	const [digits, setDigits] = useState("");
	const [message, setMessage] = useState("");
	const [poolError, setPoolError] = useState("");
	const [saveWarning, setSaveWarning] = useState(false);
	const [deadline, setDeadline] = useState<number | null>(null);
	const [remaining, setRemaining] = useState<number | null>(null);
	const [shakeKey, setShakeKey] = useState(0);
	const [newBest, setNewBest] = useState(false);

	const ended = run?.ended ?? null;

	useEffect(() => {
		if (deadline === null) {
			return;
		}
		const endsAt = deadline;
		function expire() {
			setRun((current) => {
				if (!current || current.ended) {
					return current;
				}
				return reduceBlitz({
					state: current,
					event: { type: "timeout" },
					protocols,
					applications,
					rng: Math.random,
				}).state;
			});
		}
		function tick() {
			const now = Date.now();
			if (now >= endsAt) {
				expire();
				return;
			}
			setRemaining(Math.max(0, Math.ceil((endsAt - now) / 1000)));
		}
		tick();
		const interval = window.setInterval(tick, 100);
		const timeout = window.setTimeout(expire, Math.max(0, endsAt - Date.now()));
		return () => {
			window.clearInterval(interval);
			window.clearTimeout(timeout);
		};
	}, [deadline]);

	useEffect(() => {
		if (!run?.ended) {
			return;
		}
		const runRecord = buildRun({
			state: run,
			clock: () => new Date().toISOString(),
		});
		const runsResult = persist.writeBlitzRuns(
			prependRun(persist.readBlitzRuns(), runRecord),
		);
		const bestResult = recordBest(persist, run);
		setNewBest(bestResult.newBest);
		if (!runsResult.ok || !bestResult.ok) {
			setSaveWarning(true);
		}
	}, [persist, run]);

	function start() {
		const started = startBlitz({
			category,
			orientation,
			mode,
			utcToday,
			protocols,
			applications,
			schedules,
			rng: Math.random,
		});
		if ("error" in started) {
			setPoolError(EMPTY_POOL);
			return;
		}
		setPoolError("");
		setMessage("");
		setDigits("");
		setShakeKey(0);
		setNewBest(false);
		setRun(started);
		const ms = durationMs(mode);
		if (ms === null) {
			setDeadline(null);
			setRemaining(null);
		} else {
			setDeadline(Date.now() + ms);
			setRemaining(ms / 1000);
		}
	}

	function applyResult(result: ReturnType<typeof reduceBlitz>) {
		if (
			result.guess?.status === "invalid" ||
			result.guess?.status === "duplicate"
		) {
			setMessage(defaultGuessMessage(result.guess));
			setShakeKey((key) => key + 1);
			return;
		}
		if (result.inverted?.status === "duplicate") {
			setMessage(invertedGuessMessage(result.inverted));
			return;
		}
		setDigits("");
		if (result.inverted) {
			setMessage(invertedGuessMessage(result.inverted));
		} else {
			setMessage(result.guess ? defaultGuessMessage(result.guess) : "");
		}
		setRun(result.state);
	}

	function submitGuess() {
		if (!run || run.ended) {
			return;
		}
		applyResult(
			reduceBlitz({
				state: run,
				event: { type: "default-guess", digits },
				protocols,
				applications,
				rng: Math.random,
			}),
		);
	}

	function submitInverted(id: string) {
		if (!run || run.ended) {
			return;
		}
		applyResult(
			reduceBlitz({
				state: run,
				event: { type: "inverted-guess", id },
				protocols,
				applications,
				rng: Math.random,
			}),
		);
	}

	function playAgain() {
		setRun(null);
		setDigits("");
		setMessage("");
		setPoolError("");
		setDeadline(null);
		setRemaining(null);
		setNewBest(false);
	}

	if (!run) {
		return (
			<main className="mx-auto w-full max-w-md px-4 pb-6 sm:max-w-lg">
				<h1 className="text-2xl font-bold tracking-tight">Blitz</h1>
				<ProgressNotice show={saveWarning} />
				<fieldset className="mt-6">
					<legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
						Daily category
					</legend>
					<div className="mt-2 flex flex-wrap gap-2">
						{CATEGORIES.map((item) => (
							<Pill
								key={item.value}
								name="blitz-category"
								checked={category === item.value}
								label={item.label}
								onChange={() => setCategory(item.value)}
							/>
						))}
					</div>
				</fieldset>
				<fieldset className="mt-4">
					<legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
						Orientation
					</legend>
					<div className="mt-2 flex flex-wrap gap-2">
						<Pill
							name="blitz-orientation"
							checked={orientation === "default"}
							label="Default"
							onChange={() => setOrientation("default")}
						/>
						<Pill
							name="blitz-orientation"
							checked={orientation === "inverted"}
							label="Inverted"
							onChange={() => setOrientation("inverted")}
						/>
					</div>
				</fieldset>
				<fieldset className="mt-4">
					<legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
						Mode
					</legend>
					<div className="mt-2 flex flex-wrap gap-2">
						{MODES.map((item) => (
							<Pill
								key={item.value}
								name="blitz-mode"
								checked={mode === item.value}
								label={item.label}
								onChange={() => setMode(item.value)}
							/>
						))}
					</div>
				</fieldset>
				<button
					type="button"
					className={`mt-6 ${PRIMARY_BUTTON}`}
					onClick={start}
				>
					Start
				</button>
				{poolError ? (
					<p
						aria-live="polite"
						className="mt-3 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/40 dark:text-rose-200"
					>
						{poolError}
					</p>
				) : null}
			</main>
		);
	}

	if (ended) {
		const key = bestsKey(run);
		const best = persist.readBlitzBests()[key];
		const displayBest =
			best === undefined ? run.score : Math.max(best, run.score);
		return (
			<main className="mx-auto w-full max-w-md px-4 pb-6 text-center sm:max-w-lg">
				<h1 className="text-2xl font-bold tracking-tight">Blitz</h1>
				<ProgressNotice show={saveWarning} />
				<p className="mt-6 text-lg font-medium text-zinc-700 dark:text-zinc-300">
					{ended === "timeout" ? "Time's up" : "Out of lives"}
				</p>
				<p className="mt-2 text-5xl font-bold tabular-nums">
					Score {run.score}
				</p>
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
					{`Best ${displayBest}`}
				</p>
				{newBest ? (
					<span className="mt-2 inline-block rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
						New best
					</span>
				) : null}
				<p
					aria-live="polite"
					className="mt-3 min-h-5 text-sm text-zinc-600 dark:text-zinc-400"
				>
					{message}
				</p>
				<button
					type="button"
					className={`mt-4 ${PRIMARY_BUTTON}`}
					onClick={playAgain}
				>
					Play again
				</button>
				<h2 className="mt-6 text-sm font-semibold">
					{`Rounds (${run.rounds.length})`}
				</h2>
				<RoundLog rounds={run.rounds} />
			</main>
		);
	}

	const puzzle = currentEntry(run);
	if (!puzzle) {
		return (
			<main>
				<h1>Blitz</h1>
			</main>
		);
	}

	const inverted = run.orientation === "inverted";
	const categoryCatalog = catalogFor(run.category, protocols, applications);
	const blurb = inverted ? invertedBlurb(puzzle, categoryCatalog) : null;

	return (
		<main className="mx-auto w-full max-w-md px-4 pb-6 sm:max-w-lg">
			<ProgressNotice show={saveWarning} />
			<div className="mt-4 flex items-center justify-between gap-4">
				<Hearts lives={run.lives} />
				<p className="text-sm font-medium">{`Round ${run.rounds.length + 1}`}</p>
				<p className="text-sm font-medium">Score {run.score}</p>
				{remaining !== null ? (
					<span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
						{formatTime(remaining)}
					</span>
				) : null}
			</div>
			<h1 className="mt-6 text-center text-3xl font-bold tracking-tight">
				{inverted ? String(puzzle.port) : puzzle.name}
			</h1>
			{blurb ? (
				<p className="mt-1 text-center text-sm text-zinc-600 dark:text-zinc-400">
					{blurb}
				</p>
			) : null}
			<div className="mt-6">
				{inverted ? (
					<Typeahead catalog={categoryCatalog} onSubmit={submitInverted} />
				) : (
					<>
						<div className="flex justify-center">
							<DigitSlots
								length={digitLength(puzzle.port)}
								value={digits}
								disabled={false}
								onChange={setDigits}
								onSubmit={submitGuess}
								shakeKey={shakeKey}
							/>
						</div>
						<button
							type="button"
							className={`mt-3 ${PRIMARY_BUTTON}`}
							onClick={submitGuess}
						>
							Submit
						</button>
					</>
				)}
			</div>
			<p
				aria-live="polite"
				className="mt-3 min-h-5 text-center text-sm text-zinc-600 dark:text-zinc-400"
			>
				{message}
			</p>
			<RoundLog rounds={run.rounds.slice(-3).reverse()} />
		</main>
	);
}
