// Reads the values `supabase status -o env` prints as KEY="value" lines.
function readValue(text: string, key: string): string {
	const match = text.match(new RegExp(`^${key}="(.*)"$`, "m"));
	if (!match) {
		throw new Error(`supabase status did not print ${key}`);
	}
	return match[1];
}

export type StackEnv = { apiUrl: string; publishableKey: string };

export function parseStackEnv(text: string): StackEnv {
	return {
		apiUrl: readValue(text, "API_URL"),
		publishableKey: readValue(text, "PUBLISHABLE_KEY"),
	};
}
