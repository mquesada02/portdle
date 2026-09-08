export const HOW_TO_RULES = [
	"Guess the port for the named service.",
	"Digit slots show how many digits.",
	"6 tries. A miss names the service if that port is in this catalog.",
	"Three Dailies: Mixed, Protocols, Applications.",
	"Blitz is a separate timed mode.",
] as const;

export function HowToRulesList() {
	return (
		<ul>
			{HOW_TO_RULES.map((rule) => (
				<li key={rule}>{rule}</li>
			))}
		</ul>
	);
}
