import { expect, test } from "vitest";
import { hashSeed, mulberry32 } from "./rng";

test("hashSeed is deterministic", () => {
	expect(hashSeed("mixed:0:http,ssh")).toBe(hashSeed("mixed:0:http,ssh"));
});

test("mulberry32 is deterministic and in unit interval", () => {
	const a = mulberry32(1);
	const b = mulberry32(1);
	const first = a();
	expect(first).toBe(b());
	expect(first).toBeGreaterThanOrEqual(0);
	expect(first).toBeLessThan(1);
	expect(a()).not.toBe(first);
});
