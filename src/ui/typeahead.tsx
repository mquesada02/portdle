import { useEffect, useId, useState } from "react";
import { buildSearchIndex, searchNames } from "../engine/search";
import type { CatalogEntry } from "../engine/types";

const DEBOUNCE_MS = 200;

export function Typeahead({
	catalog,
	onSubmit,
}: {
	catalog: CatalogEntry[];
	onSubmit: (id: string) => void;
}) {
	const listId = useId();
	const [index] = useState(() => buildSearchIndex(catalog));
	const [query, setQuery] = useState("");
	const [hits, setHits] = useState(() => searchNames(index, ""));
	const [highlight, setHighlight] = useState(-1);

	useEffect(() => {
		if (query.trim().length === 0) {
			setHits([]);
			setHighlight(-1);
			return;
		}
		const timer = window.setTimeout(() => {
			setHits(searchNames(index, query));
			setHighlight(-1);
		}, DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [index, query]);

	const active = highlight >= 0 ? hits[highlight] : undefined;

	function submitId(id: string) {
		onSubmit(id);
		setQuery("");
		setHits([]);
		setHighlight(-1);
	}

	return (
		<div>
			<input
				role="combobox"
				aria-label="Service name"
				aria-expanded={hits.length > 0}
				aria-controls={listId}
				aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
				autoComplete="off"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown") {
						event.preventDefault();
						if (hits.length === 0) {
							return;
						}
						setHighlight((current) =>
							current < hits.length - 1 ? current + 1 : 0,
						);
					} else if (event.key === "ArrowUp") {
						event.preventDefault();
						if (hits.length === 0) {
							return;
						}
						setHighlight((current) =>
							current <= 0 ? hits.length - 1 : current - 1,
						);
					} else if (event.key === "Enter") {
						event.preventDefault();
						if (active) {
							submitId(active.id);
						}
					}
				}}
			/>
			{hits.length === 0 ? (
				<p aria-live="polite">No matches.</p>
			) : (
				<div id={listId} role="listbox">
					{hits.map((hit, hitIndex) => (
						<button
							key={hit.id}
							id={`${listId}-${hit.id}`}
							type="button"
							role="option"
							tabIndex={-1}
							aria-selected={hitIndex === highlight}
							onClick={() => {
								submitId(hit.id);
							}}
						>
							{hit.name}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
