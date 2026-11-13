// Shared helpers for the browser specs. Everything reads the stack through the
// public REST API with the publishable key, or with the seeded test user's own
// session. No spec uses a database URL, the generator role, or a service key.

import {
	type Browser,
	type BrowserContext,
	errors,
	expect,
	type Page,
} from "@playwright/test";
import { authStorageKey } from "../scripts/e2e-env.ts";
import { waitForHydration } from "../scripts/wait-for-hydration.ts";
import type { DailyCategory as Category } from "../src/engine/types.ts";

// The fixed local password of the seeded users (supabase/seed.sql).
const TEST_PASSWORD = "portdle-local-test";
const FIRST_DAY = "2026-09-09";
const DAY_MS = 86_400_000;

// Each Playwright project has its own seeded test user, named after it.
function testEmail(projectName: string): string {
	return `test-${projectName.toLowerCase().replaceAll(" ", "-")}@portdle.local`;
}

export function stack(): { apiUrl: string; key: string } {
	const apiUrl = process.env.E2E_API_URL;
	const key = process.env.E2E_PUBLISHABLE_KEY;
	if (!apiUrl || !key) {
		throw new Error("Run the suite with `pnpm test:e2e`.");
	}
	return { apiUrl, key };
}

async function rest<T>(
	path: string,
	token?: string,
	init?: RequestInit,
): Promise<T> {
	const { apiUrl, key } = stack();
	const response = await fetch(`${apiUrl}/rest/v1/${path}`, {
		...init,
		headers: {
			apikey: key,
			...(token && { Authorization: `Bearer ${token}` }),
			...init?.headers,
		},
	});
	if (!response.ok) {
		throw new Error(`${path} answered ${response.status}`);
	}
	return (await response.json()) as T;
}

// The server's date, from the current Dailies read; never the device clock.
export async function serverToday(): Promise<string> {
	const [first] = await rest<{ utc_date: string }[]>(
		"rpc/current_dailies",
		undefined,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		},
	);
	if (!first) {
		throw new Error("The current Dailies read answered no row.");
	}
	return first.utc_date;
}

function dayMs(day: string): number {
	return Date.parse(`${day}T00:00:00Z`);
}

export function dayBefore(day: string): string {
	return new Date(dayMs(day) - DAY_MS).toISOString().slice(0, 10);
}

// The public puzzle number, worked out here and not imported from the app.
export function puzzleNumberFor(day: string): number {
	return Math.round((dayMs(day) - dayMs(FIRST_DAY)) / DAY_MS) + 1;
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

// Only a wait that ran out is expected; any other failure is real.
function ignoreTimeout(error: unknown): void {
	if (!(error instanceof errors.TimeoutError)) {
		throw error;
	}
}

// The how-to dialog opens on every device that has not stored `howToSeen`,
// in an effect after the first render, and covers the board. Press "Got it"
// when it shows; a page that does not show it (a reload after a dismissal)
// passes after the short wait.
export async function dismissHowTo(page: Page): Promise<void> {
	// A click on a prerendered button before the bundle has hydrated the page is
	// lost, and the dialog (when it shows) opens after hydration.
	await waitForHydration(page);
	const gotIt = page.getByRole("button", { name: "Got it" });
	await gotIt
		.waitFor({ state: "visible", timeout: 5_000 })
		.then(() => gotIt.click(), ignoreTimeout);
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

// Signs the project's seeded test user in through the local auth API.
export async function signIn(projectName: string): Promise<SignedIn> {
	const { apiUrl, key } = stack();
	const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
		method: "POST",
		headers: { apikey: key, "Content-Type": "application/json" },
		body: JSON.stringify({
			email: testEmail(projectName),
			password: TEST_PASSWORD,
		}),
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

// The device's saved record of one Daily appears in local storage (the key
// copies src/persist/storage.ts; a drift only slows the wait to its timeout)
// once the sign-in pull has applied the account's rows. A first run on a
// fresh stack pulls nothing, so the wait ends on its timeout.
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
		.catch(ignoreTimeout);
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
	await waitForHydration(page);
	// The first dismissal stored `howToSeen`, so the dialog stays shut.
	await expect(page.getByRole("dialog")).toBeHidden();
	const solved = page.getByText("Solved", { exact: true });
	const firstSlot = page.getByLabel(/^Digit 1 of \d+$/);
	await expect(solved.or(firstSlot)).toBeVisible();
	if (await firstSlot.isVisible()) {
		await submitAnswer(page, port);
	}
	await expect(solved).toBeVisible();
}

// Runs a spec body on a page of a fresh context that holds the project's test
// user's sign-in, and always closes the context.
export async function withSignedInPage(
	browser: Browser,
	projectName: string,
	run: (page: Page, session: SignedIn) => Promise<void>,
): Promise<void> {
	const session = await signIn(projectName);
	const context = await browser.newContext();
	try {
		await session.storeIn(context);
		await run(await context.newPage(), session);
	} finally {
		await context.close();
	}
}
