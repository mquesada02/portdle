import { defineConfig, devices } from "@playwright/test";

const PORT = 4174;
const ORIGIN = `http://127.0.0.1:${PORT}`;

// The screenshot gate (gate/): its own configuration and web server, on the
// stub build that `pnpm gate` makes in dist-gate. The functional suite uses
// playwright.config.ts.
//
// One project per viewport, theme, and motion setting. The baseline is a
// folder of frames (gate-baseline/), never committed: CI captures it on master
// and a pull request compares with it. Compare is exact. A missing baseline
// fails every frame, and Playwright writes the frame to test-results/.
const VIEWPORTS = [
	{ width: 375, height: 812 },
	{ width: 1024, height: 768 },
];
const THEMES = ["light", "dark"] as const;
// One entry per engine; its name is the prefix of its project names. The
// Chromium flags give grayscale text on the whole page. With LCD text, a paused
// animation that moves between a composited layer and a normal paint changes
// its text edges, and the same frame differs between runs.
const ENGINES = [
	{
		name: "chromium",
		device: "Desktop Chrome",
		use: {
			launchOptions: {
				args: [
					"--disable-lcd-text",
					"--font-render-hinting=none",
					"--disable-threaded-animation",
				],
			},
		},
	},
	{ name: "webkit", device: "Desktop Safari", use: {} },
	{ name: "firefox", device: "Desktop Firefox", use: {} },
];

export default defineConfig({
	testDir: "gate",
	snapshotDir: "gate-baseline",
	snapshotPathTemplate: "{snapshotDir}/{testFilePath}/{arg}-{projectName}{ext}",
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: 0,
	timeout: 60_000,
	reporter: [
		["list"],
		["html", { open: "never", outputFolder: "gate-report" }],
		["json", { outputFile: "gate-results.json" }],
	],
	expect: {
		// "allow": the default ("disabled") would finish the paused animations.
		toHaveScreenshot: { animations: "allow", threshold: 0, maxDiffPixels: 0 },
	},
	use: {
		baseURL: ORIGIN,
		trace: "retain-on-failure",
	},
	projects: [false, true].flatMap((reduced) =>
		VIEWPORTS.flatMap((viewport) =>
			THEMES.flatMap((theme) =>
				ENGINES.map((engine) => ({
					name: `${engine.name}-${viewport.width}-${theme}${reduced ? "-reduced" : ""}`,
					use: {
						...devices[engine.device],
						...engine.use,
						viewport,
						colorScheme: theme,
						reducedMotion: reduced
							? ("reduce" as const)
							: ("no-preference" as const),
					},
				})),
			),
		),
	),
	webServer: {
		command: `tsx scripts/pages-server.ts --dir dist-gate --port ${PORT}`,
		url: `${ORIGIN}/portdle/`,
		reuseExistingServer: false,
	},
});
