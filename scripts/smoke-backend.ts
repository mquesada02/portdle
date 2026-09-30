// Hand-run check of the real Supabase project (Spec 4). It cannot run an OAuth
// sign-in, so it takes a signed-in browser's access token.
//
// The row sync checks write clearly tagged fake rows in the signed-in account.
// The players' tables grant no delete, so the script cannot remove them: run
// supabase/tests/row-sync-cleanup.sql afterwards. Every tagged row scores zero,
// which creates no leaderboard row, so none can rank before that cleanup.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_ACCESS_TOKEN=... pnpm smoke:backend
//
// Copy the token from the browser's localStorage after signing in on the
// deployed site (key `sb-<project>-auth-token`, field `access_token`). It
// expires in about an hour, so copy it fresh.

import { validateDisplayName } from "../src/engine/display-name.ts";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !anonKey || !token) {
	console.error(
		"Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_ACCESS_TOKEN.",
	);
	process.exit(2);
}

type Reply = { status: number; body: unknown; code: string | null };

async function rest(
	method: string,
	path: string,
	options: { token?: string; body?: unknown; prefer?: string } = {},
): Promise<Reply> {
	const headers: Record<string, string> = {
		apikey: anonKey as string,
		"Content-Type": "application/json",
	};
	if (options.token) {
		headers.Authorization = `Bearer ${options.token}`;
	}
	if (options.prefer) {
		headers.Prefer = options.prefer;
	}
	const response = await fetch(`${url}/rest/v1/${path}`, {
		method,
		headers,
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
	});
	const text = await response.text();
	let body: unknown = null;
	try {
		body = text === "" ? null : JSON.parse(text);
	} catch {
		body = text;
	}
	const code =
		body && typeof body === "object" && "code" in body
			? String((body as { code: unknown }).code)
			: null;
	return { status: response.status, body, code };
}

let failed = 0;
function report(name: string, ok: boolean, detail: unknown = "") {
	if (!ok) {
		failed += 1;
	}
	console.log(
		`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` ${JSON.stringify(detail)}`}`,
	);
}

// Refused means a grant failure (401 or 403, code 42501) or a CHECK failure
// (400, code 23514). Any other status is a failure of the check itself.
function refusedByGrant(r: Reply): boolean {
	return (r.status === 401 || r.status === 403) && r.code === "42501";
}
function refusedByCheck(r: Reply): boolean {
	return r.status === 400 && r.code === "23514";
}

const randomId = crypto.randomUUID();

const anon = await rest("GET", "accounts?select=id");
report(
	"anonymous cannot read accounts",
	refusedByGrant(anon) ||
		(anon.status === 200 && Array.isArray(anon.body) && anon.body.length === 0),
	anon,
);

const mine = await rest(
	"GET",
	"accounts?select=id,display_name,name_confirmed",
	{
		token,
	},
);
const rows = Array.isArray(mine.body)
	? (mine.body as Record<string, unknown>[])
	: [];
const row = rows[0];
report(
	"signed-in read returns exactly the own account row",
	mine.status === 200 && rows.length === 1 && row !== undefined,
	mine,
);
if (!row) {
	console.log("Cannot continue without the own account row (expired token?).");
	process.exit(1);
}
const id = String(row.id);
const original = String(row.display_name);
console.log(
	`Seeded display name: "${original}" (compare with your provider name)`,
);
report(
	"display name follows the rule and the confirmed flag is a boolean",
	validateDisplayName(original) === null &&
		typeof row.name_confirmed === "boolean",
	row,
);

function patch(name: string): Promise<Reply> {
	return rest("PATCH", `accounts?id=eq.${id}`, {
		token,
		body: { display_name: name },
		prefer: "return=representation",
	});
}

try {
	for (const [label, name] of [
		["an emoji name", "Ada 😀"],
		["a 31-character name", "a".repeat(31)],
		["a spaces-only name", "   "],
	] as const) {
		const reply = await patch(name);
		report(`update to ${label} is refused`, refusedByCheck(reply), reply);
	}
	const valid = "Zoë-李 O'Neil.";
	const updated = await patch(valid);
	const updatedRows = Array.isArray(updated.body) ? updated.body : [];
	report(
		"update to a valid non-ASCII name succeeds and reads back",
		updated.status === 200 &&
			(updatedRows[0] as { display_name?: string } | undefined)
				?.display_name === valid,
		updated,
	);
} finally {
	const restored = await patch(original);
	if (restored.status !== 200) {
		console.warn(
			`WARNING: could not restore the display name to "${original}".`,
			restored,
		);
	}
}

const originalConfirmed = row.name_confirmed === true;
try {
	const confirmed = await rest("PATCH", `accounts?id=eq.${id}`, {
		token,
		body: { name_confirmed: !originalConfirmed },
		prefer: "return=representation",
	});
	const confirmedRows = Array.isArray(confirmed.body) ? confirmed.body : [];
	report(
		"update of the confirmed flag succeeds and reads back",
		confirmed.status === 200 &&
			(confirmedRows[0] as { name_confirmed?: boolean } | undefined)
				?.name_confirmed === !originalConfirmed,
		confirmed,
	);
} finally {
	const restored = await rest("PATCH", `accounts?id=eq.${id}`, {
		token,
		body: { name_confirmed: originalConfirmed },
	});
	if (restored.status >= 300) {
		console.warn(
			`WARNING: could not restore the confirmed flag to ${originalConfirmed}.`,
			restored,
		);
	}
}

const insert = await rest("POST", "accounts", {
	token,
	body: { id: randomId, display_name: "Intruder" },
});
report("insert of an account row is refused", refusedByGrant(insert), insert);

const other = await rest("PATCH", `accounts?id=eq.${randomId}`, {
	token,
	body: { display_name: "Intruder" },
	prefer: "return=representation",
});
report(
	"update of another account's row changes nothing",
	other.status === 200 && Array.isArray(other.body) && other.body.length === 0,
	other,
);

const changeId = await rest("PATCH", `accounts?id=eq.${id}`, {
	token,
	body: { id: randomId },
});
report("update of id is refused", refusedByGrant(changeId), changeId);

// Row sync tables (ticket #136). The tables grant no delete, so each check
// upserts one tagged row that row-sync-cleanup.sql removes: Codex entry
// "smoke-test", a run ended at 2000-01-01T00:00:00Z, a Daily dated 2000-01-01,
// and a Best with score 0 and time 1234.5 in a Best key the account has not
// used or tagged before. A rerun upserts the same rows. The category, orientation,
// and mode lists below mirror the check constraints of the tables.
async function checkSyncTable(options: {
	table: string;
	filter: string;
	valid: Record<string, unknown>;
	invalid: Record<string, unknown>;
	readBack: (row: Record<string, unknown>) => boolean;
}) {
	const { table, filter, valid, invalid, readBack } = options;
	const own = { account_id: id };
	const anonRead = await rest("GET", `${table}?select=account_id`);
	report(
		`anonymous cannot read ${table}`,
		refusedByGrant(anonRead) ||
			(anonRead.status === 200 &&
				Array.isArray(anonRead.body) &&
				anonRead.body.length === 0),
		anonRead,
	);
	const upsert = await rest("POST", `${table}`, {
		token,
		body: { ...own, ...valid },
		prefer: "resolution=merge-duplicates,return=representation",
	});
	report(`own upsert into ${table} succeeds`, upsert.status < 300, upsert);
	const back = await rest("GET", `${table}?${filter}&select=*`, { token });
	const row =
		Array.isArray(back.body) && back.body.length > 0
			? (back.body[0] as Record<string, unknown>)
			: null;
	report(`own row of ${table} reads back`, row !== null && readBack(row), back);
	const bad = await rest("POST", table, {
		token,
		body: { ...own, ...invalid },
	});
	report(`invalid row into ${table} is refused`, refusedByCheck(bad), bad);
	const foreign = await rest("POST", table, {
		token,
		body: { ...valid, account_id: randomId },
	});
	report(
		`row of another account into ${table} is refused`,
		refusedByGrant(foreign),
		foreign,
	);
	const removal = await rest("DELETE", `${table}?${filter}`, { token });
	report(`delete from ${table} is refused`, refusedByGrant(removal), removal);
}

await checkSyncTable({
	table: "codex_entries",
	filter: "entry_id=eq.smoke-test",
	valid: { entry_id: "smoke-test", state: "identified" },
	invalid: { entry_id: "smoke-test", state: "wrong" },
	readBack: (row) => row.state === "identified",
});

const usedBests = await rest(
	"GET",
	"blitz_bests?select=category,orientation,mode",
	{
		token,
	},
);
const used = new Set(
	(Array.isArray(usedBests.body)
		? (usedBests.body as Record<string, string | number>[])
		: []
	)
		// A tagged row from an earlier run is free to write again.
		.filter((best) => !(best.score === 0 && best.time_to_score_ms === 1234.5))
		.map((best) => `${best.category}|${best.orientation}|${best.mode}`),
);
const freeBest = ["mixed", "protocols", "applications"]
	.flatMap((category) =>
		["default", "inverted"].flatMap((orientation) =>
			["sprint", "marathon", "survival"].map(
				(mode) => ({ category, orientation, mode }) as const,
			),
		),
	)
	.find(
		({ category, orientation, mode }) =>
			!used.has(`${category}|${orientation}|${mode}`),
	);
if (usedBests.status !== 200) {
	report("read of the own Bests succeeds", false, usedBests);
} else if (freeBest) {
	const key = `category=eq.${freeBest.category}&orientation=eq.${freeBest.orientation}&mode=eq.${freeBest.mode}`;
	await checkSyncTable({
		table: "blitz_bests",
		filter: key,
		valid: { ...freeBest, score: 0, time_to_score_ms: 1234.5 },
		invalid: { ...freeBest, score: -1 },
		readBack: (row) => row.score === 0 && row.time_to_score_ms === 1234.5,
	});
} else {
	console.log(
		"SKIP blitz_bests checks: every Best key has a real row, so a tagged row cannot be written safely.",
	);
}

await checkSyncTable({
	table: "blitz_runs",
	filter: "ended_at=eq.2000-01-01T00:00:00Z",
	valid: {
		ended_at: "2000-01-01T00:00:00.000Z",
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		ended: "lives",
		score: 0,
		time_to_score_ms: 0,
		rounds: [],
	},
	invalid: {
		ended_at: "2000-01-01T00:00:00.000Z",
		category: "mixed",
		orientation: "default",
		mode: "sprint",
		ended: "quit",
		score: 0,
		rounds: [],
	},
	readBack: (row) => row.score === 0 && Array.isArray(row.rounds),
});
await checkSyncTable({
	table: "dailies",
	filter: "category=eq.mixed&day=eq.2000-01-01",
	valid: {
		category: "mixed",
		day: "2000-01-01",
		status: "playing",
		guesses: [],
	},
	invalid: {
		category: "mixed",
		day: "2000-01-01",
		status: "quit",
		guesses: [],
	},
	readBack: (row) => row.status === "playing" && Array.isArray(row.guesses),
});

console.log(failed === 0 ? "All checks passed." : `${failed} check(s) failed.`);
console.log(
	"Now close every Portdle tab signed in as you, then run supabase/tests/row-sync-cleanup.sql in the SQL editor to remove the tagged rows. (An open tab pulls them and can push them back.)",
);
process.exit(failed === 0 ? 0 : 1);
