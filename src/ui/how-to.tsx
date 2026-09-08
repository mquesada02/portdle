import { HOW_TO_RULES } from "./how-to-copy";

export function HowTo({
	open,
	onDismiss,
}: {
	open: boolean;
	onDismiss: () => void;
}) {
	if (!open) {
		return null;
	}
	return (
		<div role="dialog" aria-labelledby="how-to-title" aria-modal="true">
			<h2 id="how-to-title">How-to</h2>
			<ul>
				{HOW_TO_RULES.map((rule) => (
					<li key={rule}>{rule}</li>
				))}
			</ul>
			<button type="button" onClick={onDismiss}>
				Got it
			</button>
		</div>
	);
}
