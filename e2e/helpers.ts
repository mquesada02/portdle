// Shared helpers for the browser specs. Everything reads the stack through the
// public REST API with the publishable key, or with the seeded test user's own
// session. No spec uses a database URL, the generator role, or a service key.

import { type BrowserContext, expect, type Page } from "@playwright/test";
import { authStorageKey } from "../scripts/e2e-env.ts";

export type Category = "mixed" | "protocols" | "applications";

const TEST_EMAIL = "test@portdle.local";
// The fixed local password of the seeded user (supabase/seed.sql).
const TEST_PASSWORD = "portdle-local-test";
const FIRST_DAY = "2026-09-09";
const DAY_MS = 86_400_000;

function stack(): { apiUrl: string; key: string } {
	const apiUrl = process.env.E2E_API_URL;
	const key = process.env.E2E_PUBLISHABLE_KEY;
	if (!apiUrl || !key) {
		throw new Error("Run the suite with `pnpm test:e2e`.");
	}
	return { apiUrl, key };
}

async function rest<T>(path: string, token?: string): Promise<T> {
	const { apiUrl, key } = stack();
	const response = await fetch(`${apiUrl}/rest/v1/${path}`, {
		headers: {
			apikey: key,
			...(token && { Authorization: `Bearer ${token}` }),
		},
	});
	if (!response.ok) {
		throw new Error(`${path} answered ${response.status}`);
	}
	return (await response.json()) as T;
}

export function apiUrl(): string {
	return stack().apiUrl;
}

// The server's date, from the current Dailies read; never the device clock.
export async function serverToday(): Promise<string> {
	const { apiUrl, key } = stack();
	const response = await fetch(`${apiUrl}/rest/v1/rpc/current_dailies`, {
		method: "POST",
		headers: { apikey: key, "Content-Type": "application/json" },
		body: "{}",
	});
	const [first] = (await response.json()) as { utc_date: string }[];
	if (!first) {
		throw new Error("The current Dailies read answered no row.");
	}
	return first.utc_date;
}

export function dayBefore(day: string): string {
	return new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS)
		.toISOString()
		.slice(0, 10);
}

// The public puzzle number, worked out here and not imported from the app.
export function puzzleNumberFor(day: string): number {
	return (
		Math.round(
			(Date.parse(`${day}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`)) /
				DAY_MS,
		) + 1
	);
}

// The answer of one Daily, from the Schedule row and the catalog entry.
export async function answerFor(
	category: Category,
	day: string,
): Promise<{ name: string; port: number }> {
	const [row] = await rest<{ entry_id: string }[]>(
		`schedule?select=entry_id&category=eq.${category}&day=eq.${day}`,
	);
	if (!row) {
		throw new Error(`No Schedule row for ${category} on ${day}.`);
	}
	const [entry] = await rest<{ name: string; port: number }[]>(
		`catalog_entries?select=name,port&id=eq.${row.entry_id}`,
	);
	if (!entry) {
		throw new Error(`No catalog entry ${row.entry_id}.`);
	}
	return entry;
}

// The how-to dialog opens on every device that has not stored `howToSeen`,
// in an effect after the first render, and covers the board. Press "Got it"
// when it shows; a page that does not show it (a reload after a dismissal)
// passes after the short wait.
export async function dismissHowTo(page: Page): Promise<void> {
	const gotIt = page.getByRole("button", { name: "Got it" });
	await gotIt
		.waitFor({ state: "visible", timeout: 5_000 })
		.then(() => gotIt.click())
		.catch(() => undefined);
	await expect(page.getByRole("dialog")).toBeHidden();
}

// Types the answer into the board's digit slots and submits it.
export async function submitAnswer(page: Page, port: number): Promise<void> {
	const digits = String(port);
	await page.getByLabel(`Digit 1 of ${digits.length}`).click();
	await page.keyboard.type(digits);
	await page.getByRole("button", { name: "Submit" }).click();
}

export type SignedIn = {
	accessToken: string;
	// Stores the sign-in on the device before the app loads, as a device with
	// a stored sign-in; only when the device holds none yet.
	storeIn: (context: BrowserContext) => Promise<void>;
};

// Signs the seeded test user in through the local auth API.
export async function signIn(): Promise<SignedIn> {
	const { apiUrl, key } = stack();
	const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
		method: "POST",
		headers: { apikey: key, "Content-Type": "application/json" },
		body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
	});
	if (!response.ok) {
		throw new Error(`Sign-in answered ${response.status}`);
	}
	const session = (await response.json()) as { access_token: string };
	const storageKey = authStorageKey(apiUrl);
	const value = JSON.stringify(session);
	return {
		accessToken: session.access_token,
		storeIn: async (context) => {
			await context.addInitScript(
				({ k, v }) => {
					if (localStorage.getItem(k) === null) {
						localStorage.setItem(k, v);
					}
				},
				{ k: storageKey, v: value },
			);
		},
	};
}

// The device's saved record of one Daily appears in local storage once the
// sign-in pull has applied the account's rows. A first run on a fresh stack
// pulls nothing, so the wait ends on its timeout.
export async function waitForPulledDaily(
	page: Page,
	category: Category,
	day: string,
): Promise<void> {
	await page
		.waitForFunction(
			(k) => localStorage.getItem(k) !== null,
			`portdle:v1:daily:${category}:${day}`,
			{ timeout: 10_000 },
		)
		.catch(() => undefined);
}

// The account's stored row of one Daily, read with the user's own session.
export async function storedDaily(
	accessToken: string,
	category: Category,
	day: string,
): Promise<{ status: string; late: boolean | null } | undefined> {
	const [row] = await rest<{ status: string; late: boolean | null }[]>(
		`dailies?select=status,late&category=eq.${category}&day=eq.${day}`,
		accessToken,
	);
	return row;
}

// Opens a Daily's board as a signed-in device and leaves it finished. The
// board reads the device's record once when it mounts and the sign-in pull
// lands after that, so the page waits for the pull and reloads before it looks
// at the board. A board already finished (a rerun) is not played again.
export async function openFinishedBoard(
	page: Page,
	path: string,
	category: Category,
	day: string,
	port: number,
): Promise<void> {
	await page.goto(path);
	await dismissHowTo(page);
	await waitForPulledDaily(page, category, day);
	await page.reload();
	await dismissHowTo(page);
	const solved = page.getByText("Solved", { exact: true });
	const firstSlot = page.getByLabel(/^Digit 1 of \d+$/);
	await expect(solved.or(firstSlot)).toBeVisible();
	if (await firstSlot.isVisible()) {
		await submitAnswer(page, port);
	}
	await expect(solved).toBeVisible();
}
