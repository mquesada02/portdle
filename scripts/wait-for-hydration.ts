import { expect, type Page } from "@playwright/test";
import { HYDRATED_ATTRIBUTE } from "../src/hydrated-attribute.ts";
import { NO_HYDRATION_WAIT } from "./gate-build.ts";

// Resolves once the app has hydrated the page (see src/hydrated-attribute.ts).
// The bundle loads after the page's `load` event, so a click right after
// `page.goto` can land on a prerendered button that has no handler yet. Call
// this on any page that runs the app; privacy.html does not, and never sets
// the attribute. It polls from the test process, so it works while a gate test
// has paused the page clock.
export async function waitForHydration(page: Page): Promise<void> {
	// gate.ts sets this when it runs the tests on a site from before the signal.
	if (process.env[NO_HYDRATION_WAIT]) {
		return;
	}
	await expect(page.locator("html")).toHaveAttribute(
		HYDRATED_ATTRIBUTE,
		"true",
		{
			timeout: 15_000,
		},
	);
}
