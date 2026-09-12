export const HOW_TO_RULES = [
	"Guess the port for the named service.",
	"Digit slots show how many digits.",
	"After each try, green means right digit in the right place, yellow means the digit is in the port elsewhere, gray means it is not in the port.",
	"6 tries. A miss names the service if that port is in this catalog.",
	"Three Dailies: Mixed, Protocols, Applications.",
	"Blitz is a separate timed mode.",
	"The Codex collects every service you meet.",
] as const;

export function HowToRulesList() {
	return (
		<ol className="list-decimal space-y-2 pl-5 text-sm">
			{HOW_TO_RULES.map((rule) => (
				<li key={rule}>{rule}</li>
			))}
		</ol>
	);
}
