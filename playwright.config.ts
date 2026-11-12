import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// Five workers, one per project: each project signs in as its own test user
// (supabase/seed.sql), so the projects share one database but no rows.
// `scripts/e2e.ts` builds dist-e2e against the local stack first.
export default defineConfig({
	testDir: "e2e",
	workers: 5,
	retries: 0,
	forbidOnly: !!process.env.CI,
	timeout: 60_000,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: "retain-on-failure",
	},
	// A project's name picks its test user (e2e/helpers.ts).
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
		{ name: "webkit", use: { ...devices["Desktop Safari"] } },
		{ name: "Pixel 7", use: { ...devices["Pixel 7"] } },
		{ name: "iPhone 14", use: { ...devices["iPhone 14"] } },
	],
	webServer: {
		command: `tsx scripts/pages-server.ts --dir dist-e2e --port ${PORT}`,
		url: `http://127.0.0.1:${PORT}/portdle/`,
	},
});
