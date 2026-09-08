import type { KeyValueStore } from "../persist/storage";

export function memoryStore(
	data: Map<string, string> = new Map(),
): KeyValueStore & { data: Map<string, string> } {
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => {
			data.set(key, value);
		},
	};
}

export function stubMatchMedia(prefersDark = false) {
	window.matchMedia = (query: string) => ({
		matches: prefersDark && query.includes("prefers-color-scheme: dark"),
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	});
}
