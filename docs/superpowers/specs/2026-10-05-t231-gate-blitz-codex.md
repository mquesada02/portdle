# Ticket spec: Gate frames for Blitz and Codex

Spec for #231. CI means continuous integration. Tracker: https://github.com/mquesada02/portdle/issues/231. Parent: Spec 6 (tests, CI, and motion), https://github.com/mquesada02/portdle/issues/222 (`docs/superpowers/specs/2026-10-04-spec6-tests-ci-motion.md`, stories 18–21, "Screenshot gate: data", "Screenshot gate: freezing frames", "Screenshot gate: matrix and engines"). Map: https://github.com/mquesada02/portdle/issues/212. Gate tracer: `docs/superpowers/specs/2026-10-05-t227-gate-tracer.md`. Base branch: `master`. Blocked by: #227 (merged, PR #240).

## Problem Statement

The gate (#227) guards one motion (the Daily tile pop) and one screen (the fresh Daily). A change to a Blitz phase change, to the Codex reorder, to the fresh Codex card pop, or to the Rounds disclosure reaches review only when the owner opens the site. The Arena, the Setup dialog, a Run, the End card, and the Codex have no frame at all.

## Solution

Four new gate files add the frames that ticket #231 lists, on the existing gate: the Blitz motions and screens (`gate/blitz.spec.ts`), the Codex motions and screens (`gate/codex.spec.ts`), a seed helper (`gate/seed.ts`), and a motion wrapper (`gate/motion.ts`). The helper stores a Blitz last run, the Bests, and a Codex in the page before it loads, so that every frame shows the same data. The Prompts of a Run come from the gate's seeded `Math.random`. The tests reuse `waitForQuiet`, `shootMotion`, `openGame`, and `expectEndFrame` of the gate, and `isReduced` and the `test` of `gate/fixtures.ts`. The one edit to a shared file is an additive hold in `shootMotion` of `gate/freeze.ts` (see "Hold"). No app code changes. The temporary probe files of the author are not committed. The pull request carries the `visual-change` label, because it adds frames that have no baseline.

## User Stories

1. As the owner, I want the Blitz start (Arena to Run) captured as a frame sequence, so that a change to the phase rise is caught.
2. As the owner, I want the Blitz last life lost (Run to End card) captured as a frame sequence, so that a change to that phase change is caught.
3. As the owner, I want Play again (End card to Arena) captured as a frame sequence, so that the third phase change is guarded too.
4. As the owner, I want the Codex reorder (a sort change) captured as a frame sequence, so that a change to the card glide is caught.
5. As the owner, I want the fresh Codex card pop captured as a frame sequence, so that a change to the pop on a new card is caught.
6. As the owner, I want today's Rounds disclosure (the `rise` of its list) captured as a frame sequence, so that ticket #233 can compare its new height motion with today's.
7. As the owner, I want the Arena with a last run and Bests at rest, so that the first Blitz screen is guarded.
8. As the owner, I want the Setup dialog at rest, so that its look is guarded.
9. As the owner, I want a Run at rest, so that the Run screen is guarded.
10. As the owner, I want the End card at rest, so that the End card screen is guarded.
11. As the owner, I want the Codex at rest in the Name sort and in the Port sort, so that both orders are guarded.
12. As a developer, I want every Blitz Prompt to come from the gate's seeded random source, so that every run shows the same Prompts.
13. As a developer, I want each frame at 375 × 812 and 1024 × 768, in light and dark, so that the matrix of the spec is proven.
14. As a developer, I want every motion to run again with reduced motion, so that a motion that ignores the setting is caught.
15. As a developer, I want the frame times to be fixed milliseconds from today's durations, so that a changed duration or easing changes the frames.
16. As a developer, I want the new tests to reuse the gate helpers, so that the gate has one freeze route.
17. As a developer, I want the new tests to leave no unstubbed request, so that no frame depends on an unseen request.
18. As the author of ticket #233, I want the Rounds frames to exist in the gate, so that I extend them and do not create them.

## Implementation Decisions

- **Seam**: the stub build in a real browser, the same seam as the tracer. The gate asserts frames, not internal functions. There is no new pure code that needs its own unit test.
- **Files**: `gate/blitz.spec.ts`, `gate/codex.spec.ts`, `gate/seed.ts`, and `gate/motion.ts` (new). The motion wrapper `shootOrEnd` holds the branch that both spec files share. With motion, it calls `shootMotion`. With reduced motion, it runs the interaction, waits for the result, and calls `expectEndFrame`. The files `gate/state.ts` and `gate/fixtures.ts` (tickets #230 and #232) already hold `openGame`, `expectEndFrame`, and `isReduced`, so this ticket reuses them. No edit to `gate/stub.ts`, `gate/fixtures.ts`, `gate/state.ts`, the configuration, the runner, or CI. One small additive edit to `gate/freeze.ts`: the hold and its release (see "Hold").
- **Seed helper**: `seed.ts` exports a function that adds an init script. The script writes the stored Blitz runs, Bests, Codex, and Codex sort before the app reads them. It runs on every document load, so each test loads the page once. It runs after the base init script of `fixtures.ts`, which stores the How-to flag and the theme. The values are literal fixtures in the gate folder's helper, in the shapes of `src/engine/types.ts`.
- **Seeded data**: one last run (Mixed, Default, Sprint, ended by the clock, score 2, with four rounds: two with the outcome `correct` and two with the outcome `miss`; each miss has a typed Wrong answer, as a Default run makes) with a fixed `endedAt`.
  Two Bests rows, both Sprint (`mixed|default|sprint` and `protocols|default|sprint`), so the Survival Run of the End card has no stored Best and shows the New best badge. 
  A Codex of four seen protocols: Echo (Correct, fresh), Discard (Missed), Daytime (Identified, fresh), and chargen (Correct, fresh). A frame shows the viewport only. The first rows are the only visible ones: at 375 px (two columns, with the fixed nav bar) the first eight cards, and at 1024 px (four columns) the first sixteen. The four cards sit at positions 3, 4, 6, and 8 of the Name sort and 1 to 4 of the Port sort, so they show in both sorts at both sizes. The Applications sit below the 48 protocols, out of view. All three Codex states show. Entries come from the catalog fixture. The Name sort is the stored sort unless a test stores Port.
- **Deal and guesses**: a Run starts through the Setup dialog. The dialog opens on the last run's Sprint, so the test selects Survival (Mixed and Default stay): no countdown shows, so the clock that flows at the real rate changes no frame. The Prompt comes from the seeded random source. The test reads the Prompt's name from the page, finds the entry in the catalog fixture, and types the digits of its port (a correct guess), or the same number of one repeated digit (a wrong guess: `1`, or `2` when the port starts with `1`; so it never equals the port). The test presses Enter to submit each guess. The End card test plays one correct guess, then three misses (three Lives), so the card shows a score of 1, the Best, the New best badge, and four rounds.
- **Blitz motions**: three view-transition phase changes, each frozen on `::view-transition-new(screen)`, the `rise` of 150 ms: Start (the Setup dialog's Start button), Last life (the third miss), and Play again. Times: 0, 40, 75, 110, and 150 ms. Verified on 2026-10-05 in Chromium: after a Start, `document.getAnimations()` lists `rise` on `::view-transition-new(screen)`. After a sort change, it lists `-ua-view-transition-group-anim-codex-<id>` on `::view-transition-group(codex-<id>)`. So the helper's pseudo-element target works. The Setup dialog closes in the same update as the Start phase change, so the Start frames show the new Run rising and no dialog (the frames were checked by eye).
- **Codex reorder**: the Port radio of the sort toggle, frozen on `::view-transition-group(codex-echo)`. Echo is the first card of the Port sort and the eighth of the Name sort, so it shows in the viewport at the start and at the end of the sequence. The group tween runs 200 ms (`reorder` type). Times: 0, 50, 100, 150, and 200 ms. The test loads the Codex page directly (no screen view transition runs). The stored sort is Name.
- **Fresh Codex card pop**: the test loads the Codex page directly, so no view transition plays. The helper freezes `pop` (150 ms) on the three fresh cards together. Times: 0, 40, 75, 110, and 150 ms. The interaction is the page load, and it waits until the Codex shows its cards. The hold keeps each pop at its start, so a slow load cannot make the helper miss the pop. The helper's wait for earlier motion runs before it, on the blank page.
- **Rounds disclosure**: the Arena's last run, a click on the "Rounds (4)" summary. The helper freezes the `rise` of the opened list (150 ms, `details[open] > ul`). Times: 0, 40, 75, 110, and 150 ms. Today the list rises and the disclosure does not animate its height. Ticket #233 changes this and extends the same frames.
- **Screens at rest** (not in the reduced projects, as the tracer does): Arena with a last run and Bests; Setup dialog open; Run (first prompt, nothing typed); End card; Codex in Name sort; Codex in Port sort (the stored sort is Port; its frame is a separate test from the reorder). Frame names carry the topic: `blitz-arena`, `blitz-setup`, `blitz-run`, `blitz-end`, `codex-name`, `codex-port`; the project name is added by the snapshot path.
- **Motion frame names**: `blitz-start-<time>ms`, `blitz-last-life-<time>ms`, `blitz-play-again-<time>ms`, `codex-reorder-<time>ms`, `codex-card-pop-<time>ms`, `blitz-rounds-rise-<time>ms`. With reduced motion, each test takes one end frame, named `<same name>-end`.
- **Hold** (owner decision of 2026-10-05): a poll of `shootMotion` runs from the test process. It can come after a 150 ms or 200 ms animation ends, when the page is busy (a loaded machine, a page that is loading, or a Codex reorder with 370 view-transition animations). So `shootMotion`, after its wait for quiet and before the interaction, calls `holdStarts` of `gate/freeze.ts`. For a view-transition target, `holdStarts` wraps `document.startViewTransition` so that, when the transition is ready, the rate of every animation becomes 0. For a keyframe target, it adds a capture listener for `animationstart` that sets the rate of the starting element's animations to 0 (an init script covers a page that the interaction loads, and an evaluation the page that is open). A CSS-transition target (`transition:<property>`) is not held. An animation with rate 0 still counts as running for the poll, which then pauses it and sets its time. After the last frame, `shootMotion` calls `releaseStarts`, which clears the `__holdStarts` flag on the current document, so later animations on it run as usual. Frames do not change: the helper sets every time. Every keyframe and view-transition frame sequence of the gate gets the hold, the Daily ones too.
- **Reduced motion**: as the Daily tests: the test opens the page with `openGame`, which logs every animation and transition that starts. With reduced motion, the test runs the interaction, waits for the result, and calls `expectEndFrame`. That helper asserts that the log is empty and takes one end frame, named `<name>-end`. The Codex pop test opens the page with `openGame` only with reduced motion. With motion, the page must load inside the interaction, so that the hold sees the pop start.
- **Reorder and Codex data**: the reorder test stores a Codex with no fresh card, so no `pop` runs before the capture of the old state. It changes the sort with the keyboard (Space on the focused Port radio), because a pointer over the tab starts a hover color transition at an unpredictable time, which a freeze would catch half done. The pop test stores the fresh cards.
- **Time zone**: each new spec file calls `test.use({ timezoneId: "UTC" })` (UTC means Coordinated Universal Time), so the local time of a run (the seeded run and the one just played) is the same in every environment. The clock starts at 12:00:00 and flows. The Arena that follows Play again shows the time (hours and minutes) of the Run just played, so the Run of the Play again test must end within the first minute after the clock install. The End card shows no time. Only the Play again frames carry this risk.
- **Matrix**: the existing eight projects (two viewports, light and dark, with and without reduced motion). The tests select by the project's reduced-motion setting, like the tracer's tests.
- **PR label**: the pull request adds frames without a baseline, so the gate job reports differences. The pull request body says so, and the `visual-change` label is added once the frames are final.

## Testing Decisions

- A good test drives the stub build as a player does and asserts frames. The gate is its own test. Checks, run and recorded in the pull request: `pnpm gate:capture`, then `pnpm gate` against it passes with no difference, twice, on the same machine (the pinned image is the check of the CI job); the middle frames of each motion differ from its first and last frames (the freeze works); the unstubbed-request list is empty in every test; `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- Prior art: `gate/daily.spec.ts` (frames, reduced-motion branch, `waitForQuiet`), `gate/freeze.ts`, and the unit tests that script a Blitz deal (`src/test/blitz.ts`).
- The first run of the gate confirms that the four seeded Codex cards show in both sorts at both sizes.
- Before each commit and before the final `pnpm gate` run, the author deletes the two temporary probe files (`gate/probe.spec.ts` and `playwright.local.config.ts`).
- The first full run in CI is the check in the pinned image. If a frame is not stable there, the pull request fixes the cause (not a tolerance).

## Out of Scope

- The Daily, the Archive, History, and the signed-in screens (tickets #230 and #232).
- The Rounds height motion and the `::details-content` freeze route (ticket #233).
- A Sprint or Marathon run with a visible countdown, and the "Time's up" End card (see Author calls).
- The Leaderboards tab and the Miss popover (other tickets). The open and close motion of the Setup dialog has no ticket yet; the coordinator adds it to backlog #211.
- WebKit and Firefox projects (later tickets). The new tests use the project matrix, so a new engine runs them.
- Any change to app code.

## Further Notes

### Author calls

The owner accepted calls 1 to 15 on 2026-10-05, through the coordinator. The gap of the Sprint countdown and the "Time's up" End card goes to backlog #211.

1. Four new files (`gate/blitz.spec.ts`, `gate/codex.spec.ts`, `gate/seed.ts`, `gate/motion.ts`) and one additive edit to `gate/freeze.ts` (call 14). The owner chose the fourth file on 2026-10-05, to avoid a copy of the wrapper in both spec files.
2. A Run and the End card use Survival (the test selects it), so no countdown shows. The "Time's up" End card and a Sprint Run are not covered.
3. The last run, the Bests, and the Codex come from stored data (an init script), not from play, except for the End card and the phase changes, which play a real run.
4. The three Blitz phase changes are Start, Last life, and Play again.
5. Frame times: 0, 40, 75, 110, 150 ms for the 150 ms motions; 0, 50, 100, 150, 200 ms for the 200 ms reorder.
6. The Rounds disclosure is the Arena's last run only; History's disclosure belongs to #230.
7. The reorder target is the group of one card (`codex-echo`) that moves between the sorts and shows in the viewport in both.
8. The Codex pop and the Codex at rest load the Codex page directly, so a screen transition never mixes with the pop.
9. A wrong guess is the same number of one repeated digit (`1`, or `2` when the port starts with `1`), and a correct guess is the prompt's port from the catalog fixture, both found from the prompt's name on the page.
10. Reduced motion takes one end frame per motion and asserts, through the motion log of `openGame` and `expectEndFrame`, that no animation or transition started (tracer call 6; the log is the one of tickets #230 and #232).
11. The tests fix the time zone to UTC with `test.use`, so the local times in the Arena do not depend on the machine.
12. The seeded Codex holds four protocols, among the first eight cards of both sorts, because a frame shows the viewport only. The Applications part of the Codex is not seen in any frame.
13. The Codex pop test loads the page and waits for the cards inside the interaction, relying on the hold (changed on 2026-10-05 from a commit-only load, which timed out on a loaded machine).
14. The hold of animations in the page lives in `shootMotion` of `gate/freeze.ts` (owner decision of 2026-10-05, call C): the helper's poll can miss a short animation on a loaded machine, and the Daily tile pop has the same race. Without the hold, the reorder test failed in about one run of three on a machine with load.
15. (Accepted 2026-10-05.) The reorder test stores no fresh card and changes the sort with the keyboard (see "Reorder and Codex data").
