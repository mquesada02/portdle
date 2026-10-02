import { useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	type CodexCard as CodexCardData,
	clearCodexFresh,
	codexCounts,
	codexGroups,
} from "../engine/codex";
import type {
	CatalogEntry,
	CatalogKind,
	CodexSort,
	CodexState,
} from "../engine/types";
import { transportLabel } from "./daily-reveal";
import { MissPopover } from "./miss-popover";
import { ProgressNotice } from "./notice";
import { LoadStatus, useServerData } from "./server-data";
import { runViewTransition } from "./view-transition";

const KIND_LABEL: Record<CatalogKind, string> = {
	protocol: "Protocols",
	application: "Applications",
};

const STATE_LABEL: Record<CodexState, string> = {
	correct: "Correct",
	missed: "Missed",
	identified: "Identified",
};

const STATE_ACCENT: Record<CodexState, string> = {
	correct: "border-l-emerald-500",
	missed: "border-l-rose-500",
	identified: "border-l-zinc-400 dark:border-l-zinc-500",
};

const STATE_TEXT: Record<CodexState, string> = {
	correct: "text-emerald-600 dark:text-emerald-400",
	missed: "text-rose-600 dark:text-rose-400",
	identified: "text-zinc-600 dark:text-zinc-400",
};

function isLastColumn(index: number, columnCount: number): boolean {
	return index % columnCount === columnCount - 1;
}

function columnCountFor(mdMatches: boolean, smMatches: boolean): number {
	if (mdMatches) {
		return 4;
	}
	if (smMatches) {
		return 3;
	}
	return 2;
}

function useColumnCount(): number {
	const [count, setCount] = useState(() =>
		columnCountFor(
			window.matchMedia("(min-width: 768px)").matches,
			window.matchMedia("(min-width: 640px)").matches,
		),
	);
	useEffect(() => {
		const md = window.matchMedia("(min-width: 768px)");
		const sm = window.matchMedia("(min-width: 640px)");
		function update() {
			setCount(columnCountFor(md.matches, sm.matches));
		}
		md.addEventListener("change", update);
		sm.addEventListener("change", update);
		return () => {
			md.removeEventListener("change", update);
			sm.removeEventListener("change", update);
		};
	}, []);
	return count;
}

function SortOption({
	value,
	checked,
	label,
	onChange,
}: {
	value: CodexSort;
	checked: boolean;
	label: string;
	onChange: (value: CodexSort) => void;
}) {
	return (
		<label
			className={`-mb-px flex-1 cursor-pointer border-b-2 py-2.5 text-center text-sm font-medium transition-colors ${
				checked
					? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
					: "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
			}`}
		>
			<input
				type="radio"
				name="codex-sort"
				checked={checked}
				onChange={() => onChange(value)}
				className="sr-only"
			/>
			{label}
		</label>
	);
}

function SortToggle({
	sort,
	onChange,
}: {
	sort: CodexSort;
	onChange: (value: CodexSort) => void;
}) {
	return (
		<fieldset className="mt-4">
			<legend className="sr-only">Sort</legend>
			<div className="flex border-b border-zinc-200 dark:border-zinc-800">
				<SortOption
					value="name"
					checked={sort === "name"}
					label="Name"
					onChange={onChange}
				/>
				<SortOption
					value="port"
					checked={sort === "port"}
					label="Port"
					onChange={onChange}
				/>
			</div>
		</fieldset>
	);
}

function SeenCard({
	card,
	lastColumn,
}: {
	card: Extract<CodexCardData, { status: CodexState }>;
	lastColumn: boolean;
}) {
	const { entry, status, fresh } = card;
	return (
		<MissPopover
			entry={entry}
			placement="grid"
			lastColumn={lastColumn}
			trigger={(triggerProps) => (
				<button
					type="button"
					{...triggerProps}
					style={{ viewTransitionName: `codex-${entry.id}` }}
					className={`block w-full rounded-lg border border-l-4 border-zinc-200 bg-white p-3 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${STATE_ACCENT[status]} ${fresh ? "animate-pop" : ""}`}
				>
					<span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
						{entry.name}
					</span>{" "}
					<span className="block font-mono text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
						{entry.port}
					</span>{" "}
					<span className="inline-flex items-center rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
						{transportLabel(entry.transport)}
					</span>{" "}
					<span className={`text-xs font-semibold ${STATE_TEXT[status]}`}>
						{STATE_LABEL[status]}
					</span>
				</button>
			)}
		/>
	);
}

function UnseenCard({ id }: { id: string }) {
	return (
		<div
			role="img"
			aria-label="Unseen"
			style={{ viewTransitionName: `codex-${id}` }}
			className="flex h-full min-h-[5.5rem] items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
		>
			<span className="font-mono text-2xl font-bold text-zinc-300 dark:text-zinc-700">
				???
			</span>
		</div>
	);
}

// The Codex needs only the catalog, so it does not wait for the current
// Dailies. The inner component keeps its mount effect, which writes the stored
// Codex, until the catalog is ready.
export function CodexPage() {
	const { catalog } = useServerData();
	if (catalog.status !== "ready") {
		return (
			<main className="mx-auto w-full max-w-3xl px-4 pb-6">
				<h1 className="text-2xl font-bold tracking-tight">Codex</h1>
				<LoadStatus state={catalog.status} />
			</main>
		);
	}
	return (
		<CodexScreen
			protocols={catalog.value.protocols}
			applications={catalog.value.applications}
		/>
	);
}

function CodexScreen({
	protocols,
	applications,
}: {
	protocols: CatalogEntry[];
	applications: CatalogEntry[];
}) {
	const { persist } = useRouteContext({ from: "__root__" });
	const [map] = useState(() => persist.readCodex());
	const [sort, setSort] = useState<CodexSort>(() => persist.readCodexSort());
	const [saveWarning, setSaveWarning] = useState(false);
	const columnCount = useColumnCount();

	// Mount only: the visit is rendered from the map read above, with its
	// fresh flags intact. The stored Codex is read again at write time, so
	// entries merged in since the mount read are kept, and written back with
	// every flag cleared so the next visit finds none.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount, per the Codex visit rule.
	useEffect(() => {
		const result = persist.writeCodex(clearCodexFresh(persist.readCodex()));
		if (!result.ok) {
			setSaveWarning(true);
		}
	}, []);

	function handleSortChange(next: CodexSort) {
		const result = persist.writeCodexSort(next);
		if (!result.ok) {
			setSaveWarning(true);
		}
		runViewTransition(["reorder"], () => {
			setSort(next);
		});
	}

	const groups = codexGroups({ map, protocols, applications, sort });
	const counts = codexCounts({ map, protocols, applications });
	// Totals follow what the Codex shows: unseen retired entries are hidden.
	const kindTotal: Record<CatalogKind, number> = {
		protocol: 0,
		application: 0,
	};
	for (const group of groups) {
		kindTotal[group.kind] = group.cards.length;
	}
	const total = kindTotal.protocol + kindTotal.application;

	return (
		<main className="mx-auto w-full max-w-3xl px-4 pb-6">
			<h1 className="text-2xl font-bold tracking-tight">Codex</h1>
			<ProgressNotice show={saveWarning} />
			<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
				{`Seen ${counts.seen} / ${total} · Correct ${counts.correct}`}
			</p>
			<SortToggle sort={sort} onChange={handleSortChange} />
			<div className="mt-6 space-y-8">
				{groups.map((group) => {
					const headingId = `codex-${group.kind}-heading`;
					const headingText = `${KIND_LABEL[group.kind]} ${counts.byKind[group.kind].seen} / ${kindTotal[group.kind]}`;
					return (
						<section key={group.kind}>
							<h2
								id={headingId}
								className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
							>
								{headingText}
							</h2>
							<ul
								aria-labelledby={headingId}
								className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
							>
								{group.cards.map((card, index) => (
									<li key={card.entry.id} className="grid">
										{card.status === "unseen" ? (
											<UnseenCard id={card.entry.id} />
										) : (
											<SeenCard
												card={card}
												lastColumn={isLastColumn(index, columnCount)}
											/>
										)}
									</li>
								))}
							</ul>
						</section>
					);
				})}
			</div>
		</main>
	);
}
