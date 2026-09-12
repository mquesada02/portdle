import { Link, useRouteContext } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { applications, protocols, schedules } from "../catalogs/production";
import { catalogFor } from "../engine/catalog";
import { applyCodexEncounter } from "../engine/codex";
import { getDaily } from "../engine/daily";
import {
	applyCommittedGuess,
	digitLength,
	evaluateDefaultGuess,
} from "../engine/guess";
import { bestMarkByDigit, computeMarks, type Mark } from "../engine/marks";
import { CATEGORY_LABEL } from "../engine/share";
import { applyDailyFinish, emptyStats } from "../engine/stats";
import {
	type CatalogEntry,
	type CategoryStats,
	type CodexEncounter,
	DAILY_CATEGORIES,
	type DailyCategory,
	type DailyPersist,
} from "../engine/types";
import { DailyReveal } from "./daily-reveal";
import { DigitSlots, SLOT_KEYS } from "./digit-slots";
import { defaultGuessMessage, NOT_IN_THIS_CATALOG } from "./guess-copy";
import { MissPopover } from "./miss-popover";
import { ProgressNotice } from "./notice";
import { categoryStreakGap } from "./sync-utc";

const ROUTE_FOR: Record<DailyCategory, "/" | "/protocols" | "/applications"> = {
	mixed: "/",
	protocols: "/protocols",
	applications: "/applications",
};

type CommittedGuess = DailyPersist["guesses"][number];

function padPort(port: number, length: number): string {
	return String(port).padStart(length, "0");
}

function DailySwitcher({ category }: { category: DailyCategory }) {
	return (
		<nav
			aria-label="Daily switcher"
			className="flex border-b border-zinc-200 dark:border-zinc-800"
		>
			{DAILY_CATEGORIES.map((item) => (
				<Link
					key={item}
					to={ROUTE_FOR[item]}
					activeProps={{}}
					aria-current={item === category ? "page" : undefined}
					className={`-mb-px flex-1 border-b-2 py-2.5 text-center text-sm font-medium ${
						item === category
							? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
							: "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
					}`}
				>
					{CATEGORY_LABEL[item]}
				</Link>
			))}
		</nav>
	);
}

// One color per mark, shared by the tiles and the tracker strip. Placed
// reuses the correct-guess green, absent reuses the existing miss gray;
// present is the one new mark color this ticket adds. Both placed and
// present use dark text for contrast against their bright backgrounds
// (white-on-emerald-500 and white-on-yellow-500 both fail WCAG AA; dark
// zinc-900 text passes on both). Placed and present keep one shade for
// both themes (their saturated colors already read clearly on light and
// dark surfaces); absent, closer to gray, needs a dark: shade to stay
// legible against both.
const MARK_BACKGROUND: Record<Mark, string> = {
	placed: "bg-emerald-500 text-zinc-900",
	present: "bg-yellow-500 text-zinc-900",
	absent: "bg-zinc-500 text-white dark:bg-zinc-600",
};

const MARK_BORDER: Record<Mark, string> = {
	placed: "border-emerald-500",
	present: "border-yellow-500",
	absent: "border-zinc-500 dark:border-zinc-600",
};

function tileMarkClasses(mark: Mark): string {
	return `${MARK_BORDER[mark]} ${MARK_BACKGROUND[mark]}`;
}

// The accessible text every tile and tracker digit exposes, in the form
// "digit, mark" (or "digit, unknown" when the digit has never been typed).
function markLabel(digit: string, mark: Mark | undefined): string {
	return mark ? `${digit}, ${mark}` : `${digit}, unknown`;
}

function Tiles({
	guess,
	length,
	answerPort,
}: {
	guess: CommittedGuess;
	length: number;
	answerPort: number;
}) {
	const digits = padPort(guess.port, length).split("");
	const marks = computeMarks(digits.join(""), padPort(answerPort, length));
	return (
		<div className="flex gap-1.5">
			{SLOT_KEYS.slice(0, length).map((key, index) => {
				const digit = digits[index] ?? "";
				const mark = marks[index] ?? "absent";
				return (
					<span
						key={key}
						role="img"
						aria-label={markLabel(digit, mark)}
						className={`animate-pop relative flex h-14 w-12 items-center justify-center rounded-md border-2 font-mono text-2xl font-bold ${tileMarkClasses(mark)}`}
						style={{ animationDelay: `${index * 40}ms` }}
					>
						{digit}
						{mark === "present" ? (
							<span
								aria-hidden="true"
								className="absolute right-1 bottom-1 h-1.5 w-1.5 rounded-full bg-zinc-900"
							/>
						) : null}
					</span>
				);
			})}
		</div>
	);
}

function RowCaption({
	guess,
	catalog,
}: {
	guess: CommittedGuess;
	catalog: CatalogEntry[];
}) {
	if (guess.result === "correct") {
		return null;
	}
	if (!guess.identified) {
		return <>{NOT_IN_THIS_CATALOG}</>;
	}
	const entry = catalog.find(
		(candidate) => candidate.id === guess.identified?.id,
	);
	if (!entry) {
		return <>{guess.identified.name}</>;
	}
	return <MissPopover entry={entry} placement="inline" />;
}

// Shared board-row layout: a left spacer column, the tiles or slots, and
// either a caption column (committed rows) or a matching spacer (the active
// row) so the board stays centered at and above the small breakpoint.
function RowShell({
	children,
	caption,
}: {
	children: ReactNode;
	caption?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-1 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
			<span className="hidden sm:block" />
			{children}
			{caption === undefined ? (
				<span className="hidden sm:block" />
			) : (
				<span className="text-center text-xs leading-tight text-zinc-500 sm:text-left">
					{caption}
				</span>
			)}
		</div>
	);
}

function Row({
	guess,
	length,
	catalog,
	answerPort,
}: {
	guess: CommittedGuess;
	length: number;
	catalog: CatalogEntry[];
	answerPort: number;
}) {
	return (
		<RowShell caption={<RowCaption guess={guess} catalog={catalog} />}>
			<Tiles guess={guess} length={length} answerPort={answerPort} />
		</RowShell>
	);
}

const TRACKER_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Same palette as the tiles, without the border (the strip's digits are
// small, borderless chips rather than bordered squares).
function trackerMarkClasses(mark: Mark | undefined): string {
	if (mark === undefined) {
		return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
	}
	return MARK_BACKGROUND[mark];
}

// Display-only best-known mark for each digit 0-9. The aggregation itself
// (best mark per digit, placed over present over absent) is the engine's
// bestMarkByDigit; this component only pads each committed row and renders
// the result.
function TrackerStrip({
	guesses,
	length,
	answerPort,
}: {
	guesses: CommittedGuess[];
	length: number;
	answerPort: number;
}) {
	const paddedAnswer = padPort(answerPort, length);
	const typedRows = guesses.map((guess) => padPort(guess.port, length));
	const bestByDigit = bestMarkByDigit(typedRows, paddedAnswer);
	return (
		<fieldset className="mt-4">
			<legend className="sr-only">Tracker strip</legend>
			<div className="flex justify-center gap-1">
				{TRACKER_DIGITS.map((digit) => {
					const mark = bestByDigit.get(digit);
					return (
						<span
							key={digit}
							role="img"
							aria-label={markLabel(digit, mark)}
							className={`flex h-8 w-6 items-center justify-center rounded font-mono text-xs font-semibold ${trackerMarkClasses(mark)}`}
						>
							{digit}
						</span>
					);
				})}
			</div>
		</fieldset>
	);
}

export function DailyPage({ category }: { category: DailyCategory }) {
	const { persist, utcToday } = useRouteContext({ from: "__root__" });
	const answer = getDaily(
		category,
		utcToday,
		schedules[category],
		protocols,
		applications,
	);
	const catalog = catalogFor(category, protocols, applications);
	const [board, setBoard] = useState<DailyPersist | null>(() =>
		persist.readDaily(category, utcToday),
	);
	const [digits, setDigits] = useState("");
	const [message, setMessage] = useState("");
	const [shakeKey, setShakeKey] = useState(0);
	const [saveWarning, setSaveWarning] = useState(false);
	const [finishedThisSession, setFinishedThisSession] = useState(false);

	if (!answer) {
		return (
			<main className="mx-auto max-w-md py-16 text-center">
				<h1 className="text-2xl font-bold tracking-tight">
					Puzzle unavailable
				</h1>
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
					There is no Daily for this date yet.
				</p>
				<p className="mt-4">
					<Link
						to="/blitz"
						className="text-sm font-medium underline underline-offset-4"
					>
						Play Blitz
					</Link>
				</p>
			</main>
		);
	}

	const puzzle = answer;
	const length = digitLength(puzzle.port);
	const frozen = board?.status === "won" || board?.status === "lost";
	const stats: CategoryStats = persist.readStats(category) ?? emptyStats();

	function noteWrite(result: { ok: boolean }) {
		if (!result.ok) {
			setSaveWarning(true);
		}
	}

	function recordEncounter(encounter: CodexEncounter) {
		const next = applyCodexEncounter(persist.readCodex(), encounter);
		return persist.writeCodex(next);
	}

	function submitGuess() {
		const stored = persist.readDaily(category, utcToday);
		if (stored?.status === "won" || stored?.status === "lost") {
			setBoard(stored);
			return;
		}
		const current: DailyPersist | null = stored ?? board;
		if (current?.status === "won" || current?.status === "lost") {
			setBoard(current);
			return;
		}
		const previousPorts = current?.guesses.map((guess) => guess.port) ?? [];
		const result = evaluateDefaultGuess({
			digits,
			answer: puzzle,
			previousPorts,
			catalog,
		});
		const next = applyCommittedGuess(current, result);
		if (next.status === "invalid") {
			setMessage(
				digits.length < length ? "Not enough digits." : "Not a valid port.",
			);
			setShakeKey((key) => key + 1);
			return;
		}
		if (next.status === "duplicate") {
			setMessage(defaultGuessMessage(result));
			setShakeKey((key) => key + 1);
			return;
		}
		setDigits("");
		setMessage("");
		setBoard(next);
		noteWrite(persist.writeDaily(category, utcToday, next));
		if (result.status === "miss" && result.identified) {
			noteWrite(
				recordEncounter({ state: "identified", id: result.identified.id }),
			);
		}
		if (next.status === "won" || next.status === "lost") {
			noteWrite(
				recordEncounter({
					state: next.status === "won" ? "correct" : "missed",
					id: puzzle.id,
				}),
			);
			setFinishedThisSession(true);
			if (persist.readLastPlayed(category) !== utcToday) {
				const gapped = categoryStreakGap(persist, category, utcToday);
				const finished = applyDailyFinish({
					stats: gapped,
					result: next.status,
					tries: next.guesses.length,
				});
				noteWrite(persist.writeStats(category, finished));
				noteWrite(persist.writeLastPlayed(category, utcToday));
			}
			noteWrite(persist.writeLastSeenUtc(utcToday));
		}
	}

	return (
		<main className="mx-auto w-full max-w-md px-4 pb-6 sm:max-w-lg">
			<DailySwitcher category={category} />
			<header className="mt-8 text-center">
				<p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
					Which port is
				</p>
				<h1 className="mt-1 text-3xl font-bold tracking-tight">
					{puzzle.name}
				</h1>
			</header>
			<ProgressNotice show={saveWarning} />
			<div className="mt-6 flex justify-end font-mono text-xs text-zinc-500">
				{board?.guesses.length ?? 0} / 6
			</div>
			<div className="mt-2 space-y-2">
				{(board?.guesses ?? []).map((guess) => (
					<Row
						key={`${guess.port}-${guess.result}`}
						guess={guess}
						length={length}
						catalog={catalog}
						answerPort={puzzle.port}
					/>
				))}
				{frozen ? null : (
					<RowShell>
						<DigitSlots
							length={length}
							value={digits}
							disabled={false}
							onChange={setDigits}
							onSubmit={submitGuess}
							shakeKey={shakeKey}
						/>
					</RowShell>
				)}
			</div>
			{frozen ? null : (
				<TrackerStrip
					guesses={board?.guesses ?? []}
					length={length}
					answerPort={puzzle.port}
				/>
			)}
			<p
				aria-live="polite"
				className="mt-3 min-h-5 text-center text-sm text-zinc-600 dark:text-zinc-400"
			>
				{message}
			</p>
			{frozen ? null : (
				<button
					type="button"
					onClick={submitGuess}
					className="mt-3 w-full rounded-lg bg-zinc-900 py-3 text-base font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
				>
					Submit
				</button>
			)}
			{frozen && board ? (
				<DailyReveal
					category={category}
					puzzle={puzzle}
					board={board}
					stats={stats}
					utcToday={utcToday}
					finishedThisSession={finishedThisSession}
				/>
			) : null}
		</main>
	);
}
