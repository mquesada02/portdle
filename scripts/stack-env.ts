// Reads the values `supabase status -o env` prints as KEY="value" lines.
function read(text: string, key: string): string {
	const match = text.match(new RegExp(`^${key}="(.*)"$`, "m"));
	if (!match) {
		throw new Error(`supabase status did not print ${key}`);
	}
	return match[1];
}

export function parseStackEnv(text: string): {
	apiUrl: string;
	publishableKey: string;
} {
	return {
		apiUrl: read(text, "API_URL"),
		publishableKey: read(text, "PUBLISHABLE_KEY"),
	};
}
