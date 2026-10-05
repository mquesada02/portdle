# Ticket spec: Rounds disclosure height

Spec for #233. Tracker: https://github.com/mquesada02/portdle/issues/233. Parent: Spec 6 (tests, CI, and motion), https://github.com/mquesada02/portdle/issues/222 (`docs/superpowers/specs/2026-10-04-spec6-tests-ci-motion.md`, "Rounds disclosure height" and "Screenshot gate: freezing frames"). Map: https://github.com/mquesada02/portdle/issues/212. Decision: #220 (prototype: new motion). Gate: `docs/superpowers/specs/2026-10-05-t227-gate-tracer.md`. Base branch: `master`. Blocked by: #231 (done).

## Problem Statement

The Rounds disclosure (History, and the Arena's last run) opens and closes with a jump. Today the opened Round log plays a 150 ms `rise`, and the close has no motion. The screenshot gate has Rounds frames for the `rise` only. Chromium does not list the `::details-content` transition in `document.getAnimations()`, so the gate freeze cannot hold the new height motion yet.

## Solution

The disclosure animates its height with Cascading Style Sheets (CSS) only (decision #220, variant A): `::details-content` with `interpolate-size: allow-keywords`, height 0 to `auto` and back, `content-visibility` with `allow-discrete`, 200 ms `ease-out`. It replaces the `rise` of the opened Round log. The reduced-motion block gains a rule for `*::details-content` (author call 10). Where the browser lacks support, the disclosure opens and closes at once.

The freeze helper holds this transition through the Chrome DevTools Protocol (CDP) Animation domain. Checked on 2026-10-05 in Chromium 153 with Playwright 1.63: the transition starts no `transitionrun` event and has no entry in `document.getAnimations()` or `details.getAnimations({ subtree: true })`. The CDP `Animation.animationStarted` event lists it (two `CSSTransition` entries, `height` and `content-visibility`). `Animation.setPlaybackRate` with 0, sent before the click, holds the document timeline: the height stayed 0 px for 400 ms. `Animation.seekAnimations` then sets the time of the listed animations. Seeking to 0, 50, 100, 150, and 200 ms gave a computed height of 0, 37.8, 68.5, 90.6, and 100 px.

The gate takes an open sequence and a close sequence for the Arena's last run and for History, and one end frame per sequence with reduced motion.

## User Stories

1. As a player whose browser supports it, I want the Rounds disclosure to grow when I open it, so that the Round log does not jump.
2. As a player, I want the disclosure to shrink when I close it, so that the page below does not jump.
3. As a player with reduced motion, I want the disclosure to open and close at once, so that nothing moves.
4. As a player of a browser without `interpolate-size`, I want the disclosure to open and close at once, so that it still works.
5. As a developer, I want the opened Round log to stop playing `rise`, so that two motions do not stack.
6. As an agent, I want the gate to freeze the height transition at fixed times, so that I can see a half-open disclosure.
7. As an agent, I want a half-open frame that differs from the closed frame and from the open frame, so that I know the freeze works.
8. As an agent, I want the same frames for the open and the close, in the Arena and in History, at 375 × 812 and 1024 × 768, in light and dark.
9. As an agent, I want, with reduced motion, one end frame per sequence and a check that the transition duration is 0s, so that the reduced-motion rule is proven.
10. As a reviewer, I want the pull request (PR) to state, per engine, whether the height animates, so that an unsupported engine is a known fact and not a surprise.

## Implementation Decisions

- **CSS** (`src/styles.css`, in the existing `@layer components`, where `details[open] > ul` is today): remove the `details[open] > ul` rule. Add `details { interpolate-size: allow-keywords; }`, `details::details-content { height: 0; overflow: clip; transition: height 200ms ease-out, content-visibility 200ms allow-discrete; }`, and `details[open]::details-content { height: auto; }`. This is variant A of the prototype (branch `prototype/new-motion`), as a final rule. The universal reduced-motion block (`@media (prefers-reduced-motion: reduce)`) gains `*::details-content { transition: none; }` as its own rule, with a short comment. It does not join the selector list of the existing rule: a browser that cannot parse `::details-content` drops a whole rule with such a list, and the existing `animation: none; transition: none` rule for `*`, `::before`, `::after`, and `::backdrop` would be lost there. `animation: none` is not needed, because the Rounds disclosure has no animation on this pseudo-element. The header comment of the `@layer components` block that holds the `details` rules ("#91: dialogs and Rounds disclosures") stays true. The reduced-motion block is outside every layer, so its rule wins over the layered `details::details-content` rule.
- **Support**: checked on 2026-10-05 with Playwright 1.63. Chromium 153: `::details-content` and `interpolate-size` both supported, so the height animates. Firefox 155 and WebKit 26.6: `CSS.supports` is true for `::details-content` and false for `interpolate-size: allow-keywords`, so a change from height 0 to `auto` cannot interpolate and the disclosure changes at once. The gate has Chromium projects only today, so no Firefox or WebKit frame exists yet. The engine tickets of Spec 6 record those frames as instant changes. The PR states this per engine.
- **Freeze route** (`gate/freeze.ts`, a shared file, edited small and additive; the doc comment of `shootMotion` gains the new target kind). `shootMotion` accepts the target `::details-content` (a new branch, with an early skip of `holdStarts` and `releaseStarts`). The helper tests for this target before the generic `::` check, because that check means a view transition. The caller (see `shootDisclosure`) chooses it only in Chromium. The route has these steps, in this order:
  1. After `waitForQuiet`, open a CDP session with `page.context().newCDPSession(page)`, enable the Animation domain, and record each `Animation.animationStarted` entry in a list.
  2. Send `Animation.setPlaybackRate` with 0. This call sets the rate of the whole document timeline, not of one animation. It is a "hold at start" for the whole page: every animation that the interaction starts begins at rate 0, so none can end before the test acts. This removes the race of a hold that is set after the start. The helper does not call `holdStarts` for this target (it patches `startViewTransition`).
  3. Run `interact`.
  4. Poll from the test process until the recorded list has an entry named `height`. This poll replaces the `getAnimations()` poll of `shootMotion` for this target, and keeps its `TIMEOUT_MS` error. The poll does not use `getAnimations()`. The existing pause pass after `LATE_START_MS` still runs: it pauses the listed animations that are `running` (a focus-ring transition, for example).
  5. For each time, send `Animation.seekAnimations` for all listed ids with that time (a listed focus-ring transition is paused by the pass above, so the seek is harmless for it), then run the existing frame sync (two drawn frames) and the screenshot. The tolerance rule is unchanged.
  6. The CDP target skips `holdStarts` and `releaseStarts` (it never sets `__holdStarts`). In a `finally`, send `Animation.setPlaybackRate` with 1 and detach the session, so a failed assertion does not leave the timeline held.
  If a listed id is gone, the CDP call throws and the test fails with that error. The helper does not hide it.
- **Other engines** (owner condition, 2026-10-05; `shootDisclosure` is the only supported caller of the CDP route, and the route runs only when `browserName` is `chromium`): the CDP route is Chromium-only. #229 adds Firefox and WebKit (its PR #244 has `webkit-*` and `firefox-*` projects). The branch point is one new additive helper in `gate/motion.ts`, `shootDisclosure(page, { name, interact, done, reduced, browserName })` (it reads the style of the only `details` element of the page, `document.querySelector("details")`), which the four tests call (not `shootOrEnd`). The tests pass the `browserName` fixture. It works in three cases:
  - Chromium (`browserName === "chromium"`) with motion: `shootMotion` with the target `::details-content` and `TIMES_200`.
  - Reduced motion (any engine): `interact`, `done`, a check that the computed `transition-duration` of `::details-content` is `0s`, then `expectEndFrame` (`<name>-end`; the motion log is on, because `openGame` installs it for reduced motion).
  - Firefox or WebKit with motion: `interact`, `done`, then `restShot` (`shootDisclosure` builds the name `<name>-end` itself, so it matches `expectEndFrame`; no motion log needed). It records the instant change.
  The check reads `getComputedStyle(details, "::details-content").transitionDuration` through `page.evaluate`, on the only `details` element. It is verified only in Chromium. The worker checks it in WebKit and Firefox when #229 is merged. If those engines do not resolve the style, the check is limited to Chromium, and `expectEndFrame` runs alone in the other engines. The `done` checks of the close tests also run in the instant-change engines; the worker confirms them there too. The non-Chromium case is tested by a local WebKit run if #229 is merged first, and by code review (marked "code review only" in the PR) if not.
- **Frame times**: `TIMES_200 = [0, 50, 100, 150, 200]` in `gate/motion.ts` (the 200 ms duration, quarters, and the end). `REORDER_TIMES` in `gate/codex.spec.ts` has the same values and stays as it is (not our ticket). The first and last frames are exact. The frames between take the gate tolerance of 0.02.
- **Arena frames** (`gate/blitz.spec.ts`): the test "Rounds disclosure of the last run" becomes two tests. Open: frames `blitz-rounds-open-<time>ms` through `shootDisclosure`. Close: the Rounds disclosure is open at rest first, then frames `blitz-rounds-close-<time>ms`, also through `shootDisclosure`. The old frames `blitz-rounds-rise-*` go away.
- **History frames** (`gate/daily-motion.spec.ts`): a `test.describe` with `test.use({ timezoneId: "UTC" })` (the file has no time zone, and History shows `localTime`), a `beforeEach` that calls `seedStorage`, and an open test and a close test on `/portdle/history/blitz`, both through `shootDisclosure`. Each test opens the page with `openGame(page, testInfo, { path: "/portdle/history/blitz" })` (the reduced projects need its motion log), and `interact` clicks the `Rounds (4)` summary: `history-rounds-open-<time>ms` and `history-rounds-close-<time>ms`. The page shows one run with "Rounds (4)". The existing tests of the file stay outside the `describe`.
- **Starting the close sequence**, in this order: (1) open the page; (2) add a style tag with `details::details-content { transition: none }`; (3) click the summary and wait until the Round log shows; (4) remove the style tag (the computed height does not change, so no transition starts); (5) call `shootDisclosure` (its wait for quiet animations comes after step 4: `waitForQuiet` in the Chromium motion path, and the same wait inside `expectEndFrame` or `restShot` in the other paths). Steps 2 to 4 run in the test body, in every engine and case. The page is open and at rest.
- **Reduced motion**: see "Other engines". The `transition-duration` check lives in `shootDisclosure`, because the motion log cannot see this transition (it fires no event). `done` of the open tests waits until the Round log shows (`getByText("you typed").first()` is visible: the seeded run has two typed Wrong answers, so the text appears twice). `done` of the close tests waits until the Round log is hidden (`getByText("you typed").first()` is not visible; the worker confirms in the first run that Playwright sees the content as hidden, and uses another check if not). The close tests use the style-tag setup in all cases; the motion log stays empty, because every transition is `none` or absent.
- **Imports**: `gate/blitz.spec.ts` keeps `shootOrEnd` and `TIMES_150` (other tests use them) and adds `shootDisclosure`. `gate/daily-motion.spec.ts` adds `seedStorage` and `shootDisclosure`. The tests of both files take the `browserName` fixture.
- **Viewport**: the frames are viewport shots. The worker confirms in the first run that the Round log shows inside the 375 × 812 viewport in each frame, and sets `fullPage` for the sequence if not.
- **Matrix**: the gate projects (375 × 812 and 1024 × 768, light and dark, with and without reduced motion).
- **Not changed**: the End card shows the Round log as a plain list, not a disclosure, so it is unaffected. The `rise` keyframe stays (other motions use it).
- **PR**: it has the `visual-change` label once the frames are final, and the body says so. The body lists the per-engine support facts and the proof evidence.
- **Cleanup**: the throwaway probe `gate/probe.spec.ts` is moved to `/tmp` and never committed.

## Testing Decisions

- The gate is the test. A good test here opens and closes the Rounds disclosure as a player does, and asserts frames.
- **Proof of the freeze** (a one-time manual check, with named evidence in the PR; no committed height assertion): (a) the helper throws if no `height` transition starts, or if a seek fails; (b) the worker views the frames: `blitz-rounds-open-50ms`, `-100ms`, and `-150ms` each differ from `blitz-rounds-open-0ms` (the closed frame), from `blitz-rounds-open-200ms` (the open frame), and from each other; the same for History; (b2) in the close sequence the 50, 100, and 150 ms frames differ from the 0 ms frame (open) and from the 200 ms frame (closed), and from each other; (c) the PR lists the computed `::details-content` heights read at 0, 50, 100, 150, and 200 ms (a temporary probe, not committed). A frozen-wrong run (all frames closed) would give identical frames, which the worker would see.
- The worker verifies in the first run that the close direction lists a `height` entry and seeks like the open direction, and that the existing pause pass (`pause()` then `ready`) and the frame sync work while the timeline rate is 0. If `ready` does not resolve, the helper needs another wait.
- Determinism: `pnpm gate:capture`, then `pnpm gate`, twice with no difference, in the local Chromium (the PR states it).
- Reduced motion: the `transition-duration` check and the end frames.
- Vitest tests of History and the Arena (jsdom, no layout) keep passing: only CSS changes in `src/`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
- Prior art: the other `shootMotion` tests, and the throwaway probe of this ticket.

## Out of Scope

- Firefox and WebKit frames beyond the end-frame path above (the engine ticket #229 owns the projects).
- A fallback height animation for browsers without `interpolate-size` (decision #220: they change at once).
- The theme crossfade (#234), other motions, any app component, and shared gate helper files other than `gate/freeze.ts` and `gate/motion.ts` (`gate/blitz.spec.ts` and `gate/daily-motion.spec.ts` are edited for their own frames).

## Further Notes

### Author calls

The owner accepted calls 1 to 8 on 2026-10-05, with the condition recorded under "Other engines". Call 9, call 10, and the `shootDisclosure` helper came from the spec review, and the owner accepted them on 2026-10-05.

1. The freeze route is the CDP Animation domain inside `shootMotion`, chosen by the target name `::details-content`, with a timeline hold before the interaction. Rejected: a named Web Animation in the app (JavaScript, rejected by #220).
2. One `TIMES_200` constant in `gate/motion.ts`; `REORDER_TIMES` is left alone.
3. The close sequence starts from an open Rounds disclosure made with a temporary `transition: none` style tag.
4. Frame names: `blitz-rounds-open`, `blitz-rounds-close`, `history-rounds-open`, `history-rounds-close`. The old `blitz-rounds-rise` frames go away.
5. History frames use the Blitz segment on its own path, in a `describe` with the UTC time zone and `seedStorage`.
6. The reduced-motion proof is the computed `transition-duration` of `::details-content` in `done`, plus an end frame.
7. The CDP route is Chromium-only; other engines take the end-frame path (owner condition), decided in the new helper `shootDisclosure`.
8. Each sequence is its own test (own page), like the other motions.
9. The proof of the freeze is a manual check with named evidence, not a committed height assertion. A committed assertion would need an element handle in the shared helper.
10. The reduced-motion rule for `::details-content` is its own rule inside the media block, not a new selector in the existing list (a list with an unsupported pseudo-element is dropped whole). This differs from the words of the ticket ("the universal rule gains"), and keeps the existing reduced-motion override safe in browsers without `::details-content`.

- "Rounds disclosure" is the term of the parent spec, not of `CONTEXT.md` (which defines "Round log"); this spec keeps it as a term of the parent Spec 6 ("Terms used in this spec").

### Facts checked

- 2026-10-05, Chromium 153, Playwright 1.63, Arena page of the stub build: no `transitionrun` event and no entry in `document.getAnimations()`. At 60 ms after the click the height was 48.8 px, and 100 px at rest. CDP `Animation.animationStarted` lists a `height` transition (200 ms, `ease-out`) and a `content-visibility` transition (200 ms). Seeking gave 0, 37.8, 68.5, 90.6, and 100 px at 0, 50, 100, 150, and 200 ms.
- 2026-10-05, Firefox 155.0 and WebKit 26.6: `CSS.supports("selector(::details-content)")` is true. `CSS.supports("interpolate-size", "allow-keywords")` is false. Their Rounds disclosure changes at once.
