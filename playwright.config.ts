import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// One worker, no parallel specs: one shared test account and one database.
// `scripts/e2e.ts` builds dist-e2e against the local stack first.
export default defineConfig({
	testDir: "e2e",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	forbidOnly: !!process.env.CI,
	timeout: 60_000,
	reporter: [["list"]],
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: "off",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: `vite preview --outDir dist-e2e --host 127.0.0.1 --port ${PORT} --strictPort`,
		url: `http://127.0.0.1:${PORT}/portdle/`,
		reuseExistingServer: false,
	},
});
