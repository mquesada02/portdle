// Reads the values `supabase status -o env` prints as KEY="value" lines.
function readValue(text: string, key: string): string {
	const prefix = `${key}="`;
	const line = text.split("\n").find((l) => l.startsWith(prefix));
	if (!line?.endsWith('"')) {
		throw new Error(`supabase status did not print ${key}`);
	}
	return line.slice(prefix.length, -1);
}

export type StackEnv = {
	apiUrl: string;
	dbUrl: string;
	publishableKey: string;
};

export function parseStackEnv(text: string): StackEnv {
	return {
		apiUrl: readValue(text, "API_URL"),
		dbUrl: readValue(text, "DB_URL"),
		publishableKey: readValue(text, "PUBLISHABLE_KEY"),
	};
}
