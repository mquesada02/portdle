import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	base: "/portdle/",
	plugins: [react(), tailwindcss()],
	test: {
		environment: "jsdom",
		globals: false,
		// The Playwright specs in e2e/ run under `pnpm test:e2e`, and the ones in
		// gate/ under `pnpm gate`, not Vitest.
		exclude: [...configDefaults.exclude, "e2e/**", "gate/**"],
		setupFiles: ["./src/test/setup.ts"],
		// A loaded machine must not time out a test: the tests wait on nothing
		// real, so these limits measure machine load.
		testTimeout: 30_000,
		hookTimeout: 30_000,
	},
});
