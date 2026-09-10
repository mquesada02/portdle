import { HowToRulesList } from "./how-to-copy";

export function HelpPage() {
	return (
		<main>
			<h1 className="text-2xl font-bold">Help</h1>
			<div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
				<HowToRulesList />
			</div>
		</main>
	);
}
