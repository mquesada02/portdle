# Ticket spec: Gate: signed-in screens

Spec for #232. Tracker: https://github.com/mquesada02/portdle/issues/232. Parent: Spec 6 (tests, CI, and motion), https://github.com/mquesada02/portdle/issues/222 (`docs/superpowers/specs/2026-10-04-spec6-tests-ci-motion.md`, "Screenshot gate: data", user story 23). Map: https://github.com/mquesada02/portdle/issues/212. Decision: #216 (fixed data). Tracer spec: `docs/superpowers/specs/2026-10-05-t227-gate-tracer.md`. Base branch: `master`. Blocked by: #227 (merged).

## Problem Statement

The screenshot gate shows only screens that need no sign-in. The Account menu, the Leaderboards tab, and the Name confirm show only for a signed-in player. A change to their look reaches review only when the owner signs in on the real site.

## Solution

The gate fakes a sign-in. Before the page loads, the test stores a fixed session under the key the app derives (`sb-stub-auth-token`). Playwright answers the Account read, the Sync reads, and the Leaderboard read from committed fixtures. Three frames join the gate: the Account menu open, the Leaderboards tab with rows, and the Name confirm. Each frame runs in the full matrix of the Chromium gate (375 × 812 and 1024 × 768, light and dark). The ticket changes no app code.

## User Stories

1. As a developer, I want a test option that signs the page in as a fixed account, so that a test names the account it needs.
2. As a developer, I want the stored session to expire far in the future, so that the Supabase library never refreshes it during a test.
3. As a developer, I want the stub to answer the Account read from a committed fixture, so that the menu shows a fixed display name.
4. As a developer, I want the stub to answer every Sync read with no rows, and the first-sync write of the preferences, so that Sync ends without an error and no frame depends on it.
5. As a developer, I want the stub to answer the Leaderboard read from a committed fixture, filtered by category, orientation, and mode, so that the tab shows fixed rows.
6. As a developer, I want the Leaderboard fixture to hold a row of the signed-in account, so that the frame shows the "You" badge.
7. As a developer, I want an account with an unconfirmed name, so that the Name confirm opens.
8. As a developer, I want the PR to list the auth endpoints that the library calls at startup, so that a reviewer sees what the stub covers.
9. As a developer, I want any other request to fail the test, as today, so that a library bump that adds a call is caught.
10. As a reviewer, I want a frame of the Account menu open, so that the menu is guarded.
11. As a reviewer, I want a frame of the Leaderboards tab with rows, so that the tab is guarded.
12. As a reviewer, I want a frame of the Name confirm, so that the step is guarded.
13. As a reviewer, I want each frame at 375 × 812 and 1024 × 768, in light and dark, so that the matrix of Spec 6 is proven.

## Implementation Decisions

- **Terms.** This spec uses the terms of `CONTEXT.md`: Account menu, Name confirm, Display name. The app shows the Name confirm in a full-page modal `<dialog>`.
- **Session.** The init script stores one object under the key `sb-<first label of the host of STUB_URL>-auth-token`. The object has these fields:
  - `access_token`: a token that looks like a JWT (JSON Web Token): three parts that a dot separates. Its payload holds `sub` (the account id), `role` ("authenticated"), and `exp` (4102444800).
  - `refresh_token`: a fixed string.
  - `token_type`: "bearer".
  - `expires_at`: 4102444800 (2100-01-01). `expires_in`: 3600.
  - `user`: an object with `id` (the account id), `aud` and `role` ("authenticated"), `email`, `app_metadata`, `user_metadata`, and `created_at`.
- **Init script.** `page.addInitScript` serializes the function, so the function cannot read `STUB_URL` or the account. `gate/fixtures.ts` builds the key and the session in the test process and passes both as one argument. The account id comes from one place: `accounts.json`. `gate/stub.ts` loads that file with its own `fixture()` helper and exports `accountFor(option)`. The function returns the row whose `name_confirmed` is true for `"confirmed"` and false for `"unconfirmed"`. `gate/fixtures.ts` calls it and reads the row's `id`. Nothing else loads the file.
- **Account option.** `gate/fixtures.ts` gains one Playwright option fixture, `account`, with default `null` and the type `"confirmed" | "unconfirmed" | null`. A test file sets it with `test.use({ account: "confirmed" })`. When it is not `null`, the `page` fixture adds the session init script and passes the account to `stubBackend`. The existing tests do not set it and do not change. Only their import changes: `isReduced` moves from three spec files into `gate/fixtures.ts` (see Reuse).
- **Stub.** `stubBackend` in `gate/stub.ts` gains an optional third argument, the account. `answer()` returns an array today, and the fulfil step sends it as JSON. The ticket changes the reply so that the body can be an array or one object. `answer()` gains the request method and the account as parameters. `answer()` returns a reply (a status and an optional JSON body), so the write answer is status 201 with no body. It adds these answers, all for the stub host, all only when the test signed in:
  - `GET /rest/v1/accounts` with `id=eq.<account id>`: the account row with that `id` as one JSON object (no row with that `id`: no answer). The app uses `.single()`, which sends the accept header `application/vnd.pgrst.object+json`. A reply that is an array makes the app read the account as gone. The stub does not check the header; it answers by path and filter, as the other stubs do. The row is `accountFor(option)`.
  - `GET /rest/v1/codex_entries`, `blitz_bests`, `dailies`, `preferences`, and `blitz_runs`: an empty array. These are the five reads of the Sync pull.
  - `POST /rest/v1/preferences`: status 201 and an empty body. A first sync of a device that never synced marks every stored preference as changed. The init script stores the theme and the How-to flag, so the confirmed account pushes them (an upsert, `on_conflict=account_id`) right after the pull (`syncOnce` calls `pushPending` at its end, with no timer). The app also writes the account id and the list of changes to the device. No frame shows any of this. The stub checks the method for these new answers, so an unexpected write (for example to another table) is not answered and fails the test.
  - `GET /rest/v1/leaderboard_all_time`: the rows of `gate/fixtures/leaderboard.json` whose `category`, `orientation`, and `mode` equal the `eq.` filters of the request. The stub ignores the `or` filter and the `order` of the request. The fixture is therefore sorted by `rank`, and every row has a `rank` of 100 or less (`LEADERBOARD_TOP`).
  - A test that did not sign in makes no request to these paths, because the app reads no account without a stored session.
- **Auth endpoints.** Probed on 2026-10-05 (Playwright 1.63.0, Chromium, `@supabase/supabase-js` 2.117.2). The probe loaded `/portdle/` with the session above and opened the Account menu. The probe saw no `/auth/v1/*` request. The probe did not run the Sync pull or the Leaderboards tab. Both use `getSession`, as `getAccount` does, and a stored session that is not expired needs no network call. The final tests run those paths, and the unstubbed-request check fails them if an auth request happens. The PR body states that the list is empty. The stub adds no auth answer (author call 1).
- **Fixtures.** `accounts.json` holds two rows with the shape of the database (`id`, `display_name`, `name_confirmed`): one confirmed, one not. Each row has a fixed UUID (universally unique identifier) as `id`. `leaderboard.json` holds rows with the columns of the view (`account_id`, `display_name`, `category`, `orientation`, `mode`, `score`, `time_to_score_ms`, `rank`) for the default picker (`category` "mixed", `orientation` "default", `mode` "sprint"): eight ranked rows. One row has the `account_id` of the confirmed account.
- **Tests.** A new file `gate/signed-in.spec.ts` holds three tests. Each test skips under reduced motion (author call 5).
  - `Account menu open`: account `confirmed`. Open `/portdle/`. Click the "Account" button. Wait for the display name. Wait for quiet. Take one frame.
  - `Leaderboards tab`: account `confirmed`. Open `/portdle/blitz`. Click the "Leaderboards" tab. Wait for the first data row (the cell of the top player). Wait for quiet. Take one frame.
  - `Name confirm`: account `unconfirmed`. Open `/portdle/`. Wait for the dialog heading. Wait for quiet (the dialog fades in over 150 ms). Take one frame.
- **Reuse.** The tests use `waitForQuiet` of `gate/freeze.ts` and the `test` of `gate/fixtures.ts`. The session key comes from `authStorageKey` of `scripts/e2e-env.ts`, which the functional suite already uses (it copies the rule of `src/remote/supabase.ts`). The ticket forks no helper: the `isReduced` copy of the specs becomes one export of `gate/fixtures.ts`, which `daily.spec.ts`, `theme.spec.ts`, and `signed-in.spec.ts` import. The clock stays installed as in the tracer.
- **Frames.** The frame names are `account-menu.png`, `leaderboards.png`, and `name-confirm.png`. The config adds the test file and the project to each path (`gate-baseline/signed-in.spec.ts/account-menu-chromium-375-light.png`). This gives 12 frames. The PR adds frames, so its gate job reports differences against the master baseline. The PR carries the `visual-change` label once the frames are final.

## Testing Decisions

- The gate tests are the product. A good test here opens one screen with literal fixtures and takes one frame.
- Proof of the fake sign-in: the Account menu test reaches the signed-in view, and the Leaderboards frame shows the "You" badge. Both need the stored session and the stub answers. The frame, not an assertion, guards the badge.
- Proof of the stub rule: a developer deletes the `leaderboard_all_time` case from `answer()` and runs the Leaderboards test. The test times out at the first row, and its failure list also holds the unstubbed-request message ("requests with no stub"). The developer then restores the case. This is a manual check and is not committed.
- Proof that a frame guards the screen: a developer changes one class of the menu by hand, and `pnpm gate` fails that frame. This is a manual check and is not committed.
- `pnpm gate:capture`, then `pnpm gate`, passes twice in a row on the same machine (the new frames are the same on each run).
- Prior art: `gate/daily.spec.ts`, and the unit tests `src/ui/account-menu.test.tsx`, `src/ui/name-confirm.test.tsx`, `src/ui/leaderboards.test.tsx`.

## Out of Scope

- The shape check of the fixtures against the local stack (ticket #226). The new fixtures keep the database row shape, so the check can cover them later.
- Frames of the signed-in screens in other engines. The tests run in every engine that the gate runs. Today that is Chromium only; a later engine picks the tests up through its own projects.
- The other signed-in screens (Delete account, Device progress choice, the Weekly and Today windows).
- Motion frames of the Name confirm fade-in (opacity and scale, 150 ms) and of any other dialog motion. Spec 6 lists no such frame for this ticket.
- Any app code change.

## Further Notes

### Author calls

The owner accepted all seven calls on 2026-10-05, through the coordinator. This includes call 1 (no auth stubs; the PR lists the measured empty set) and call 5 (frames at rest, no reduced-motion run).

1. No auth stub is added. The probe shows that no `/auth/v1/*` call happens, and an unused stub has no test. The unstubbed-request check fails the test if a library bump adds a call, and Spec 6 says that a bump must re-run these tests. Spec 6 says "at least the current user and the token refresh; the first gate ticket confirms the list": the confirmed list is empty. Cost: the criterion "stubs answer the auth endpoints" holds with an empty list, and Spec 6's "at least" wording needs the owner to accept that the first gate ticket changed it. The alternative is a stub of `/auth/v1/user` and `/auth/v1/token` that no test runs.
2. The account is a Playwright option fixture (`test.use({ account })`), not a helper that each test calls. The option keeps the session and the stubs in step, so a test cannot sign in without the stubs.
3. The Sync reads get answers for every signed-in test. The unconfirmed account never pulls, so only the confirmed account uses them. One code path serves both accounts.
4. The Leaderboard stub answers the all-time view only. The frame uses the default window. The Weekly and Today views stay unstubbed and fail a test that opens them.
5. The three frames are screens at rest, so they skip reduced motion, as "fresh Daily at rest" does. The Name confirm fades in over 150 ms (`dialog[open]` in `src/styles.css`), so the test waits for quiet before the frame. Reduced motion changes only that fade, which no frame shows. Spec 6 asks for a reduced-motion run of every motion; no frame of this ticket shows a motion.
6. The Leaderboards frame opens `/portdle/blitz` and clicks the tab, because the picker starts from the last run's setup ("mixed", "default", "sprint" on a new device).
7. The fixed account ids are UUIDs written in `accounts.json`. The session reads the id from there (the single source).

### Facts checked

- Probed on 2026-10-05 with the stub build: with a stored session that expires in 2100, the library makes no auth request. The app sends `GET /rest/v1/accounts?select=display_name,name_confirmed&id=eq.<id>` two times at load. The stub answers both the same way.
- `getAccount` returns `signedIn` only after `auth.getSession()` finds the stored session and the accounts read returns one row. It returns `signedOut` for no stored session.
- Sync does not pull while the name is unconfirmed (`src/sync/sync.ts`, `syncOnce`).
- Sync writes to the device and to the account (see the `POST` answer above). A test must not assert on the device state after the pull.
