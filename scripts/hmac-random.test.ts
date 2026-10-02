import { expect, test } from "vitest";
import { hmacRandom } from "./hmac-random.ts";

function draw(factory: ReturnType<typeof hmacRandom>, key: string, count = 5) {
	const next = factory(key);
	return Array.from({ length: count }, () => next());
}

test("the same secret and key give the same stream, in [0, 1)", () => {
	const first = draw(hmacRandom("secret"), "mixed:3");
	expect(draw(hmacRandom("secret"), "mixed:3")).toEqual(first);
	for (const value of first) {
		expect(value).toBeGreaterThanOrEqual(0);
		expect(value).toBeLessThan(1);
	}
});

test("another secret or another key gives another stream", () => {
	const base = draw(hmacRandom("secret"), "mixed:3");
	expect(draw(hmacRandom("other"), "mixed:3")).not.toEqual(base);
	expect(draw(hmacRandom("secret"), "mixed:4")).not.toEqual(base);
});

test("an empty or whitespace-only secret throws", () => {
	expect(() => hmacRandom("")).toThrow();
	expect(() => hmacRandom("  \t")).toThrow();
});
