# Ticket spec: Functional suite on five projects

Ticket #226 of Spec 6. Tracker: https://github.com/mquesada02/portdle/issues/226. Parent spec: https://github.com/mquesada02/portdle/issues/222 (`docs/superpowers/specs/2026-10-04-spec6-tests-ci-motion.md`, section "Functional suite"). Map: https://github.com/mquesada02/portdle/issues/212. Earlier spec: `docs/superpowers/specs/2026-09-30-t193-playwright-e2e.md`. Base branch: `master`. Blocked by: none. Ticket #227 changes the same workflow file in parallel.

## Problem Statement

The functional suite runs only in Chromium at desktop size. It uses one worker and one shared test user. No functional test covers Firefox, Safari, or a phone. A failed CI (Continuous Integration) run uploads nothing, so an agent cannot read the report or the trace. The configuration does not set the number of retries, so a later change could let a flaky test pass quietly.

## Solution

The suite runs on five Playwright projects: Chromium, Firefox, and WebKit at desktop size, and the "Pixel 7" and "iPhone 14" profiles. Each project signs in as its own seeded test user, so five workers run in parallel and share no rows. Retries are off. On a failure, the `sql-tests` job uploads the Playwright HTML report and the traces. CI keeps them for 14 days.

## User Stories

1. As the owner, I want the functional suite to run on Chromium, Firefox, and WebKit at desktop size, so that each engine is tested.
2. As the owner, I want it to run on a Pixel 7 and an iPhone 14 profile with touch, so that phone players are tested.
3. As the owner, I want each project to sign in as its own test user, so that the projects run in parallel and never change each other's rows.
4. As the owner, I want `retries: 0` set in the configuration, so that a flaky test cannot pass quietly.
5. As an agent, I want the HTML report and the traces of a failed CI run, so that I can follow each step.
6. As a developer, I want a rerun of the suite on the same stack to pass, so that I can run it any number of times.

## Implementation Decisions

### Projects

- `playwright.config.ts` lists five projects, in this order: `chromium` (`Desktop Chrome`), `firefox` (`Desktop Firefox`), `webkit` (`Desktop Safari`), `Pixel 7` (`devices["Pixel 7"]`), and `iPhone 14` (`devices["iPhone 14"]`).
- The project names are the keys of the test user mapping (next section).
- `workers` is 5.
- The comment above the configuration says that each project has its own test user. It also says that all projects share one database.
- `retries: 0` is set explicitly. It applies to local runs and CI runs.
- `use.trace` is `"retain-on-failure"`. Video stays off (the Playwright default).
- The reporters are `list` and `html` (with `open: "never"`). The HTML report goes to `playwright-report/`. The traces go to `test-results/`. `.gitignore` lists both folders.

### Test users

- The seed (`supabase/seed.sql`) creates five test users in place of one.
- The ids are `00000000-0000-4000-8000-000000000002` to `...0006`, in project order. The old test user keeps id `...0001` on the running stack, so no new id collides with it.
- The emails are `test-chromium@portdle.local`, `test-firefox@portdle.local`, `test-webkit@portdle.local`, `test-pixel-7@portdle.local`, and `test-iphone-14@portdle.local`.
- All five test users share the password `portdle-local-test`.
- The display names are `Local Tester 1` to `Local Tester 5`. The seed sets each one as `full_name` in `raw_user_meta_data`.
- Each account has `name_confirmed` set to true.
- The seed header comment names the five emails and the password.
- The e2e helper `signIn` takes the project name. The email is `test-<name>@portdle.local`, where `<name>` is the project name in lower case with spaces turned into hyphens.
- `withSignedInPage` takes the project name and passes it on. The two signed-in tests read the name with `test.info().project.name`.
- The seed runs only on `supabase db reset` and on a fresh `supabase start`. Do not reset the shared local stack.
- Before the first local run, add the new test users to the running stack with the same SQL. The old `test@portdle.local` user stays on that stack until its next reset. Nothing reads it.

### Tests

- The five existing tests keep what they assert.
- A helper may change only to make a test work on a project. An example is a locator that a phone layout hides.
- `withSignedInPage` makes its context with `browser.newContext()`. That context must carry the project's `use` options (device profile, viewport, touch). The existing tests already rely on this for `baseURL`. The implementation proves it for the phone projects. If the proof fails, the helper passes the project's options explicitly.
- The signed-in tests keep their rerun-safe design, now per test user. Each test user's account keeps what an earlier run synced. Each test ends on the same asserted state on a first run and on a rerun.
- The signed-out tests use a fresh browser context per test, so they share no state across projects.

### CI (`sql-tests` job only)

- The Playwright install step installs Chromium, Firefox, and WebKit with their system dependencies.
- The `pnpm test:e2e` step gets an id.
- A new step follows it. Its condition is `${{ !cancelled() && steps.<id>.outcome == 'failure' }}`. It uses `actions/upload-artifact@v4`. It uploads `playwright-report/` and `test-results/` as one artifact named `playwright-report`, with `retention-days: 14`.
- The artifact holds no video, because video is off.
- No other job and no other part of the workflow file changes.

### `scripts/e2e.ts`

- It already forwards its arguments to `playwright test` and runs every project.
- If a comment in it names the single test user, update that comment. Otherwise leave the file as it is.

## Testing Decisions

- The suite is its own test. Acceptance: `pnpm test:e2e` passes all five tests on all five projects (25 test runs). It passes again on a second run without a reset.
- A device check: a temporary assertion, not committed, shows that a signed-in context on "Pixel 7" and "iPhone 14" reports touch and a phone-size viewport.
- A trace check: a deliberate failure on one project produces a trace in `test-results/` and a report in `playwright-report/`. A green run produces no trace file. The deliberate failure is not committed.
- The CI upload step is checked on the PR through its syntax and its condition as written. The PR does not force a real failed CI run.
- No new Vitest test: the user mapping is one line, and the five signed-in runs cover it.

## Out of Scope

- The screenshot gate, its stub build, its configuration, and its jobs (later Spec 6 tickets).
- The docs-only skip, the concurrency group, and the deploy `needs` change (ticket #227).
- The fixture shape check.
- New tests or new assertions.
- A Firefox phone profile.
- A video upload.

## Further Notes

### Author calls

Author calls made while writing (accepted by the owner through the coordinator, 2026-10-05).

1. The email rule is `test-<project name, lower case, spaces as hyphens>@portdle.local`. The ids run from `...0002` to `...0006` in project order, because the running stack's old test user holds `...0001`.
2. All five test users share one password, `portdle-local-test`, as the one test user did.
3. The old `test@portdle.local` user leaves the seed. Nothing else reads it (see "Facts checked").
4. The display names are `Local Tester 1` to `Local Tester 5`. The display-name check allows letters, digits, spaces, apostrophes, dots, and hyphens.
5. The HTML reporter runs on every run, local and CI, next to the `list` reporter.
6. The upload step runs only when the e2e step failed. A failed SQL test uploads nothing.
7. The new test users go to the running local stack by direct SQL with the seed's statements, because the stack must not be reset.
8. The project name is the key of the test user mapping. The spec files read it with `test.info().project.name`.

### Facts checked

- `grep -rn "test@portdle.local"` finds the old email only in `supabase/seed.sql`, `e2e/helpers.ts`, and older specs under `docs/`.
- `playwright-report` and `test-results` are already in `.gitignore`.
- The accounts check `accounts_display_name_valid` allows the new display names.
