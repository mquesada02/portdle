# Spec: Tests, CI, motion, and Playwright (Spec 6)

Spec for a screenshot gate, wider Playwright coverage, a stable unit suite, an aborted read on timeout, and two new motions. Map: https://github.com/mquesada02/portdle/issues/212. Most decisions below come from the map's closed child tickets (#213 to #221); each ticket's resolution comment holds the full rationale. The rest are listed in Further Notes as author calls or owner decisions. Prototype: frame gallery (#217) changed two earlier map decisions: the gate has no human-facing gallery page, and the frames exist for agents to debug with. This spec follows the changed versions.

## Problem Statement

Agents change Portdle's UI, and the next effort (Spec 7, Lighthouse) will change it again. Nothing catches an unintended visual or motion change: the unit tests run in jsdom, which draws nothing, and the Playwright suite checks behavior only, in Chromium at desktop size. When a motion breaks, an agent cannot see it without a manual eye check in a real browser. Real players use Safari, Firefox, and phones, which no test covers. The unit suite fails under machine load (7 tests in 6 files, 3 or 4 failures per loaded run), so a red run does not mean a real failure, and reviewers learn to ignore red. A read that passes the 10-second timeout counts as failed, but its request keeps running. And two motions the owner wants are missing: the Rounds disclosure opens and closes with a jump, and the theme change is instant.

## Solution

A screenshot gate runs in CI on every PR and every master push. It drives the real app in Chromium, WebKit, and Firefox with fixed data and a fixed clock, freezes every animation at fixed times after an interaction, and compares each frame with the baseline from the green master run of the commit the PR branched from. A changed frame fails the check, unless the PR carries the `visual-change` label. The owner's signal stays simple: the tests pass or fail. The frames exist for agents: on a failure, CI uploads the expected, actual, and diff images, and a local run writes them to disk, so an agent can read them with vision and find the cause.

The functional Playwright suite runs on three desktop engines and two phones, each with its own test account. The unit suite gets time limits that measure the code, not the machine, and a deterministic Blitz deal. A committed stress command proves the suite stays green under load. A read that times out, or that a newer read replaces, now aborts its request. Where the browser supports it, the Rounds disclosure animates its height on open and close. The theme change crossfades the whole page.

## User Stories

### Owner

1. As the owner, I want CI to fail when a PR changes how any screen looks or moves, so that an unintended visual change never reaches the live site.
2. As the owner, I want a single pass or fail signal, so that I do not have to review screenshots myself.
3. As the owner, I want an intended visual change to pass when its PR carries the `visual-change` label, so that UI work is not blocked.
4. As the owner, I want merging a PR to make its frames the new baseline, so that I never update baseline files by hand.
5. As the owner, I want a red run to mean a real failure, so that I can trust the checks.
6. As the owner, I want the live deploy to wait for every CI job, so that a red e2e or screenshot job blocks the deploy.
7. As the owner, I want a PR that changes only docs to skip the screenshot jobs and the functional suite, so that it does not spend runner minutes.
8. As the owner, I want a new push to cancel the older run of the same PR, so that superseded runs do not spend runner minutes.
9. As the owner, I want a CI run to finish in about 10 minutes, so that a PR is not blocked for long.

### Agents (debugging)

10. As an agent, I want the frames of a failed screenshot test (expected, actual, diff) uploaded from CI, so that I can read them with vision and find the cause.
11. As an agent, I want a local screenshot run to write the same frames to disk, so that I can debug without CI.
12. As an agent, I want frames at fixed times after an interaction, so that I can see where in a motion it went wrong.
13. As an agent, I want the Playwright HTML report and traces of a failed run, so that I can follow each step.
14. As an agent, I want screenshots to show the same data on any day, so that a failure means a change in the code, not in the date.
15. As an agent, I want a request that has no stub to fail the screenshot test, so that a screenshot never depends on the network.
16. As an agent, I want CI to fail when a REST stub fixture no longer matches the shape of the real response, so that the screenshots do not drift from the real API.
17. As an agent, I want `pnpm test:stress` to run the unit suite under CPU load and name each failed test, so that I can check a change for load flakes.

### Screenshot coverage

18. As the owner, I want every motion captured as a frame sequence: the Daily tile pop, the row shake, the divider draw, the delayed Reveal rise, screen changes, Daily switcher and History switcher changes, Blitz phase changes (Arena, Run, End card), the Codex reorder, the Miss popover open and close, dialogs open and close, the Rounds disclosure, the theme crossfade, the fresh Codex card pop, and the Nav and switcher color changes. (Firefox takes only the end frame of a view transition.)
19. As the owner, I want every screen and state at rest captured once in each viewport and theme (for example a fresh, won, and lost Daily; the Archive; History; the Arena, a Run, and the End card; the Codex; dialogs; the Account menu; the Leaderboards tab), so that Spec 7's mostly static changes are guarded.
20. As the owner, I want each motion captured at 375 px and 1024 px, in light and dark, so that a layout or theme bug at one size is caught.
21. As the owner, I want each motion captured again with reduced motion, so that a motion that ignores the setting is caught.
22. As the owner, I want the screenshots taken in Chromium, WebKit, and Firefox, so that Safari and Firefox players are covered (Firefox without mid-transition frames of view transitions).
23. As the owner, I want signed-in screens in the gate, so that the Account menu, Leaderboards, and the Name confirm are guarded too.
24. As the owner, I want a changed duration or easing to fail the gate, so that timing changes are never silent.

### Functional e2e

25. As the owner, I want the functional Playwright suite to run on Chromium, Firefox, and WebKit at desktop size, so that each engine is tested.
26. As the owner, I want it to run on a Pixel 7 and an iPhone 14 profile with touch, so that phone players are tested.
27. As the owner, I want each browser project to sign in with its own test account, so that each project tests the same path and the projects can run in parallel.
28. As the owner, I want no Playwright retries, so that a flaky test cannot pass quietly.

### Unit suite

29. As the owner, I want the unit suite to pass on a loaded machine, so that a red run is a real failure.
30. As a developer, I want the Blitz page to take its random source from the app, so that a test can choose the deal.
31. As a developer, I want no test to re-render until a random deal fits, so that every test does a fixed amount of work.

### Read timeout

32. As a player, I want a read that passes the 10-second timeout, or that a newer read replaces, to stop its request, so that a late response cannot change anything and no request runs for nothing.

### New motion

33. As a player whose browser supports it, I want the Rounds disclosure to grow when I open it and shrink when I close it, so that the list does not jump.
34. As a player, I want the theme change to crossfade the whole page, so that the change of colors is not a flash.
35. As a player who prefers reduced motion, I want both changes to stay instant, so that nothing moves.
36. As a player whose browser lacks support, I want both changes to stay instant, so that nothing breaks.

## Implementation Decisions

### Terms used in this spec

- **Screenshot gate**: the Playwright suite that captures frames and compares them with the baseline.
- **Frame**: one screenshot of the page with every animation frozen at a given time after an interaction, or at rest.
- **Baseline**: the frames from a green master run, stored as a CI artifact. A PR uses the baseline of its merge-base commit.
- **Stub build**: a site build whose backend address points at a stub host that only Playwright answers.
- **Functional suite**: today's Playwright suite against the local Supabase stack.
- **Rounds disclosure**: the `<details>` element with a "Rounds (n)" summary that opens a Round log, in History and in the Arena's last run.
- **Switch-over day**: the `SWITCH_OVER_DAY` constant (2026-10-04), the day the Dailies moved to the backend (Spec 5).

These are tooling or code terms. They are not glossary entries (see author call 2).

### Screenshot gate: data

- The gate runs against the stub build. Playwright answers every request to the stub host from committed fixtures: the current Dailies function, the catalog, the Schedule, the Global stats view (`daily_global_stats`), the auth endpoints the Supabase library calls at startup (at least the current user and the token refresh; the first gate ticket confirms the list), and the Account, Sync, and Leaderboard reads. Any other request is aborted and fails the test, except requests to the preview server that serves the stub build itself (the page, scripts, and styles).
- The fixtures hold a snapshot of the real catalog as the local stack imports it (74 entries, from the catalog import migration), a hand-written Schedule around one fixed date, and fixed global stats and Leaderboard rows. The fixed date is 2026-10-10, six days after the switch-over day (2026-10-04), so puzzle numbers and the Archive have rows before it. The prototype used the same day.
- Signed-in screens: before load, the test stores a fixed sign-in with a far-future expiry under the key the app derives (`sb-` plus the stub host's first label plus `-auth-token`), and the stubs answer the auth and Account reads. A bump of the Supabase library must re-run the signed-in gate tests, because the shape check does not cover this storage format.
- The device clock is installed at a fixed moment (`clock.install`; the first gate ticket verifies which page timers it fakes). Each test moves time forward on purpose for timers it needs (for example the Blitz countdown or the 1.5-second Sync delay). An init script replaces `Math.random` with a seeded generator.
- A shape check, in the `sql-tests` job (which already starts the local stack), reads each stubbed REST endpoint from the real stack and compares its keys and value types with the committed fixture. A difference fails the job. It does not cover the auth storage format. It runs on every PR, docs-only PRs included.
- The functional suite keeps running against the local stack; only the gate uses stubs.
- The gate has its own Playwright configuration, with its own web server on the stub build. Each screenshot job builds the stub build itself.

### Screenshot gate: freezing frames

- After an interaction, the helper waits for earlier motion to finish, then waits for the named target animation (a keyframe name such as `pop`, or a `::view-transition-*` pseudo-element). It then pauses every running animation and, for each listed time, sets each paused animation's `currentTime` and takes a screenshot. Waiting for the named target is required: in the prototype, the first try caught the pointer's focus-ring transitions instead of the tile pop.
- The helper polls from the test process (repeated page evaluations), never with page timers or `requestAnimationFrame`: `clock.install` fakes `setTimeout`, `setInterval`, and `Date` (and may fake `requestAnimationFrame`), so in-page polling would stall. The first gate ticket verifies this list.
- Screenshots use Playwright's `toHaveScreenshot` with `animations: "allow"`, because the default (`"disabled"`) finishes paused animations.
- `document.getAnimations()` does not list the `::details-content` transitions of the new Rounds height in Chromium. The helper must freeze them by another route (suggestions only: pausing the document timeline, or driving the height transition through a named, listable animation). Choosing the route is part of the gate's first ticket, proven with a frame that shows a half-open disclosure.
- Each test lists its frame times in milliseconds, chosen from today's durations (Spec 3, "Durations and easing", and this spec's new motion): 0, about every quarter, and the end. For example, one 150 ms `pop` gives 0, 40, 75, 110, 150; the Daily tile pop plays two staggered pops that end at 190 ms, so its times run to 190. A changed duration or easing changes the frames.
- Comparison is exact, with no pixel tolerance. A tolerance is added only for a real, reproduced flake.

### Screenshot gate: matrix and engines

- Every motion and every screen at rest runs at 375 × 812 and 1024 × 768, in light and dark. Every motion runs again with reduced motion.
- Chromium and WebKit take every frame. Firefox takes the screens at rest and the motions that are not view transitions, plus only the end frame of each view transition, because its screenshot draws the live page instead of the view-transition overlay (cause unverified).
- All screenshots render in the pinned Playwright Docker image (`mcr.microsoft.com/playwright`, at the repo's Playwright version), so fonts and rendering match between runs. The app uses the system font stack, so the image fixes the font.
- Estimated size: up to about 440 frames per engine (Firefox fewer), about 1,300 in all, roughly 55 to 80 MB per master push across the three engine artifacts (about 18 to 27 MB each).
- The Rounds height animates only where the browser supports `::details-content` and `interpolate-size` (Chromium today; other engines unverified). Where it does not, that engine's Rounds frames show an instant change, and the baseline records that.
- The screenshot jobs run Playwright in a container with `--ipc=host`, and set up Node and pnpm as the other jobs do.

### Baselines

- No baseline image is committed to git.
- On a master push or a manual run on master, each screenshot job captures its engine's frames and uploads them as that engine's baseline artifact, kept 30 days. A master push does not compare frames: the PR that merged was already compared or labelled, and merging approves its frames. A baseline counts only when the whole master workflow run concluded with success (deploy included; a failed deploy makes later PRs capture the merge-base themselves); the PR job checks that before it downloads. Downloading another run's artifact needs the `actions: read` permission and a lookup of the run by commit.
- A PR job computes its merge-base with `git merge-base` on a full fetch, then downloads the baseline of the master run for that commit, so the PR sees only its own changes. If that run is missing, red, or expired, the PR job first captures the merge-base commit in the same job. A red master run never serves as a baseline.
- A PR with the `visual-change` label captures its differences, uploads them like a failure's, and passes: the compare step still runs, and the job ignores its failure only when the label is present. Without the label, a difference fails the job.
- The `pull_request` trigger adds the `labeled` and `unlabeled` events, so adding or removing the label starts a new run. The job reads the label from its own run's event.
- On a failure, CI uploads the expected, actual, and diff images of each failed frame, with the HTML report and traces, kept 14 days. Passing runs upload nothing.
- A local run captures frames to `test-results/`. It compares only when an agent downloads a baseline, and only inside the pinned Docker image, because renders outside it differ.

### Functional suite

- Five Playwright projects: Chromium, Firefox, and WebKit at desktop size, plus the "Pixel 7" and "iPhone 14" device profiles.
- Five seeded test users, one per project (for example `test-chromium@portdle.local`). Each project signs in as its own user, so the projects can run in parallel: `workers` rises from 1 to 5, and the configuration comment about one shared account is updated. The seed and the e2e helpers change from one user to five. The signed-in tests keep their rerun-safe design, now per user.
- `retries: 0`, set explicitly in the configuration for every run, local and CI. The `sql-tests` job installs Chromium, Firefox, and WebKit. On a failure, CI uploads the Playwright HTML report and traces (`trace: "retain-on-failure"`), kept 14 days, with no video.

### CI layout and schedule

- Jobs: `build` as today; `sql-tests` adds the fixture shape check and runs the functional suite on all five projects; three screenshot jobs, one per engine, in the pinned Docker image, against the stub build.
- Every job runs on every PR and every master push, with one exception: on a PR where every changed file is under `docs/` or is a `*.md` file, the screenshot jobs and the functional-suite step of `sql-tests` skip. A first step detects the changed files, and the later jobs and steps check it. `build` and the shape check always run, and a master push always runs everything.
- A new push cancels the older run of the same PR (a concurrency group). Master runs are never cancelled, because each one produces a baseline.
- Deploy waits for every job: its `needs` list grows from `build` to every job. Deploy runs only on master pushes and manual runs, where nothing skips.
- Target: about 10 minutes of wall time per run. Above it, the screenshot jobs split into shards.
- Accepted cost: about 25 to 35 runner-minutes per run, roughly 5,000 to 7,000 a month at the last 30 days' pace (206 CI runs), likely above the plan's included private-repo minutes.

### Unit suite stability

The reproduction (Task: reproduce the flaky tests, #214) found three causes, none a race in app code: full-App tests past the 5-second test timeout; the Blitz tests that re-render until a random deal fits; and the row-sync test whose `findByRole` waits only 1 second for the Name confirm. `name-confirm.test.tsx` never failed and gets no separate fix.

- **Time limits**: Vitest `testTimeout` and `hookTimeout` rise to 30 seconds, and Testing Library's `asyncUtilTimeout` rises to 10 seconds, set once for the whole suite (the Vitest configuration and the test setup file). The tests wait on nothing real, so the old limits measured machine load.
- **Blitz deal**: the Blitz engine already takes a random source; the Blitz page passes `Math.random` in four places. The page now takes its random source from the App: a new App prop, passed into the router context as a new field (the router context type gains it), the same way `persist` travels, with `Math.random` as the default. The page's four call sites read it there. Every test that re-rendered until a random deal fit uses a scripted source instead; the retry helpers `startInvertedWhere` and `startInvertedSamePortMiss` are removed.
- **Stress command**: `pnpm test:stress [runs]` (5 runs by default) runs the full unit suite beside two CPU burners per core and prints each failed test's name. It is not a CI job.

### Read timeout

- A server read (the current Dailies, the catalog, the Schedule, global stats) receives an abort signal. When the 10-second read timeout fires, the read helper aborts the request as well as marking the read failed. A cancelled read (a newer read replaced it, or the screen went away) aborts its request too.
- The Supabase adapter passes the signal to `fetch`. An abort counts as a failed read, as a timeout does today.

### Rounds disclosure height

- The Rounds disclosure (History, and the Arena's last run) animates its height from closed to open and back with CSS only: `::details-content` with `interpolate-size: allow-keywords`, a height transition from 0 to `auto`, and `content-visibility` with `allow-discrete`, 200 ms `ease-out`.
- It replaces today's `rise` on the opened list, so the two do not stack.
- Browsers without support open instantly. Reduced motion is instant: the universal reduced-motion rule gains `*::details-content`, because today it covers only `*`, `*::before`, `*::after`, and `*::backdrop`.

### Theme crossfade

- The theme toggle runs its change through the existing view-transition helper with a new `theme` transition type. Under that type, the whole page crossfades at once for 250 ms `ease-out`: the Top bar and Nav, which hold still under other view transitions, crossfade with the rest.
- Reduced motion and browsers without the API change instantly, through the helper's existing checks.

### No polyfill

Browsers without the View Transitions API, or without transition types, keep changing instantly. Neither existing polyfill supports transition types, so the type-keyed motion would still not run.

## Testing Decisions

- Good tests assert what the player sees or what the user-facing contract promises, never internal calls.
- **Screenshot gate** (new Playwright suite, stub build): one frame sequence per motion and one frame per screen at rest, across the matrix and engines above. The suite is itself the test of the new motion. Prior art: the existing Playwright suite (its page helpers and how-to dismissal), and the frozen-frame prototype on branch `prototype/frame-gallery`.
- **Freeze helper**: proven by the first gate ticket with a half-open Rounds disclosure frame and a mid-pop frame that each differ from the start and end frames.
- **Fixture shape check**: fails when a fixture lacks a key the real response has, or has a different value type. Proven by breaking one fixture by hand.
- **Functional suite**: the existing five tests (in two spec files), unchanged in what they assert, on five projects with five accounts.
- **Unit suite**: no new test for the raised limits; the stress command is the check. The Blitz tests that used the retry helpers assert the same outcomes with a scripted random source. Acceptance: `pnpm test:stress` passes 5 of 5 runs.
- **Read timeout**: unit tests for the read helper with a fake clock and a fake `fetch`: a read past the timeout aborts its request and is marked failed; a read cancelled before it settles aborts its request; a late response after the abort changes nothing. Prior art: the existing server store tests and the injected `fetch` in the Supabase adapter tests.
- **Theme crossfade**: an App-level test that the theme toggle still flips the theme and stores it when the View Transitions API is missing (jsdom). The motion itself is covered by the gate.

## Out of Scope

- A human-facing gallery page; the frames are for agents.
- Baseline images committed to git or Git LFS.
- PR preview deploys (stay in backlog #211).
- Lighthouse work: SEO, performance, accessibility, best practices (Spec 7).
- A View Transitions polyfill.
- A Firefox phone profile (Playwright emulates only its viewport).
- A CI job that runs the stress command.
- Playwright retries.
- Rewriting slow unit tests to be cheaper.
- Changes to Spec 3's existing motions, beyond replacing the opened Rounds list's `rise`, adding the `theme` type, and adding `*::details-content` to the reduced-motion rule.

## Further Notes

### Supersedes

- Spec 3, "Animating the height of a Rounds disclosure" out of scope → the CSS-only height.
- Spec 3, "A theme-toggle crossfade or any transition on the change of color scheme" out of scope → the whole-page crossfade.
- The t193 spec, "Cross-browser runs (Chromium only) and mobile viewports", "Uploading the Playwright report or traces from CI", and "Visual regression and motion checks" out of scope → the five projects, the failure uploads, and the screenshot gate.
- The t67 spec, "Automated visual-regression or screenshot tooling" out of scope → the screenshot gate.
- The t27 spec, "Stabilizing the existing Blitz test that spends a life using real `Math.random()`" out of scope → the injected random source.
- The t187 spec, "An abort of the underlying `fetch` on timeout" out of scope → the aborted read.

### Author calls accepted by the owner during the map (2026-10-04)

- Fixed data: the functional suite stays on the local stack; an unstubbed request fails the test; Spec 6 picks the fixed date after the switch-over day; the shape check runs in `sql-tests` (#216).
- Baselines: the `visual-change` label; failure-only uploads; 30-day baseline retention with a master capture fallback; only green master runs become the baseline; exact compare (#218).
- Breadth: failure report and traces kept 14 days, no video; the CI job layout; deploy waits for every job; the docs-only rule; the 10-minute target (#219).
- New motion: 200 ms height and 250 ms crossfade, both `ease-out`; the height replaces the list's `rise`; the whole page crossfades; the theme change uses the view-transition helper with a `theme` type (#220).
- Flaky fixes: the random source reaches the Blitz page like `persist` (#221 said "like `persist` and `remote`", but `remote` reaches the router context as `backend`); every random-retry test switches to a scripted source; the stress command's defaults; the limits; no separate `name-confirm` fix (#221).

### Author calls made while writing (for the owner to accept or overrule at the spec gate)

1. No new ADR. The decisions are test and CI tooling, recorded here and on the map; no ADR changes.
2. No new glossary entries: the screenshot gate's terms are tooling, not player-facing.
3. The theme crossfade has no new unit test beyond the no-API case; the gate covers its motion.
4. The freeze route for `::details-content` is chosen by the first gate ticket, with proof, not in this spec.
5. The cancelled-read abort (story 32) also covers a read that a newer read replaced, not only the timeout.
6. The fixed date is 2026-10-10 (#216 left the exact day to this spec).
7. A master push captures and uploads the baseline but does not compare frames, inferred from #218's "merging approves a change": the label exists only on PRs, so a compare on master would fail every labelled merge.
8. Mechanics not named by a ticket: one baseline artifact per engine; a baseline counts only when the whole master run succeeded; master runs are never cancelled; adding or removing the label starts a new run; a labelled run uploads its differences; a manual run on master also uploads a baseline; failure frames are kept 14 days like the report.
9. Scope details not named by a ticket: the reads that get the abort signal, and an abort counting as a failed read; `retries: 0` set explicitly for local runs too; the Name confirm among the signed-in screens; the shape check running on docs-only PRs; each screenshot job building its own stub build; the reduced-motion rule gaining `*::details-content`.
10. A local run is capture-only unless an agent downloads a baseline and runs inside the Docker image.
11. The Supersedes list below cites earlier ticket specs; no ticket listed these supersessions.

### Owner decisions at the spec review (2026-10-04)

- Changing #218: a PR compares against the baseline of its merge-base commit, not the newest green master run, because a PR that is behind master would otherwise fail on frames it never touched.

### Known risks

- Runner minutes: the estimate is likely above the plan's included minutes; the plan and usage could not be read (the token lacks the `user` scope).
- Artifact storage: 55 to 80 MB of baseline per master push, kept 30 days, against a 500 MB private-repo artifact quota, with failure uploads on top. Frequent master pushes can reach the quota.
- Firefox's view-transition screenshots show the end state; the cause is unverified.
- The faked sign-in depends on the Supabase library's storage format, which the shape check does not cover.
- Accepted costs from the map: a truly hung unit test takes 30 s to fail instead of 5 s, and a new load flake is caught only when someone runs the stress command (#221); a catalog edit does not change the frames until someone refreshes the snapshot (#216); the Rounds height animates only in supporting browsers, Chromium today (#220).

### Primary sources

- Research: screenshot tooling (#213): branch `research/screenshot-tooling`, `docs/research/screenshot-tooling.md`.
- Research: View Transitions polyfills (#215): branch `research/view-transitions-polyfills`, `docs/research/view-transitions-polyfills.md`.
- Task: reproduce the flaky tests (#214): the resolution comment holds the commands and failure rates.
- Prototype: frame gallery (#217): branch `prototype/frame-gallery`.
- Prototype: new motion (#220): branch `prototype/new-motion`.
