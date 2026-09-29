// Hand-run check of the real Supabase project (Spec 4). It cannot run an OAuth
// sign-in, so it takes a signed-in browser's access token.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_ACCESS_TOKEN=... pnpm smoke:backend
//
// Copy the token from the browser's localStorage after signing in on the
// deployed site (key `sb-<project>-auth-token`, field `access_token`). It
// expires in about an hour, so copy it fresh.

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

// Approximates the database rule (`[[:alnum:]]`); they differ for combining marks.
const NAME_RULE = /^[\p{L}\p{N} '.-]{1,30}$/u;
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
	NAME_RULE.test(original) && typeof row.name_confirmed === "boolean",
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

console.log(failed === 0 ? "All checks passed." : `${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
