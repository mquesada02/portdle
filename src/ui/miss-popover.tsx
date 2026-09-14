import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import type { CatalogEntry } from "../engine/types";

// Miss popover trigger + panel for an identified Daily miss, or (grid
// placement) a seen Codex card. State model from the redesign prototype
// (branch prototype/ui, commit fd70684): pinned, hovered, and focused
// booleans, open when any is true. Mouse enter on the trigger or the panel
// sets hovered and cancels the leave timer; mouse leave starts a 150ms grace
// timer that clears hovered unless cancelled by re-entering either. Click
// toggles pinned. Escape clears all three. A pointer-down outside both clears
// pinned and hovered. Placement decides two things: whether focus alone
// counts toward open (inline only), and where the panel sits relative to the
// trigger. The trigger element itself is supplied by the caller via the
// `trigger` render prop, which receives the interaction wiring
// (`triggerProps`) to spread onto it; MissPopover still owns all the state
// above. Left unset, `trigger` defaults to today's Daily text-link button.
//
// Open/close motion (see docs/superpowers/specs/2026-09-14-t90-popover-motion.md):
// a `phase` state layered on top of `open` keeps the
// panel mounted through its exit. `open` becoming true sets phase to
// "entering" (fresh open, plays the enter keyframe) or, if a reopen lands
// during an exit, back to "open" (cancels the exit at once, no replay).
// `open` becoming false sets phase to "exiting" (plays the exit keyframe,
// listening for its animation-end event or an 80ms fallback, whichever comes
// first) unless reduced motion is on, in which case it unmounts immediately,
// exactly as before. A further close while already exiting, or while phase is
// null, is a no-op. This stays in MissPopover rather than a separate hook:
// the phase state only ever has this one caller, and it reads `open` and
// drives the same panel the pin/hover/focus state already renders.
type MissPopoverPlacement = "inline" | "grid";
type MissPopoverPhase = "entering" | "open" | "exiting";

export type MissPopoverTriggerProps = {
	"aria-expanded": boolean;
	"aria-controls": string;
	onMouseEnter: () => void;
	onMouseLeave: () => void;
	onFocus: () => void;
	onBlur: () => void;
	onClick: () => void;
};

export function MissPopover({
	entry,
	placement,
	lastColumn = false,
	trigger = (triggerProps) => (
		<button
			type="button"
			{...triggerProps}
			className="rounded text-xs text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:hover:text-zinc-200 dark:focus:ring-zinc-100/20"
		>
			{entry.name}
		</button>
	),
}: {
	entry: CatalogEntry;
	placement: MissPopoverPlacement;
	lastColumn?: boolean;
	trigger?: (triggerProps: MissPopoverTriggerProps) => ReactNode;
}) {
	const id = useId();
	const [pinned, setPinned] = useState(false);
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const leaveTimer = useRef<number | null>(null);
	const panelRef = useRef<HTMLSpanElement | null>(null);
	const [phase, setPhase] = useState<MissPopoverPhase | null>(null);
	const focusOpens = placement === "inline";
	const open = pinned || hovered || (focusOpens && focused);

	function enter() {
		if (leaveTimer.current !== null) {
			window.clearTimeout(leaveTimer.current);
			leaveTimer.current = null;
		}
		setHovered(true);
	}

	function leave() {
		leaveTimer.current = window.setTimeout(() => setHovered(false), 150);
	}

	useEffect(() => {
		return () => {
			if (leaveTimer.current !== null) {
				window.clearTimeout(leaveTimer.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!open) {
			return;
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setPinned(false);
				setHovered(false);
				setFocused(false);
			}
		}
		function onPointerDown(event: PointerEvent) {
			const target = event.target as HTMLElement | null;
			if (!target?.closest(`[data-popover="${id}"]`)) {
				setPinned(false);
				setHovered(false);
			}
		}
		window.addEventListener("keydown", onKey);
		window.addEventListener("pointerdown", onPointerDown);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("pointerdown", onPointerDown);
		};
	}, [open, id]);

	useEffect(() => {
		if (open) {
			setPhase((current) => (current === null ? "entering" : "open"));
			return;
		}
		setPhase((current) => {
			if (current === null || current === "exiting") {
				return current;
			}
			const reduced = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
			return reduced ? null : "exiting";
		});
	}, [open]);

	useEffect(() => {
		if (phase !== "exiting") {
			return;
		}
		const panel = panelRef.current;
		const fallback = window.setTimeout(() => setPhase(null), 80);
		function onAnimationEnd() {
			window.clearTimeout(fallback);
			setPhase(null);
		}
		panel?.addEventListener("animationend", onAnimationEnd);
		return () => {
			window.clearTimeout(fallback);
			panel?.removeEventListener("animationend", onAnimationEnd);
		};
	}, [phase]);

	const positionClasses =
		placement === "grid"
			? `top-full mt-1 ${lastColumn ? "right-0" : "left-0"}`
			: "top-full left-1/2 mt-1 -translate-x-1/2 sm:right-0 sm:left-auto sm:translate-x-0";

	const originClasses =
		placement === "grid"
			? lastColumn
				? "origin-top-right"
				: "origin-top-left"
			: "origin-top sm:origin-top-right";

	const motionClasses =
		phase === "entering"
			? "animate-popover-in"
			: phase === "exiting"
				? "animate-popover-out pointer-events-none"
				: "";

	const triggerProps: MissPopoverTriggerProps = {
		"aria-expanded": open,
		"aria-controls": `${id}-panel`,
		onMouseEnter: enter,
		onMouseLeave: leave,
		onFocus: () => setFocused(true),
		onBlur: () => setFocused(false),
		onClick: () => setPinned((current) => !current),
	};

	return (
		<span className="relative inline-block" data-popover={id}>
			{trigger(triggerProps)}
			{phase !== null ? (
				<span
					ref={panelRef}
					id={`${id}-panel`}
					role="note"
					inert={phase === "exiting"}
					onMouseEnter={enter}
					onMouseLeave={leave}
					className={`absolute z-30 block w-64 rounded-lg border border-zinc-200 bg-white p-3 text-left text-xs shadow-lg dark:border-zinc-800 dark:bg-zinc-900 ${positionClasses} ${originClasses} ${motionClasses}`}
				>
					<span className="flex items-baseline justify-between gap-2">
						<span className="font-semibold text-zinc-900 dark:text-zinc-100">
							{entry.name}
						</span>
						<span className="font-mono text-zinc-500">{entry.port}</span>
					</span>
					<span className="mt-1 block text-zinc-600 dark:text-zinc-400">
						{entry.description}
					</span>
					{(entry.sources ?? []).length > 0 ? (
						<span className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
							{(entry.sources ?? []).map((source) => (
								<a
									key={source.url}
									href={source.url}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-2"
								>
									{source.label}
								</a>
							))}
						</span>
					) : null}
				</span>
			) : null}
		</span>
	);
}
