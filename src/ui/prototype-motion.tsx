// PROTOTYPE — throwaway (ticket "Prototype: new motion", #220). Never merge.
// Two axes, each switchable via a URL search param and the floating bar:
//   ?rounds=A|B|C  the Rounds disclosure (History, Blitz arena "Last run")
//   ?theme=A|B|C   the theme change
// Reduced motion: every variant is instant (the global reduced-motion rule
// zeroes CSS motion; the JS paths below check the media query).

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export const ROUNDS = {
	A: "Height, CSS only (::details-content)",
	B: "Height, JS (Web Animations)",
	C: "No height: fade in and out",
} as const;
export const THEMES = {
	A: "Crossfade (view transition)",
	B: "Circle reveal from the toggle",
	C: "Color transition (no view transition)",
} as const;
type Axis = "rounds" | "theme";
const KEYS = ["A", "B", "C"] as const;
type Key = (typeof KEYS)[number];

function read(axis: Axis): Key {
	const v = new URLSearchParams(location.search).get(axis);
	return (KEYS as readonly string[]).includes(v ?? "") ? (v as Key) : "A";
}
const reduced = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- theme --------------------------------------------------------------

export function changeThemeWithVariant(
	update: () => void,
	from: HTMLElement,
): void {
	const v = read("theme");
	if (reduced()) {
		update();
		return;
	}
	if (v === "C") {
		const html = document.documentElement;
		html.classList.add("proto-theme-colors");
		update();
		setTimeout(() => html.classList.remove("proto-theme-colors"), 300);
		return;
	}
	if (typeof document.startViewTransition !== "function") {
		update();
		return;
	}
	const box = from.getBoundingClientRect();
	const x = box.left + box.width / 2;
	const y = box.top + box.height / 2;
	document.documentElement.dataset.protoTheme = v;
	const t = document.startViewTransition(() => flushSync(update));
	if (v === "B") {
		const r = Math.hypot(
			Math.max(x, innerWidth - x),
			Math.max(y, innerHeight - y),
		);
		t.ready.then(() =>
			document.documentElement.animate(
				{
					clipPath: [
						`circle(0px at ${x}px ${y}px)`,
						`circle(${r}px at ${x}px ${y}px)`,
					],
				},
				{
					duration: 400,
					easing: "ease-out",
					pseudoElement: "::view-transition-new(root)",
				},
			),
		);
	}
	t.finished.finally(() => delete document.documentElement.dataset.protoTheme);
}

// --- rounds disclosure --------------------------------------------------

// Variant B: animate the <details> height with the Web Animations API,
// open and close, by intercepting the summary click.
function onSummaryClick(e: MouseEvent) {
	if (read("rounds") !== "B" || reduced()) return;
	const summary = (e.target as Element).closest("summary");
	const details = summary?.parentElement;
	if (!summary || !(details instanceof HTMLDetailsElement)) return;
	e.preventDefault();
	const closed = summary.offsetHeight;
	const start = details.offsetHeight;
	const opening = !details.open;
	if (opening) details.open = true;
	const full = details.scrollHeight;
	const anim = details.animate(
		{ height: [`${start}px`, `${opening ? full : closed}px`] },
		{ duration: 200, easing: "ease-out" },
	);
	details.style.overflow = "hidden";
	anim.onfinish = () => {
		if (!opening) details.open = false;
		details.style.overflow = "";
	};
}

export function PrototypeMotionBar() {
	const [, force] = useState(0);
	useEffect(() => {
		document.documentElement.dataset.protoRounds = read("rounds");
		document.addEventListener("click", onSummaryClick, true);
		return () => document.removeEventListener("click", onSummaryClick, true);
	}, []);
	function cycle(axis: Axis, step: 1 | -1) {
		const i = KEYS.indexOf(read(axis));
		const next = KEYS[(i + step + KEYS.length) % KEYS.length] ?? "A";
		const p = new URLSearchParams(location.search);
		p.set(axis, next);
		history.replaceState(history.state, "", `?${p}`);
		document.documentElement.dataset.protoRounds = read("rounds");
		force((n) => n + 1);
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as Element).closest("input, textarea, [contenteditable]"))
				return;
			if (e.key === "ArrowLeft") cycle("rounds", -1);
			if (e.key === "ArrowRight") cycle("rounds", 1);
			if (e.key === "ArrowUp") cycle("theme", -1);
			if (e.key === "ArrowDown") cycle("theme", 1);
		};
		addEventListener("keydown", onKey);
		return () => removeEventListener("keydown", onKey);
	});
	function seedRuns() {
		const round = (i: number, ok: boolean) => ({
			id: `proto-${i}`,
			name: ["HTTP", "SSH", "DNS", "SMTP", "Redis", "PostgreSQL"][i % 6],
			port: [80, 22, 53, 25, 6379, 5432][i % 6],
			outcome: ok ? "correct" : "miss",
			wrong: ok ? null : { kind: "typed", port: 8080, owner: null },
		});
		const run = (n: number, minutesAgo: number) => ({
			category: "mixed",
			orientation: "default",
			mode: "sprint",
			ended: "timeout",
			endedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
			score: n - 2,
			rounds: Array.from({ length: n }, (_, i) => round(i, i % 4 !== 3)),
		});
		localStorage.setItem(
			"portdle:v1:blitzRuns",
			JSON.stringify([run(9, 5), run(14, 60)]),
		);
		location.reload();
	}
	const btn = "rounded-full bg-zinc-700 px-2 py-1 text-white hover:bg-zinc-600";
	return (
		<div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-1 rounded-2xl bg-black px-3 py-2 text-xs font-semibold text-white shadow-2xl sm:bottom-4">
			<div className="flex items-center gap-2">
				<button
					type="button"
					className={btn}
					onClick={() => cycle("rounds", -1)}
				>
					←
				</button>
				<span>
					Rounds {read("rounds")} — {ROUNDS[read("rounds")]}
				</span>
				<button
					type="button"
					className={btn}
					onClick={() => cycle("rounds", 1)}
				>
					→
				</button>
			</div>
			<div className="flex items-center gap-2">
				<button
					type="button"
					className={btn}
					onClick={() => cycle("theme", -1)}
				>
					↑
				</button>
				<span>
					Theme {read("theme")} — {THEMES[read("theme")]}
				</span>
				<button type="button" className={btn} onClick={() => cycle("theme", 1)}>
					↓
				</button>
				<button type="button" className={btn} onClick={seedRuns}>
					Seed 2 runs
				</button>
			</div>
		</div>
	);
}
