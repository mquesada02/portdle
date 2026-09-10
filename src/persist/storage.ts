import type {
	BlitzBests,
	CategoryStats,
	DailyCategory,
	DailyPersist,
	Identified,
} from "../engine/types";

export type Theme = "system" | "light" | "dark";

export type KeyValueStore = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
};

const THEME_KEY = "portdle:v1:theme";
const HOW_TO_SEEN_KEY = "portdle:v1:howToSeen";
const LAST_SEEN_UTC_KEY = "portdle:v1:lastSeenUtc";
const BLITZ_BESTS_KEY = "portdle:v1:blitzBests";

function dailyKey(category: DailyCategory, date: string): string {
	return `portdle:v1:daily:${category}:${date}`;
}

function statsKey(category: DailyCategory): string {
	return `portdle:v1:stats:${category}`;
}

function lastPlayedKey(category: DailyCategory): string {
	return `portdle:v1:lastPlayed:${category}`;
}

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

function isUtcDate(value: unknown): value is string {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIdentified(value: unknown): value is Identified {
	if (value === null || typeof value !== "object") {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.id === "string" &&
		typeof record.name === "string" &&
		typeof record.port === "number"
	);
}

function isDailyPersist(value: unknown): value is DailyPersist {
	if (value === null || typeof value !== "object") {
		return false;
	}
	const record = value as Record<string, unknown>;
	if (
		record.status !== "playing" &&
		record.status !== "won" &&
		record.status !== "lost"
	) {
		return false;
	}
	if (!Array.isArray(record.guesses)) {
		return false;
	}
	return record.guesses.every((guess) => {
		if (guess === null || typeof guess !== "object") {
			return false;
		}
		const row = guess as Record<string, unknown>;
		return (
			typeof row.port === "number" &&
			(row.result === "correct" || row.result === "miss") &&
			(row.identified === null || isIdentified(row.identified))
		);
	});
}

function isBlitzBests(value: unknown): value is BlitzBests {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	return Object.entries(value).every(([key, score]) => {
		const parts = key.split("|");
		return (
			parts.length === 3 &&
			(parts[0] === "mixed" ||
				parts[0] === "protocols" ||
				parts[0] === "applications") &&
			(parts[1] === "default" || parts[1] === "inverted") &&
			(parts[2] === "sprint" ||
				parts[2] === "marathon" ||
				parts[2] === "survival") &&
			typeof score === "number"
		);
	});
}

function isCategoryStats(value: unknown): value is CategoryStats {
	if (value === null || typeof value !== "object") {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.currentStreak === "number" &&
		typeof record.bestStreak === "number" &&
		typeof record.played === "number" &&
		typeof record.wins === "number" &&
		Array.isArray(record.histogram) &&
		record.histogram.length === 6 &&
		record.histogram.every((n) => typeof n === "number")
	);
}

export type Persist = {
	readTheme(): Theme;
	writeTheme(value: Theme): { ok: true } | { ok: false };
	readHowToSeen(): boolean;
	writeHowToSeen(): { ok: true } | { ok: false };
	readDaily(category: DailyCategory, date: string): DailyPersist | null;
	writeDaily(
		category: DailyCategory,
		date: string,
		value: DailyPersist,
	): { ok: true } | { ok: false };
	readStats(category: DailyCategory): CategoryStats | null;
	writeStats(
		category: DailyCategory,
		value: CategoryStats,
	): { ok: true } | { ok: false };
	readLastPlayed(category: DailyCategory): string | null;
	writeLastPlayed(
		category: DailyCategory,
		date: string,
	): { ok: true } | { ok: false };
	readLastSeenUtc(): string | null;
	writeLastSeenUtc(date: string): { ok: true } | { ok: false };
	readBlitzBests(): BlitzBests;
	writeBlitzBests(value: BlitzBests): { ok: true } | { ok: false };
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
		readDaily(category, date) {
			const value = readJson(store, dailyKey(category, date));
			return isDailyPersist(value) ? value : null;
		},
		writeDaily(category, date, value) {
			return writeJson(store, dailyKey(category, date), value);
		},
		readStats(category) {
			const value = readJson(store, statsKey(category));
			return isCategoryStats(value) ? value : null;
		},
		writeStats(category, value) {
			return writeJson(store, statsKey(category), value);
		},
		readLastPlayed(category) {
			const value = readJson(store, lastPlayedKey(category));
			return isUtcDate(value) ? value : null;
		},
		writeLastPlayed(category, date) {
			return writeJson(store, lastPlayedKey(category), date);
		},
		readLastSeenUtc() {
			const value = readJson(store, LAST_SEEN_UTC_KEY);
			return isUtcDate(value) ? value : null;
		},
		writeLastSeenUtc(date) {
			return writeJson(store, LAST_SEEN_UTC_KEY, date);
		},
		readBlitzBests() {
			const value = readJson(store, BLITZ_BESTS_KEY);
			return isBlitzBests(value) ? value : {};
		},
		writeBlitzBests(value) {
			return writeJson(store, BLITZ_BESTS_KEY, value);
		},
	};
}
