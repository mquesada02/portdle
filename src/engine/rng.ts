export function hashSeed(input: string): number {
	let hash = 1779033703 ^ input.length;
	for (let index = 0; index < input.length; index += 1) {
		hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
		hash = (hash << 13) | (hash >>> 19);
	}
	return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let result = Math.imul(state ^ (state >>> 15), 1 | state);
		result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
		return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
	};
}
