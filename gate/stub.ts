// The stub host: Playwright answers every request to it from the committed
// fixtures (the answers are in answers.ts, which the Lighthouse guard's stub
// server shares). A request with no stub is aborted and recorded, and the
// fixture in fixtures.ts fails the test on it. Requests to the server's own
// origin (the page, scripts, and styles of the stub build) go through.

import type { BrowserContext } from "@playwright/test";
import { type AccountRow, answer, CORS } from "./answers.ts";

export { type AccountOption, accountFor } from "./answers.ts";

// The host that scripts/gate.ts builds into the site.
export const STUB_URL = "http://stub.test";
export const STUB_KEY = "stub-anon-key";

// Installs the stub on a context. A signed-in test also passes its account.
// Returns the list that collects every request that had no stub.
export async function stubBackend(
	context: BrowserContext,
	previewOrigin: string,
	account?: AccountRow,
): Promise<string[]> {
	const unstubbed: string[] = [];
	await context.route("**/*", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (url.origin === previewOrigin) {
			return route.continue();
		}
		if (url.origin === STUB_URL) {
			if (request.method() === "OPTIONS") {
				return route.fulfill({ status: 204, headers: CORS });
			}
			const reply = answer(url, request.method(), account);
			if (reply) {
				return route.fulfill({
					status: reply.status,
					contentType: "application/json",
					headers: CORS,
					body:
						reply.body === undefined ? undefined : JSON.stringify(reply.body),
				});
			}
		}
		unstubbed.push(`${request.method()} ${request.url()}`);
		return route.abort();
	});
	return unstubbed;
}
