# Ticket spec: Playwright end-to-end suite

Spec for #193. Tracker: https://github.com/mquesada02/portdle/issues/193. Parent: Spec 5 (Dailies from the backend), https://github.com/mquesada02/portdle/issues/181 (`docs/superpowers/specs/2026-09-30-spec5-dailies-backend.md`, "Development and CI" and "Testing Decisions", story 72). Map: https://github.com/mquesada02/portdle/issues/169, decision https://github.com/mquesada02/portdle/issues/180. Base branch: `spec5`. Blocked by #187, #191, and #192 (all merged).

## Problem Statement

Every Spec 5 behavior is tested with a fake `Remote` in jsdom. No test runs the built site in a real browser against a real backend, so nothing proves that the REST reads, the Schedule, the current Dailies function, the global stats view, and the account sync work together. A break between the client and the database (a renamed column, a missing grant, a wrong URL) reaches review only when the owner opens the site.

## Solution

A Playwright suite runs the production build in headless Chromium against the Supabase CLI local stack, with the Schedule filled through today + 7. Five specs cover the paths the ticket names: a signed-out player loads and finishes the Daily; the error panel shows and recovers when the stack is unreachable; an Archive Late play appears in History; a signed-in Late play syncs its `late` mark; and a signed-in on-day finish shows the global stats. `pnpm test:e2e` runs the suite on a developer machine. CI runs it in the existing `sql-tests` job after the generator fill and the SQL tests.

The signed-in specs sign in by calling the local auth API and store the returned session under the Supabase client's storage key before the app loads. Nothing test-only ships in the production bundle.

## User Stories

1. As a developer, I want one command, `pnpm test:e2e`, to build the site against the local stack and run the browser suite, so that I run in one step what CI runs.
2. As a developer, I want the build to use the stack's URL and publishable key read from the CLI, so that I never copy a key by hand.
3. As a developer, I want the suite to test the production build and not the dev server, so that bundling mistakes show up.
4. As a developer, I want the suite to stop with one clear message when the stack does not answer the current Dailies read (not running, or no Schedule row for today), so that I do not read a wall of timeouts.
5. As a developer, I want the suite to need no database credentials, so that agents and CI run it with the public key only.
6. As a reviewer, I want CI to run the suite on every pull request after the generator fill, so that a break between client and database fails the pull request. (Ticket, CI; spec story 72.)
7. As a reviewer, I want the suite in the existing SQL job, so that one local stack serves both and the job count stays the same.
8. As a developer, I want a spec where a signed-out player opens the Daily and finishes it, so that the real read path (catalog, current Dailies, Schedule) is proven. (Ticket, signed out; spec story 72.)
9. As a developer, I want that spec to check the puzzle number next to the date, so that the number the server and the client agree on is proven.
10. As a developer, I want that spec to check the Reveal and the Global stats block after the finish, so that the real stats view and its read are proven, signed out. The spec asserts that the block shows its Players and Solve rate labels and the distribution, and asserts no count, because a signed-out finish adds no row. (Spec story 34.)
11. As a developer, I want a spec where every request to the stack's REST address fails, so that the shared error panel and its server message are proven in a real browser.
12. As a developer, I want that spec to lift the failure, press "Try again", and see the Daily load, so that recovery is proven. (Ticket, signed out; spec story 17.)
13. As a developer, I want the failure to be a browser-level block of the stack's REST address, so that the test cannot stop a stack that other work shares. (Owner decision: "stack stopped" is read as "stack unreachable".)
14. As a developer, I want a spec where a player opens a past Daily from the Archive and finishes it, so that the Archive list, the board at its own address (`/archive/<category>/<date>`), and the Late play are proven. (Ticket, signed out; spec stories 39 to 43.)
15. As a developer, I want that spec to check the "Late play, not counted" note, so that the Late play rule is proven end to end. (Spec story 37.)
16. As a developer, I want that spec to open History and find the row of the Late play, with its entry name and port, so that History's list of finished Dailies and the entry names it takes from the past Schedule rows are proven. (Spec stories 47 and 48.)
17. As a developer, I want a spec where the seeded test user plays a past Daily late and its `late` mark reaches the account, so that the sync of `late` is proven against the real table. (Ticket, signed in; spec story 55.)
18. As a developer, I want that spec to read the account's `dailies` row through the REST API with the user's own session, so that the check is of stored data, not of the screen.
19. As a developer, I want a spec where the seeded test user finishes today's Daily and sees the Global stats with at least one player and the own result highlighted, so that the push of the account's pending changes before the read, and the view, are proven on the first run of a day. (Ticket, signed in; spec stories 31, 32, and 35.)
20. As a developer, I want the signed-in specs to start the app as a device with a stored sign-in, so that the real sign-in restore path runs.
21. As the owner, I want nothing test-only in the production bundle, so that the shipped site is the tested site.
22. As the owner, I want the live project untouched, so that the suite only ever talks to the local stack.
23. As a developer, I want a rerun of the suite on the same stack to pass, so that I never reset the stack between runs. A rerun re-proves the pull and the reads; the first run of a day proves the plays and the push.
24. As a developer, I want specs to run one at a time, so that the shared test account and database never race.
25. As a developer, I want Vitest never to pick up the browser specs, and `pnpm typecheck` and `pnpm lint` to cover them, so that the existing checks stay green and complete.

## Implementation Decisions

- **Seam**: one seam, the built app in a real browser against the local stack. This is the highest seam and the only one the suite uses. Specs assert what the player sees, plus one stored row for `late`. They call no internal function.
- **Tooling**: `@playwright/test` is a devDependency pinned to an exact version, with Chromium only. Browser specs live in a new `e2e/` folder, and the Playwright configuration file sits at the repository root. CI installs the browser with `pnpm exec playwright install --with-deps chromium`.
- **Runner**: `pnpm test:e2e` runs a small TypeScript script (run with `tsx`, beside `scripts/dev.ts`). It reads `supabase status -o env` through the existing `parseStackEnv`, builds the site with `vite build` into a separate output folder (`dist-e2e`) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set to the stack's API URL and publishable key, and starts Playwright with the stack's URL and key in its environment. Playwright serves the output folder with `vite preview` on a fixed port, through its own web server setting, and its `testDir` is `e2e`, so it never loads the Vitest files in `scripts/`. The script does not start the stack and does not fill the Schedule (`pnpm dev` and `pnpm dev:schedule` do). Before it builds, it checks that the stack answers the current Dailies read with all three Daily categories (an error status, an empty answer, or no row for today fails the check); if not, it exits non-zero with one message that names `pnpm dev` and `pnpm dev:schedule`. The check is a small function of the API URL and key, so its Vitest test can point it at an unreachable address and assert the message, without stopping the shared stack. The build skips `tsc -b`, which `pnpm typecheck` already runs. The site's base path `/portdle/` stays, so the specs open `/portdle/`.
- **No credentials**: specs read data through the public REST reads with the anon key: the current Dailies function, the Schedule table, and the `catalog_entries` table. Row-level security shows the Schedule only through the server's date, so a spec never reads a future row (the local fill reaches today + 7, but anon sees none after today). A spec learns the answer port of the Daily it plays from those reads, then types it and wins in one try. No spec uses the database URL, the generator role, or a service key.
- **Signed-in setup**: a helper calls the local auth API with the seeded test user (`test@portdle.local` and the fixed local password from `supabase/seed.sql`) and gets a session. An init script writes that session to local storage under the key the app derives from the stack URL (`sb-` plus the first label of the host name, then `-auth-token`, so `sb-127-auth-token` locally) before the app loads, and only when the device holds no sign-in yet, so a token the app has refreshed is never overwritten. The key derivation is one small pure function in `scripts/`, imported by the specs, so the Vitest test beside it covers the only copy. The stack check, in the same file, is used by the runner. Its rule is a copy of the app's, so a change of the app's rule fails the signed-in specs. The seeded display name is already confirmed, so no name dialog shows.
- **How-to dialog**: the shell opens the how-to dialog on every device that has not stored `howToSeen`, and it covers the board. The dialog opens in an effect after the first render, and it opens again on every first load of a fresh browser context, signed out or signed in (a later pull does not close it). A shared helper waits for the dialog and presses "Got it", and the spec runs the helper after the first page load of a fresh context, then waits for the dialog to be gone before it touches the board. After the helper's dismissal the flag is stored on the device, so the reload in the Reruns step does not show the dialog again, and the spec only asserts that no dialog is open after the reload. The helper itself accepts both cases (a dialog that shows, and one that does not).
- **Which Daily each spec plays**: the signed-out finish plays today's Daily of the Mixed Daily category. The signed-in on-day finish plays today's Daily of the Protocols Daily category. The two Late play specs (signed out in the Archive, signed in for the `late` sync) both play yesterday's Daily of the Applications Daily category (server date minus one day), each in its own browser context. A signed-out record stays on its device and never syncs, so the two never share a record. Only the on-day spec adds to today's Global stats of its category. The server's date comes from the current Dailies read, never from the device clock.
- **Error panel spec**: before the app loads, the spec makes the browser fail every request to the stack's REST address (a route block). It opens the Daily and checks the panel's server message ("Portdle's server isn't answering. Try again in a moment."). It lifts the block, presses "Try again", and checks that the Daily loads. The stack stays up. "Stack stopped" in the ticket is read as "stack unreachable" (owner decision, 2026-10-03).
- **Late play and History spec**: the build carries the backend settings, so the Global stats block, with its "Late play, not counted" note, renders. The spec opens the Archive, picks yesterday's row of the Applications Daily category, plays it to a win, and checks the "Late play, not counted" note. It then opens History and checks a row for that Daily with its puzzle number, result, and the entry's name and port.
- **`late` sync spec**: signed in, the spec plays yesterday's Daily of the Applications Daily category late in the Archive, then reads the account's `dailies` row for that category and date with the user's session through REST, and checks `late` is true. The read polls briefly, because the push runs after the finish.
- **Global stats spec**: signed in, the spec plays today's Daily of the Protocols Daily category to a win and checks the Global stats block: the number of players is at least one, and the bar of the own result (one try) is highlighted. The block's own push-then-read makes the count include the player.
- **Reruns**: agents and CI cannot delete rows (no delete grant), so the account keeps what an earlier run synced, and a signed-in spec must pass on a rerun on the same day. Each signed-in spec uses one account, one fixed category and day, and a fresh browser context. The board reads the device's record once when it mounts, and sign-in pulls the account's rows after that, so the spec waits until the device holds the pulled record, and then reloads the page before it looks at the board. The wait watches the end state, not one response: the device's stored Daily key for that category and date appears (the pull writes it only after all of its reads finish, so a response alone can come too early). The wait polls the device's stored state, so it cannot miss the write whenever it starts, and on a first run, where the pull brings nothing, it ends on a fixed timeout of 10 seconds, which every first run of a day pays, and the spec goes on to play. The stored key names the Daily category by its stored id (`mixed`, `protocols`, `applications`), not by its label. If the Daily is playable after the reload (the first run on a fresh stack, which is always the case in CI), the spec plays it. If it is already finished (a rerun), the spec does not play. In both cases it then asserts the end state of its own spec: the `late` sync spec asserts the "Late play, not counted" note and the stored `late` row; the on-day Global stats spec asserts the highlighted bar and a player count of at least one. Asserts are "at least" and "is true", never exact counts. A rerun therefore re-proves the pull and the reads, and the first run of a day proves the play and the push. The device-progress choice does not appear for a fresh browser context with no stored sync account; if a dialog other than how-to appears, the spec fails and reports it as a finding. On a new UTC day today's Daily is a new one, so the on-day spec plays again.
- **Serial**: Playwright runs one worker with no parallel specs.
- **CI**: the existing `sql-tests` job gains two steps after the SQL tests: install Chromium, then run `pnpm test:e2e`. The generator fill already runs before the SQL tests, as the job's comment says. The job name and the `build` and `deploy` jobs stay as they are. The Playwright report is not uploaded.
- **Side effects of the new files**: Vitest excludes `e2e/**` (the exclude keeps Vitest's own default excludes, such as `node_modules`), because its default include would load `*.spec.ts`. `tsconfig.node.json` has no DOM types and lists its files one by one, so the `e2e/` files, the Playwright configuration, and the `scripts/` key function they import get their own `tsconfig` (ES2023 and DOM, Node types), added to the references of the root `tsconfig.json`, which `pnpm typecheck` already builds; the runner script and the key function join the file list of `tsconfig.node.json`, and both configs allow imports with the `.ts` extension. The Vitest test files in `scripts/` are run by Vitest only, as today. Biome's `includes` has no ignore of build output, so `biome.json` excludes `dist-e2e`, `playwright-report`, and `test-results` beside `dist`; `.gitignore` lists the same three folders.
- **Nothing in `src/` changes.** If a spec cannot pass without a change in `src/`, the cause is a defect in an earlier ticket, and the spec reports it to the coordinator instead of changing `src/`.

## Testing Decisions

- A good test here drives the built site as a player does and asserts what the player sees. The one exception is the stored `late` mark, which the spec reads through the public REST API with the user's own session, because the screen does not show it.
- The suite is itself the test. Its checks, run and recorded in the pull request:
  - `pnpm test:e2e` passes on the local stack, signed out and signed in;
  - a second run, on the same stack with no reset, passes (the idempotence check);
  - the unit test of the stack check passes against an unreachable address (the one clear message), and `pnpm test:e2e` runs the check before it builds, so no browser starts without a stack;
  - `pnpm lint`, `pnpm typecheck`, `pnpm test` (Vitest, with no browser spec loaded), and `pnpm build` still pass;
  - the production bundle holds no test helper (a search of the built files for the helper's names finds nothing);
  - the CI `sql-tests` job is green on the pull request, with the Playwright steps run after the generator fill and the SQL tests.
- Unit tests: the key derivation function and the stack check (and any other pure helper the runner adds) get small Vitest tests beside them in `scripts/`. Prior art: `scripts/stack-env.test.ts`.
- Prior art for the flows: the App-level suites for the Daily, Archive, History, error panel, and global stats in `src/ui/`. The browser specs cover the same player paths with the real backend instead of the fake `Remote`.

## Out of Scope

- The midnight rollover (server today comes from the database clock; unit tests cover it, per the Spec 5 testing decisions).
- Really stopping the Docker containers (the error panel spec blocks the stack's address in the browser).
- Any change to `src/`, the migrations, the SQL tests, or the generator.
- Cross-browser runs (Chromium only) and mobile viewports.
- Uploading the Playwright report or traces from CI.
- Visual regression and motion checks.
- Any run against the live project.
- A README section or other documentation beyond this spec and script comments.
- Sibling tickets: the owner runbook (#194) and the release (ticket 13).

## Further Notes

### Author calls

- Accepted by the owner through the coordinator on 2026-10-03: the error panel spec blocks the stack's REST address and reads "stack stopped" as "stack unreachable"; the tooling, the runner script, the no-credentials rule, the signed-in setup, the five specs, idempotent reruns, one worker, the CI placement, the Vitest and type-check side effects, and no new documentation; the pull request title `test(e2e): Playwright suite against the local stack`; `origin/spec5` merged into the branch before the pull request.
- Raised by the spec review and listed to the owner with the pull request: a signed-in spec skips the play when its Daily is already finished (rerun), after it waits for the pull and reloads; a shared helper dismisses the how-to dialog; the `e2e/` files get their own `tsconfig` with DOM types; Biome and `.gitignore` list the three new output folders; the key function and the stack check live in `scripts/` so Vitest covers them.

### Facts checked

- Checked in the code on 2026-10-03: the app derives its auth storage key as `sb-` plus the first host label plus `-auth-token`; the public reads are `rpc/current_dailies`, `schedule`, `catalog_entries`, and `daily_global_stats`; the Daily page shows `#<puzzle number> · <date>`; the Archive and the History rows link to `/archive/<category>/<date>`; the Global stats block shows "Late play, not counted" for a late record; the switch-over day is 2026-10-01, so a late play of any day from 2026-10-02 on is dated after it and sends a non-null `late`. The Late play specs play yesterday's Daily, so they need a server date of 2026-10-03 or later (true on the day of this spec).

### Reminders

- The local stack's ports (54321 API, 54322 database) are the CLI defaults and shared by every worktree on the machine, so no spec or script stops the stack.
- CI runs `scripts/run-sql-tests.sh` in the `sql-tests` job; the new steps come after it.
- If CI goes red on a new UTC day at `pnpm gen:schedule --check` in the `build` job, that is the committed-schedule check of an earlier ticket, not this suite; the coordinator syncs `spec5` with `master`.
