import { HOW_TO_RULES } from "./how-to-copy";

export function HelpPage() {
	return (
		<main>
			<h1>Help</h1>
			<ul>
				{HOW_TO_RULES.map((rule) => (
					<li key={rule}>{rule}</li>
				))}
			</ul>
		</main>
	);
}
