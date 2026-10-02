import { createHmac } from "node:crypto";
import type { RandomFactory } from "../src/engine/schedule-gen.ts";

// Every shuffle of the generator is driven by HMAC-SHA256 keyed with the
// secret seed, so the code alone cannot compute a future order and revealed
// days do not give the rest of a cycle.
export function hmacRandom(secret: string): RandomFactory {
	if (secret.trim() === "") {
		throw new Error("The secret seed is empty");
	}
	return (seedKey) => {
		let counter = 0;
		return () => {
			const digest = createHmac("sha256", secret)
				.update(`${seedKey}:${counter}`)
				.digest();
			counter += 1;
			return digest.readUIntBE(0, 6) / 2 ** 48;
		};
	};
}
