import type { BlitzMode, DailyCategory } from "../engine/types";

export const CATEGORIES: Array<{ value: DailyCategory; label: string }> = [
	{ value: "mixed", label: "Mixed" },
	{ value: "protocols", label: "Protocols" },
	{ value: "applications", label: "Applications" },
];
export const MODES: Array<{ value: BlitzMode; label: string }> = [
	{ value: "sprint", label: "Sprint (1m)" },
	{ value: "marathon", label: "Marathon (5m)" },
	{ value: "survival", label: "Survival" },
];

export function Pill({
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
