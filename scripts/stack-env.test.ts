import { expect, test } from "vitest";
import { parseStackEnv } from "./stack-env.ts";

test("reads the API URL and the publishable key from status -o env text", () => {
	const text = [
		'ANON_KEY="eyJhbGciOi"',
		'API_URL="http://127.0.0.1:54321"',
		'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
		'PUBLISHABLE_KEY="sb_publishable_abc"',
	].join("\n");
	expect(parseStackEnv(text)).toEqual({
		apiUrl: "http://127.0.0.1:54321",
		publishableKey: "sb_publishable_abc",
	});
});

test("throws when a value is missing, naming it", () => {
	expect(() => parseStackEnv('API_URL="http://127.0.0.1:54321"')).toThrow(
		"PUBLISHABLE_KEY",
	);
	expect(() => parseStackEnv('PUBLISHABLE_KEY="k"')).toThrow("API_URL");
});
