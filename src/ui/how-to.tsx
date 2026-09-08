import { HowToRulesList } from "./how-to-copy";

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
			<HowToRulesList />
			<button type="button" onClick={onDismiss}>
				Got it
			</button>
		</div>
	);
}
