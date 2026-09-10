import { useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { applications, protocols, schedules } from "../catalogs/production";
import { reduceBlitz, startBlitz } from "../engine/blitz";
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

function durationMs(mode: BlitzMode): number | null {
	if (mode === "sprint") {
		return 60_000;
	}
	if (mode === "marathon") {
		return 300_000;
	}
	return null;
}

function bestsKey(
	state: BlitzState,
): `${DailyCategory}|${Orientation}|${BlitzMode}` {
	return `${state.category}|${state.orientation}|${state.mode}`;
}

function recordBest(
	persist: Persist,
	state: BlitzState,
): { ok: true } | { ok: false } {
	const key = bestsKey(state);
	const bests = persist.readBlitzBests();
	const best = bests[key];
	if (best === undefined || state.score > best) {
		return persist.writeBlitzBests({ ...bests, [key]: state.score });
	}
	return { ok: true };
}

function currentEntry(state: BlitzState): CatalogEntry | undefined {
	return catalogFor(state.category, protocols, applications).find(
		(entry) => entry.id === state.currentId,
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
		if (!recordBest(persist, run).ok) {
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
	}

	if (!run) {
		return (
			<main>
				<h1 className="text-2xl">Blitz</h1>
				<ProgressNotice show={saveWarning} />
				<fieldset className="mt-4">
					<legend>Daily category</legend>
					{CATEGORIES.map((item) => (
						<label key={item.value} className="mr-3">
							<input
								type="radio"
								name="blitz-category"
								checked={category === item.value}
								onChange={() => setCategory(item.value)}
							/>{" "}
							{item.label}
						</label>
					))}
				</fieldset>
				<fieldset className="mt-2">
					<legend>Orientation</legend>
					<label className="mr-3">
						<input
							type="radio"
							name="blitz-orientation"
							checked={orientation === "default"}
							onChange={() => setOrientation("default")}
						/>{" "}
						Default
					</label>
					<label className="mr-3">
						<input
							type="radio"
							name="blitz-orientation"
							checked={orientation === "inverted"}
							onChange={() => setOrientation("inverted")}
						/>{" "}
						Inverted
					</label>
				</fieldset>
				<fieldset className="mt-2">
					<legend>Mode</legend>
					{MODES.map((item) => (
						<label key={item.value} className="mr-3">
							<input
								type="radio"
								name="blitz-mode"
								checked={mode === item.value}
								onChange={() => setMode(item.value)}
							/>{" "}
							{item.label}
						</label>
					))}
				</fieldset>
				<button type="button" className="mt-4" onClick={start}>
					Start
				</button>
				{poolError ? (
					<p aria-live="polite" className="mt-2">
						{poolError}
					</p>
				) : null}
			</main>
		);
	}

	if (ended) {
		const key = bestsKey(run);
		const best = persist.readBlitzBests()[key];
		return (
			<main>
				<h1 className="text-2xl">Blitz</h1>
				<ProgressNotice show={saveWarning} />
				<p>Score {run.score}</p>
				<p>{ended === "timeout" ? "Time's up" : "Out of lives"}</p>
				<p>{best === undefined ? "Best —" : `Best ${best}`}</p>
				<p aria-live="polite" className="mt-2">
					{message}
				</p>
				<button type="button" className="mt-4" onClick={playAgain}>
					Play again
				</button>
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
		<main>
			<h1 className="text-2xl">
				{inverted ? String(puzzle.port) : puzzle.name}
			</h1>
			{blurb ? <p>{blurb}</p> : null}
			<ProgressNotice show={saveWarning} />
			<p>Lives {run.lives}</p>
			<p>Score {run.score}</p>
			{remaining !== null ? <p>Time {remaining}</p> : null}
			<div className="mt-4">
				{inverted ? (
					<Typeahead catalog={categoryCatalog} onSubmit={submitInverted} />
				) : (
					<>
						<DigitSlots
							length={digitLength(puzzle.port)}
							value={digits}
							disabled={false}
							onChange={setDigits}
							onSubmit={submitGuess}
						/>
						<button type="button" className="mt-2" onClick={submitGuess}>
							Submit
						</button>
					</>
				)}
			</div>
			<p aria-live="polite" className="mt-2">
				{message}
			</p>
		</main>
	);
}
