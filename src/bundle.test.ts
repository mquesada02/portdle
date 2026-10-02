import { expect, test } from "vitest";

// Product code: every source file that is not a test or a test helper.
const product = import.meta.glob<string>(
	["./**/*.{ts,tsx}", "!./**/*.test.*", "!./test/**"],
	{ query: "?raw", import: "default", eager: true },
);

function filesMatching(pattern: RegExp): string[] {
	return Object.entries(product)
		.filter(([, source]) => pattern.test(source))
		.map(([path]) => path);
}

test("the glob sees product files", () => {
	expect(Object.keys(product)).toContain("./remote/supabase.ts");
});

test("no product file imports the catalog or Schedule files", () => {
	expect(filesMatching(/\bfrom\s+["'][^"']*catalogs\//)).toEqual([]);
});

test("the Supabase library is imported only as a type or lazily", () => {
	expect(
		filesMatching(/^import\s+(?!type\b)[^;]*["']@supabase\/supabase-js["']/m),
	).toEqual([]);
});
