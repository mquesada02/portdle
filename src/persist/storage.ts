export type Theme = "system" | "light" | "dark";

export type KeyValueStore = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
};

const THEME_KEY = "portdle:v1:theme";
const HOW_TO_SEEN_KEY = "portdle:v1:howToSeen";

function readJson(store: KeyValueStore, key: string): unknown {
	const raw = store.getItem(key);
	if (raw === null) {
		return undefined;
	}
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return undefined;
	}
}

function writeJson(
	store: KeyValueStore,
	key: string,
	value: unknown,
): { ok: true } | { ok: false } {
	try {
		store.setItem(key, JSON.stringify(value));
		return { ok: true };
	} catch {
		return { ok: false };
	}
}

function isTheme(value: unknown): value is Theme {
	return value === "system" || value === "light" || value === "dark";
}

export type Persist = {
	readTheme(): Theme;
	writeTheme(value: Theme): { ok: true } | { ok: false };
	readHowToSeen(): boolean;
	writeHowToSeen(): { ok: true } | { ok: false };
};

export function createPersist(store: KeyValueStore): Persist {
	return {
		readTheme(): Theme {
			const value = readJson(store, THEME_KEY);
			return isTheme(value) ? value : "system";
		},
		writeTheme(value: Theme) {
			return writeJson(store, THEME_KEY, value);
		},
		readHowToSeen(): boolean {
			return readJson(store, HOW_TO_SEEN_KEY) === true;
		},
		writeHowToSeen() {
			return writeJson(store, HOW_TO_SEEN_KEY, true);
		},
	};
}
