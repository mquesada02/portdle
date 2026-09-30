# Research: serving and protecting daily answers

Resolves [issue #170](https://github.com/mquesada02/portdle/issues/170), child of the [Dailies from the backend map (#169)](https://github.com/mquesada02/portdle/issues/169).

## Question

1. How do Wordle (NYT), Angledle, and similar daily games deliver the day's puzzle, and what keeps future answers hidden?
2. On the Supabase free tier, with no Edge Functions and no servers of our own (Postgres, PostgREST, RPC, Auth, RLS only), what limits and abuse controls apply to anonymous (`anon` key) reads and writes?

Context: every visitor fetches the day's Daily (3 Daily categories per day) about once a day. Each finished Daily might post one anonymous result report for global stats.

This is **facts only**. No design is recommended here. Decisions belong to later grilling tickets on map #169.

Sources are primary: official docs, the Supabase docs source on GitHub, and live endpoints fetched directly. Observation date for all live probes: **2026-09-30 (UTC)**. Anything not verified is marked UNVERIFIED.

## Part 1: how other daily games serve the puzzle

### NYT Wordle: per-date JSON from the server, future dates allowed

Observed on 2026-09-30 with plain `curl`, no cookies, no auth:

- `GET https://www.nytimes.com/svc/wordle/v2/2026-09-30.json` returned `{"id":829,"solution":"river","print_date":"2026-09-30","days_since_launch":1929,"editor":"Tracy Bennett"}`.
- The same endpoint returned a full solution for future dates: `2026-10-05` (mocha), `2026-10-30` (slide), `2026-11-07` (prate). That is 38 days ahead.
- `2026-11-08` and later returned `{"status":"ERROR","errors":["Not Found"],"results":[]}`. So the server has a rolling horizon of about 38 days at the time of probing, not "today only".
- Dates before the game's launch (for example `2020-01-01`) also return Not Found.
- Response headers: `server: envoy`, `cache-control: no-store, max-age=0`, served through a CDN (Fastly, `x-served-by` and `x-cache` headers) with a short edge TTL (`age: 10` on the probe).

How the client uses it: the Wordle web bundle (`https://www.nytimes.com/games-assets/v2/wordle.da4524143a2f4f6c3d41.js`, fetched 2026-09-30) builds the URL as `<edge>/svc/wordle/v2/<yyyy-MM-dd>.json` from the client's `today` date and fetches it. The bundle is about 6 KB in the piece I inspected and contains no answer list. The client receives the plain `solution` word. So the NYT does **not** check guesses server-side in this flow. The answer goes to the browser, and the client compares guesses locally.

What keeps future answers hidden: nothing in the client. Only the server's horizon limit (about 38 days on 2026-09-30) and obscurity. A client can request any date inside the horizon. A search result claimed the horizon is 23 days ([third-party summary](https://github.com/MoritzHayden/wordle-prophecy), not verified by me). My own probe found 38 days, so the horizon is not fixed and should not be assumed.

History: the original Wordle bundled its full answer list in JS, so every future answer was readable. See [a gist of the original answer list taken from the source code](https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b). Since the NYT took over, the answers come from the per-date endpoint above.

### NYT Connections and Strands: same pattern

Observed 2026-09-30:

- `https://www.nytimes.com/svc/connections/v2/2026-09-30.json` returned status OK with the full category and card data. `2026-10-20` also returned full data. `2026-11-20` returned Not Found.
- `https://www.nytimes.com/svc/strands/v2/2026-09-30.json` returned status OK with the theme words. `2026-10-20` also returned data. `2026-11-20` returned Not Found.
- I did not probe the exact horizon for these two. It is at least 20 days.

So NYT serves the whole solved puzzle per date from an open, unauthenticated JSON endpoint, and accepts future dates inside a window.

### Angledle / Angle and Worldle (teuteuf.fr family)

Observed 2026-09-30 by reading the shipped JS (`https://angle.wtf/static/js/main.e950f9e6.js`, `https://worldle.teuteuf.fr/static/js/main.a3240bdf.js`):

- Both load static JSON assets from `https://cdn-assets.teuteuf.fr/data/` (for example `teuteuf-games/games-info.json`). That is how the Angle bundle fetches its data.
- The Worldle bundle posts every finished game to `https://teuteuf-api.pages.dev/api/stats/log` with fields including the puzzle, the guesses, the status and the language. This is an anonymous result-report endpoint on a serverless host, relevant to the "global stats" idea.
- UNVERIFIED: whether the daily answer itself is in a bundled list, in a CDN file keyed by date, or computed server-side. I did not find an answer list in the bundles by string search, and I did not reverse the day-to-answer mapping. I did not see a per-date endpoint.
- UNVERIFIED: whether future days can be requested.

### Framed

`https://framed.wtf/` is a Next.js site (fetched 2026-09-30). The main page chunk was tiny (264 bytes) and I found no answer list or per-date endpoint in the chunks I read. UNVERIFIED: how the daily puzzle is delivered and whether future days are reachable.

### Summary of the pattern

| Game | Delivery | Answer sent to client | Future dates |
|---|---|---|---|
| NYT Wordle | `GET /svc/wordle/v2/<date>.json` | Yes, plain `solution` | Yes, up to about 38 days ahead (observed) |
| NYT Connections | `GET /svc/connections/v2/<date>.json` | Yes, full groups | Yes, at least 20 days (observed) |
| NYT Strands | `GET /svc/strands/v2/<date>.json` | Yes, theme words | Yes, at least 20 days (observed) |
| Angle / Worldle | Static CDN JSON plus stats POST | UNVERIFIED | UNVERIFIED |
| Framed | Next.js static site | UNVERIFIED | UNVERIFIED |

The one game I could verify end to end trusts the client and does not hide near-future answers.

## Part 2: Supabase free tier, anonymous access

All Supabase facts below are from supabase.com docs or the docs source in `github.com/supabase/supabase` (`apps/docs/content/guides/...`), read 2026-09-30.

### Quotas

- Free plan: 500 MB database, 50,000 MAU, 5 GB egress (uncached) plus 5 GB cached egress, unlimited API requests, two active projects. [Pricing](https://supabase.com/pricing). Egress quota table: [egress guide](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/manage-your-usage/egress.mdx) (Free: 5 GB / 5 GB).
- Egress is one quota across Database, Auth and Storage. It resets at the start of the billing cycle. [Egress guide](https://supabase.com/docs/guides/platform/manage-your-usage/egress).
- The `anon` role is not a user, so signed-out traffic does not add MAU. The docs state that the `anon` role "is an unauthenticated request". [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security). (Supabase anonymous sign-ins are different: they use the `authenticated` role and do count as users. [Auth anonymous docs](https://supabase.com/docs/guides/auth/auth-anonymous).)
- Request limits: the pricing page lists "unlimited API requests". I found no per-second or per-day cap on Data API requests in the docs.

### What happens when the quota is exceeded

- "You will be notified when you exceed the Free Plan quota... If you continue to exceed the limits, service restrictions will apply." The Fair Use Policy lists "You continually exceed the Free Plan quota" as a trigger. There is a grace period. "In some cases, like suspected abuse of our services, restrictions may be applied without prior notice." [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy).
- If an organization is restricted for egress, the restriction clears at the next billing cycle or on upgrade. [Egress guide](https://supabase.com/docs/guides/platform/manage-your-usage/egress).
- UNVERIFIED: exactly which requests fail while restricted (reads, writes, or everything) and how long the grace period is. The docs do not spell it out.

### Project pausing

- "Supabase pauses Free Plan projects that show low activity over a 7-day period." Typically "a few user requests to the database each day over the previous week" is enough to avoid it. A warning email goes out about a week before. [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
- Restore from the dashboard within 1 year of the pause. No documented auto-resume from app traffic. [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
- A daily fetch by visitors counts as activity. A paused project means the Daily is unavailable until the owner resumes it. UNVERIFIED: how the API responds while paused.

### Rate limits on the Data API (PostgREST)

- Supabase does not apply a documented rate limit to the Data API for `anon` or any role. The [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) says only that Supabase "employs a number of safeguards against bursts of incoming traffic". Documented numeric limits are for Auth (emails, OTPs, sign-ins by IP) and the Management API, not for PostgREST. [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).
- Community discussions confirm there is no built-in per-IP limiter for PostgREST: [#19493](https://github.com/orgs/supabase/discussions/19493), [#3196](https://github.com/orgs/supabase/discussions/3196), [#36512](https://github.com/orgs/supabase/discussions/36512). One response in #3196 says Supabase is "looking to add configuration for via the Supabase dashboard in the future". I could not confirm the author's maintainer status, so treat it as unconfirmed.
- A row cap exists: PostgREST's `db-max-rows` is "a hard limit to the number of rows PostgREST will fetch", default unlimited upstream. [PostgREST config](https://docs.postgrest.org/en/stable/references/configuration.html). Supabase's Data API setting defaults to 1,000 rows and the docs recommend keeping it low against accidental or malicious requests. [API settings search result](https://supabase.com/docs/guides/api).

### Row level security and grants for `anon`

- Tables in an exposed schema without RLS are readable and writable by any role with a grant. On existing projects, `anon` gets `SELECT, INSERT, UPDATE, DELETE` on new `public` tables by default, and `EXECUTE` on functions. "Adding policies doesn't remove them." So you must revoke grants you do not want. [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security), [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).
- A policy `to anon using (true)` exposes every row that the grants reach. [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security).
- The Data API can be limited to a dedicated schema, so internal tables and helper functions are not exposed. [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).

### Rate limiting and restricting writes in pure Postgres

- **Pre-request function.** PostgREST `db-pre-request` (Supabase: `pgrst.db_pre_request`) runs a function before each request. Supabase's own guide uses it for per-IP write limits: a `SECURITY DEFINER` function `public.check_request()` logs each write in a `private.rate_limits` table (IP and timestamp) and rejects with HTTP 420 after more than 100 writes from one IP in 5 minutes. [Securing your API, rate limit per IP](https://supabase.com/docs/guides/api/securing-your-api).
  - Stated limit: "You can only rate-limit POST, PUT, PATCH, and DELETE requests. GET and HEAD requests run in read-only mode." So reads cannot be limited this way. Same source.
  - The IP comes from the `x-forwarded-for` header. The example splits on commas and takes the first value. UNVERIFIED: whether a client can forge extra `x-forwarded-for` entries that change which value is first. Check before relying on it.
  - The guide tells you to clean old rows with a `pg_cron` job. Same source.
  - Every write pays an extra insert plus a count query, which costs database time.
- **Extra API key for `anon`.** The same guide shows a pre-request check that requires an app-managed `x-app-api-key` header for `anon` requests and rejects others with 403. The key ships in the client, so it only blocks casual callers. [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).
- **`SECURITY DEFINER` RPC.** A function can validate input, then insert. Combined with revoking direct `INSERT` from `anon` and granting only `EXECUTE` on the function, the function becomes the only write path. The grant model is documented in [Securing your API](https://supabase.com/docs/guides/api/securing-your-api) (grants on functions to `anon`). The design patterns inside the function (dedupe, per-device caps) are my reading, not a documented recipe.
- **`pg_cron`.** Supabase Cron is a Postgres module. Jobs run SQL or functions, from every second to once a year. "We recommend no more than 8 Jobs run concurrently. Each Job should run no more than 10 minutes." [Cron docs](https://supabase.com/docs/guides/cron). UNVERIFIED: the docs I read do not say it is Free-plan-gated or not. I found no plan restriction.
- **`pg_net`.** Async HTTP from Postgres. "Up to 200 requests per second." Responses are kept 6 hours. [pg_net docs](https://supabase.com/docs/guides/database/extensions/pg_net). UNVERIFIED: Free-plan availability is not stated in those docs. I found no plan restriction.
- Supabase's own guide for Edge Functions rate limiting exists, but Edge Functions are out of scope here.

### Hiding rows dated in the future

- RLS policies run as part of the query, so a select policy can check a date column: for example `using (print_date <= (now() at time zone 'utc')::date)`. The docs describe `using` policies as the row filter. [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security). The clause is my example, not from the docs. `now()` is the transaction start time in Postgres. [PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT).
- Because Postgres `current_date` and `now()` depend on the session time zone, the policy must convert to UTC explicitly. Supabase sessions default to UTC, but UNVERIFIED for every role. State it in the policy.
- Consequence for time zones: a UTC cut-off makes a new day appear at 00:00 UTC. A player east of UTC (for example Asia) sees "tomorrow" earlier in their local calendar than the row unlocks. A player west of UTC sees yesterday's row until UTC midnight. The policy cannot know the player's zone.
- The row is hidden from `anon` reads only. The owner, `service_role` and the dashboard see everything. The anon key is public, so this is a real server-side gate, unlike NYT's open horizon.
- Security barrier: a view or RPC returning only today's row is an alternative gate. Not researched beyond the grant model above.

## Implications for Portdle

These are facts for the later tickets, not recommendations.

- **Answer trust.** NYT sends the plain answer to the client and does not verify guesses on the server. The answer and its correctness check then live in the browser. A Supabase RLS date policy would stop a client from reading future rows, which NYT does not do. Checking guesses server-side is possible only inside a Postgres RPC, and would add a request per guess.
- **Schedule source.** If the Schedule (day to Daily categories) lives in a table, an RLS date policy can hide the future. The cut-off is UTC midnight and is not per-player. Schedule rows dated today are readable by any anon client once the day starts.
- **Load.** Each visitor reading one row a day is tiny in egress terms. The 5 GB uncached egress quota is the binding quota, not a request count. A cached CDN path is UNVERIFIED for PostgREST; the cached egress quota is tied to Storage Smart CDN in the docs.
- **Global stats writes.** PostgREST has no built-in limiter. The documented pure-Postgres tools are a pre-request function (writes only, per IP, needs cleanup), a `SECURITY DEFINER` RPC as the sole write path, and an app key in the client (weak). Anyone can still post garbage within those limits. Supabase restricts projects that keep exceeding the Free quota, and may restrict without notice on suspected abuse.
- **Pausing.** One paused project pauses the Daily for everyone. Daily traffic counts as activity, but the docs give no threshold beyond "a few user requests to the database each day".
- **Open items for grilling.** Whether `x-forwarded-for` can be forged for the IP check. Free-plan availability of `pg_cron` and `pg_net`. What exactly fails when the egress quota is exceeded.
