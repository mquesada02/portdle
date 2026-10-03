// Two helpers for the end-to-end suite: the app's auth storage key, which the
// specs (e2e/) use, and the check that the local stack can serve a Daily,
// which the runner (scripts/e2e.ts) uses.

import { DAILY_CATEGORIES } from "../src/engine/types.ts";

export const STACK_MESSAGE =
	"The local stack does not answer the current Dailies read. Run `pnpm dev` (it starts the stack) and `pnpm dev:schedule` (it fills the Schedule), then run `pnpm test:e2e` again.";

// A copy of the key rule in src/remote/supabase.ts: `sb-`, the first label of
// the API host name, then `-auth-token`. A change there fails the signed-in
// specs.
export function authStorageKey(apiUrl: string): string {
	return `sb-${new URL(apiUrl).hostname.split(".")[0]}-auth-token`;
}

// Throws STACK_MESSAGE unless the stack's current Dailies read answers with an
// entry id for every Daily category.
export async function checkStack(
	apiUrl: string,
	publishableKey: string,
	fetchJson: typeof fetch = fetch,
): Promise<void> {
	let rows: unknown;
	try {
		const response = await fetchJson(`${apiUrl}/rest/v1/rpc/current_dailies`, {
			method: "POST",
			headers: {
				apikey: publishableKey,
				"Content-Type": "application/json",
			},
			body: "{}",
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) {
			throw new Error(`Status ${response.status}`);
		}
		rows = await response.json();
	} catch {
		throw new Error(STACK_MESSAGE);
	}
	const named = new Set(
		Array.isArray(rows)
			? rows.flatMap((row: { category?: string; entry_id?: string | null }) =>
					row.entry_id ? [row.category] : [],
				)
			: [],
	);
	if (!DAILY_CATEGORIES.every((category) => named.has(category))) {
		throw new Error(STACK_MESSAGE);
	}
}
