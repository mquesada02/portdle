// The gate's `test`: every test gets the stub backend, the fixed clock, a
// seeded random source, and the stored How-to flag and theme, and fails when a
// request had no stub. A test file can also sign the page in (`account`).
//
// Clock (checked with Playwright 1.63, Chromium, 2026-10-05): after
// `clock.install`, the page's `setTimeout`, `setInterval`,
// `requestAnimationFrame`, `requestIdleCallback`, `performance.now`, and `Date`
// are fakes. `MessageChannel` and CSS animations are not. Time still flows at
// the real rate. After `pauseAt`, page timers and `requestAnimationFrame` never
// fire, so a test that pauses the clock must not poll in the page. freeze.ts
// polls from the test process.

import { test as base, expect, type TestInfo } from "@playwright/test";
import { authStorageKey } from "../scripts/e2e-env.ts";
import { waitForHydration } from "../scripts/wait-for-hydration.ts";
import {
	type AccountOption,
	accountFor,
	STUB_URL,
	stubBackend,
} from "./stub.ts";

export { expect };

// True in the projects that run with reduced motion.
export function isReduced(testInfo: TestInfo): boolean {
	return testInfo.project.use.reducedMotion === "reduce";
}

// The fixed moment of every test: the server time of the current Dailies.
const FIXED_TIME = new Date("2026-10-10T12:00:00Z");

// Runs in the page before any script: a seeded `Math.random`, the stored
// How-to flag (so no dialog covers the Daily), and the stored theme.
function initScript(theme: string) {
	let seed = 42;
	Math.random = () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};
	localStorage.setItem("portdle:v1:howToSeen", "true");
	localStorage.setItem("portdle:v1:theme", JSON.stringify(theme));
}

// The fixed sign-in: a session that expires in 2100, so the Supabase library
// never refreshes it. The access token only has to look like a JWT.
const SESSION_EXPIRY = 4102444800;

function base64url(value: object): string {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sessionOf(accountId: string) {
	const claims = { sub: accountId, role: "authenticated", exp: SESSION_EXPIRY };
	return {
		access_token: `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(claims)}.stub`,
		refresh_token: "stub-refresh-token",
		token_type: "bearer",
		expires_in: 3600,
		expires_at: SESSION_EXPIRY,
		user: {
			id: accountId,
			aud: "authenticated",
			role: "authenticated",
			email: "player@stub.test",
			app_metadata: {},
			user_metadata: {},
			created_at: "2026-10-01T00:00:00Z",
		},
	};
}

// Runs in the page before any script, so the app finds the sign-in at load.
// The app stores it under a key derived from the backend host.
function signInScript(stored: { key: string; session: object }) {
	localStorage.setItem(stored.key, JSON.stringify(stored.session));
}

// `account` is set per file with `test.use({ account: "confirmed" })`; null
// leaves the test signed out.
export const test = base.extend<{ account: AccountOption | null }>({
	account: [null, { option: true }],
	page: async ({ page, baseURL, colorScheme, account }, use) => {
		if (!baseURL) {
			throw new Error("The gate configuration sets no baseURL.");
		}
		const signedIn = account ? accountFor(account) : undefined;
		const unstubbed = await stubBackend(
			page.context(),
			new URL(baseURL).origin,
			signedIn,
		);
		// The browser's own `requestAnimationFrame`, saved before the clock fakes
		// it. Register it before the clock install, or it saves the fake. freeze.ts
		// syncs frames with it when a test pauses the clock.
		await page.addInitScript(() => {
			(window as unknown as Record<string, unknown>).nativeRaf =
				window.requestAnimationFrame.bind(window);
		});
		await page.clock.install({ time: FIXED_TIME });
		await page.addInitScript(initScript, colorScheme ?? "light");
		if (signedIn) {
			await page.addInitScript(signInScript, {
				key: authStorageKey(STUB_URL),
				session: sessionOf(signedIn.id),
			});
		}
		// The bundle loads after the `load` event, so a click right after a load
		// would hit a prerendered button with no handler. Every load in the gate
		// returns once the app has hydrated.
		const goto = page.goto.bind(page);
		page.goto = async (url, options) => {
			const response = await goto(url, options);
			if (options?.waitUntil !== "commit") {
				await waitForHydration(page);
			}
			return response;
		};
		const reload = page.reload.bind(page);
		page.reload = async (options) => {
			const response = await reload(options);
			if (options?.waitUntil !== "commit") {
				await waitForHydration(page);
			}
			return response;
		};
		await use(page);
		expect(unstubbed, "requests with no stub").toEqual([]);
	},
});
