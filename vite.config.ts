import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	base: "/portdle/",
	plugins: [react(), tailwindcss()],
	test: {
		environment: "jsdom",
		globals: false,
		// The Playwright specs in e2e/ run under `pnpm test:e2e`, not Vitest.
		exclude: [...configDefaults.exclude, "e2e/**"],
		setupFiles: ["./src/test/setup.ts"],
	},
});
