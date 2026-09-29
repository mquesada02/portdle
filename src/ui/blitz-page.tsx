import { useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { applications, protocols, schedules } from "../catalogs/production";
import {
	buildRun,
	prependRun,
	reduceBlitz,
	replacesBest,
	startBlitz,
} from "../engine/blitz";
import { catalogFor, invertedBlurb } from "../engine/catalog";
import { applyCodexEncounter } from "../engine/codex";
import { digitLength } from "../engine/guess";
import type {
	BlitzBests,
	BlitzBestsKey,
	BlitzMode,
	BlitzRun,
	BlitzState,
	CatalogEntry,
	CodexEncounter,
	DailyCategory,
	Orientation,
} from "../engine/types";
import { DAILY_CATEGORIES } from "../engine/types";
import type { Persist } from "../persist/storage";
import { localDate, localTime, SetupBadges } from "./blitz-badges";
import { DigitSlots } from "./digit-slots";
import { defaultGuessMessage, invertedGuessMessage } from "./guess-copy";
import { ProgressNotice } from "./notice";
import { RoundLog } from "./round-log";
import { Typeahead } from "./typeahead";
import { runViewTransition } from "./view-transition";

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
const ORIENTATION_ORDER: Orientation[] = ["default", "inverted"];
const MODE_ORDER: BlitzMode[] = MODES.map((item) => item.value);
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

const monotonicNow = () => performance.now();

function bestsKey(state: BlitzState): BlitzBestsKey {
	return `${state.category}|${state.orientation}|${state.mode}`;
}

function recordBest(
	persist: Persist,
	state: BlitzState,
): { ok: boolean; newBest: boolean } {
	const key = bestsKey(state);
	const bests = persist.readBlitzBests();
	const best = bests[key];
	const replaces = replacesBest({
		best,
		score: state.score,
		timeToScoreMs: state.timeToScoreMs,
	});
	const newBest = replaces && state.score > 0;
	if (replaces) {
		const result = persist.writeBlitzBests({
			...bests,
			[key]: { score: state.score, timeToScoreMs: state.timeToScoreMs },
		});
		return { ok: result.ok, newBest };
	}
	return { ok: true, newBest };
}

function currentEntry(state: BlitzState): CatalogEntry | undefined {
	return catalogFor(state.category, protocols, applications).find(
		(entry) => entry.id === state.currentId,
	);
}

// Ordered by category (Mixed, Protocols, Applications), then orientation
// (Default, Inverted), then mode (Sprint, Marathon, Survival), per the arena's
// fixed Bests order.
function sortedBests(bests: BlitzBests): Array<{
	category: DailyCategory;
	orientation: Orientation;
	mode: BlitzMode;
	score: number;
}> {
	return Object.entries(bests)
		.map(([key, best]) => {
			const [category, orientation, mode] = key.split("|") as [
				DailyCategory,
				Orientation,
				BlitzMode,
			];
			return { category, orientation, mode, score: best.score };
		})
		.sort((a, b) => {
			const byCategory =
				DAILY_CATEGORIES.indexOf(a.category) -
				DAILY_CATEGORIES.indexOf(b.category);
			if (byCategory !== 0) {
				return byCategory;
			}
			const byOrientation =
				ORIENTATION_ORDER.indexOf(a.orientation) -
				ORIENTATION_ORDER.indexOf(b.orientation);
			if (byOrientation !== 0) {
				return byOrientation;
			}
			return MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode);
		});
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

// The title alone (inside the label) is the radio's accessible name; the
// caption sits outside the label as a sibling, wired via aria-describedby, so
// it becomes the accessible description instead of joining the name.
function OrientationCard({
	name,
	checked,
	title,
	caption,
	onChange,
}: {
	name: string;
	checked: boolean;
	title: string;
	caption: string;
	onChange: () => void;
}) {
	const titleId = `${name}-${title.toLowerCase()}-title`;
	const captionId = `${name}-${title.toLowerCase()}-caption`;
	return (
		<label
			className={`block cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
				checked
					? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
					: "border-zinc-300 dark:border-zinc-700"
			}`}
		>
			<input
				type="radio"
				name={name}
				checked={checked}
				onChange={onChange}
				aria-labelledby={titleId}
				aria-describedby={captionId}
				className="sr-only"
			/>
			<span id={titleId} className="block text-sm font-semibold">
				{title}
			</span>
			<span
				id={captionId}
				className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400"
			>
				{caption}
			</span>
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

function LastRun({ run }: { run: BlitzRun | undefined }) {
	if (!run) {
		return (
			<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
				No runs yet. Start one and it will show here.
			</p>
		);
	}
	return (
		<div className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
			<div className="flex items-start justify-between gap-3">
				<div>
					<span className="inline-flex flex-wrap gap-1">
						<SetupBadges
							category={run.category}
							orientation={run.orientation}
							mode={run.mode}
						/>
					</span>
					<p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
						{run.ended === "timeout" ? "Time's up" : "Out of lives"} ·{" "}
						{localDate(run.endedAt)} {localTime(run.endedAt)}
					</p>
				</div>
				<p className="text-3xl font-bold tabular-nums">Score {run.score}</p>
			</div>
			<details className="mt-3">
				<summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">
					{`Rounds (${run.rounds.length})`}
				</summary>
				<RoundLog rounds={run.rounds} />
			</details>
		</div>
	);
}

function BestsTable({ bests }: { bests: BlitzBests }) {
	const rows = sortedBests(bests);
	if (rows.length === 0) {
		return null;
	}
	return (
		<section className="mt-8">
			<h2 className="text-sm font-semibold">Bests</h2>
			<table className="mt-2 w-full text-sm">
				<tbody>
					{rows.map((row) => (
						<tr
							key={`${row.category}|${row.orientation}|${row.mode}`}
							className="border-t border-zinc-200 dark:border-zinc-800"
						>
							<td className="py-2">
								<span className="inline-flex flex-wrap gap-1">
									<SetupBadges
										category={row.category}
										orientation={row.orientation}
										mode={row.mode}
									/>
								</span>
							</td>
							<td className="py-2 text-right font-mono font-semibold">
								Score {row.score}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}

function SetupDialog({
	open,
	category,
	orientation,
	mode,
	poolError,
	onCategoryChange,
	onOrientationChange,
	onModeChange,
	onStart,
	onCancel,
}: {
	open: boolean;
	category: DailyCategory;
	orientation: Orientation;
	mode: BlitzMode;
	poolError: string;
	onCategoryChange: (value: DailyCategory) => void;
	onOrientationChange: (value: Orientation) => void;
	onModeChange: (value: BlitzMode) => void;
	onStart: () => void;
	onCancel: () => void;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	useEffect(() => {
		if (!open) {
			return;
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onCancel();
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [open, onCancel]);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled by the document-level listener above; Cancel is the click's keyboard equivalent.
		<dialog
			ref={dialogRef}
			aria-labelledby="blitz-setup-title"
			className="m-auto max-w-sm bg-transparent p-0 backdrop:bg-black/50 dark:backdrop:bg-black/70"
			onClick={(event) => {
				if (event.target === dialogRef.current) {
					onCancel();
				}
			}}
		>
			<div className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
				<h2 id="blitz-setup-title" className="text-xl font-bold">
					New run
				</h2>
				<fieldset className="mt-4">
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
								onChange={() => onCategoryChange(item.value)}
							/>
						))}
					</div>
				</fieldset>
				<fieldset className="mt-4">
					<legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
						Orientation
					</legend>
					<div className="mt-2 grid grid-cols-2 gap-2">
						<OrientationCard
							name="blitz-orientation"
							checked={orientation === "default"}
							title="Default"
							caption="See a service, type its port."
							onChange={() => onOrientationChange("default")}
						/>
						<OrientationCard
							name="blitz-orientation"
							checked={orientation === "inverted"}
							title="Inverted"
							caption="See a port, pick the service."
							onChange={() => onOrientationChange("inverted")}
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
								onChange={() => onModeChange(item.value)}
							/>
						))}
					</div>
				</fieldset>
				<button
					type="button"
					className={`mt-6 ${PRIMARY_BUTTON}`}
					onClick={onStart}
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
				<button
					type="button"
					className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
					onClick={onCancel}
				>
					Cancel
				</button>
			</div>
		</dialog>
	);
}

export function BlitzPage() {
	const { persist, utcToday } = useRouteContext({ from: "__root__" });
	// Read once, at mount: the dialog preselects the last run's setup, or the
	// fixed fallback when there is none.
	const [initialSetup] = useState(() => {
		const lastRun = persist.readBlitzRuns()[0];
		return {
			category: lastRun?.category ?? "mixed",
			orientation: lastRun?.orientation ?? "default",
			mode: lastRun?.mode ?? "sprint",
		};
	});
	const [category, setCategory] = useState(initialSetup.category);
	const [orientation, setOrientation] = useState(initialSetup.orientation);
	const [mode, setMode] = useState(initialSetup.mode);
	const [dialogOpen, setDialogOpen] = useState(false);
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
		let expired = false;
		function expire() {
			if (expired) {
				return;
			}
			expired = true;
			runViewTransition(["phase"], () => {
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
						now: monotonicNow,
					}).state;
				});
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
			now: monotonicNow,
		});
		if ("error" in started) {
			setPoolError(EMPTY_POOL);
			return;
		}
		runViewTransition(["phase"], () => {
			setPoolError("");
			setMessage("");
			setDigits("");
			setShakeKey(0);
			setNewBest(false);
			setRun(started);
			setDialogOpen(false);
			const ms = durationMs(mode);
			if (ms === null) {
				setDeadline(null);
				setRemaining(null);
			} else {
				setDeadline(Date.now() + ms);
				setRemaining(ms / 1000);
			}
		});
	}

	function closeDialog() {
		setDialogOpen(false);
		setPoolError("");
	}

	function recordEncounters(encounters: CodexEncounter[]): { ok: boolean } {
		const next = encounters.reduce(
			(map, encounter) => applyCodexEncounter(map, encounter),
			persist.readCodex(),
		);
		return persist.writeCodex(next);
	}

	function encountersFor(
		result: ReturnType<typeof reduceBlitz>,
		promptId: string,
	): CodexEncounter[] {
		if (
			result.guess &&
			result.guess.status !== "invalid" &&
			result.guess.status !== "duplicate"
		) {
			if (result.guess.status === "correct") {
				return [{ state: "correct", id: promptId }];
			}
			const encounters: CodexEncounter[] = [{ state: "missed", id: promptId }];
			if (result.guess.identified) {
				encounters.push({
					state: "identified",
					id: result.guess.identified.id,
				});
			}
			return encounters;
		}
		if (result.inverted && result.inverted.status !== "duplicate") {
			if (result.inverted.status === "correct") {
				return [{ state: "correct", id: promptId }];
			}
			return [
				{ state: "missed", id: promptId },
				{ state: "identified", id: result.inverted.identified.id },
			];
		}
		return [];
	}

	function applyResult(
		result: ReturnType<typeof reduceBlitz>,
		promptId: string,
	) {
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
		const encounters = encountersFor(result, promptId);
		if (encounters.length > 0 && !recordEncounters(encounters).ok) {
			setSaveWarning(true);
		}
		function commit() {
			setDigits("");
			if (result.inverted) {
				setMessage(invertedGuessMessage(result.inverted));
			} else {
				setMessage(result.guess ? defaultGuessMessage(result.guess) : "");
			}
			setRun(result.state);
		}
		if (result.state.ended !== null) {
			runViewTransition(["phase"], commit);
		} else {
			commit();
		}
	}

	function submitGuess() {
		if (!run || run.ended) {
			return;
		}
		const promptId = run.currentId;
		applyResult(
			reduceBlitz({
				state: run,
				event: { type: "default-guess", digits },
				protocols,
				applications,
				rng: Math.random,
				now: monotonicNow,
			}),
			promptId,
		);
	}

	function submitInverted(id: string) {
		if (!run || run.ended) {
			return;
		}
		const promptId = run.currentId;
		applyResult(
			reduceBlitz({
				state: run,
				event: { type: "inverted-guess", id },
				protocols,
				applications,
				rng: Math.random,
				now: monotonicNow,
			}),
			promptId,
		);
	}

	function playAgain() {
		runViewTransition(["phase"], () => {
			setRun(null);
			setDigits("");
			setMessage("");
			setPoolError("");
			setDeadline(null);
			setRemaining(null);
			setNewBest(false);
		});
	}

	if (!run) {
		const lastRun = persist.readBlitzRuns()[0];
		const bests = persist.readBlitzBests();
		return (
			<>
				<main className="mx-auto w-full max-w-md px-4 pb-6 sm:max-w-lg">
					<h1 className="text-2xl font-bold tracking-tight">Blitz</h1>
					<ProgressNotice show={saveWarning} />
					<button
						type="button"
						className={`mt-4 ${PRIMARY_BUTTON}`}
						onClick={() => setDialogOpen(true)}
					>
						New run
					</button>
					<section className="mt-8">
						<h2 className="text-sm font-semibold">Last run</h2>
						<LastRun run={lastRun} />
					</section>
					<BestsTable bests={bests} />
				</main>
				<SetupDialog
					open={dialogOpen}
					category={category}
					orientation={orientation}
					mode={mode}
					poolError={poolError}
					onCategoryChange={setCategory}
					onOrientationChange={setOrientation}
					onModeChange={setMode}
					onStart={start}
					onCancel={closeDialog}
				/>
			</>
		);
	}

	if (ended) {
		const key = bestsKey(run);
		const best = persist.readBlitzBests()[key];
		const displayBest =
			best === undefined ? run.score : Math.max(best.score, run.score);
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
