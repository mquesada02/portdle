# Spec: Blitz runs and the History Blitz segment

Spec for #75. Tracker: https://github.com/mquesada02/portdle/issues/75

## Problem Statement

A player who finishes a Blitz run today loses it the moment they leave the end card. Nothing about the run is kept: not the score, not the rounds, not why it ended. History lists only Dailies, so a Blitz run a player is proud of — or wants to review to see what they missed — leaves no trace once the end card is gone.

## Solution

Every ended Blitz run (by lives or by timeout) is saved, newest fifty kept, including a run that scores zero. A pure engine function builds the run record from the final run state and an injected clock; the Blitz page writes it to a new `blitzRuns` key through the existing synchronous storage seam, the same moment it already records the best. History gains a switcher between a Daily segment (unchanged) and a new Blitz segment: saved runs newest first, grouped by local calendar date, each row showing its setup, why and when it ended, its score, and an expandable round log using the same round-log list component the run and end card already use. The nav's History item stays lit on both addresses. Nothing about the Blitz arena, the setup dialog, or Play again's behavior changes here — Blitz still opens on the setup screen, and Play again still returns to it, exactly as today.

## User Stories

### Blitz persistence

1. As a player, I want every ended run saved, including a run with score zero, so that History is complete.
2. As a player, I want only my newest fifty runs kept, so that storage never grows without bound.
3. As a player, I want a saved run to carry its setup, end reason, end time, score, and its rounds with names and ports, so that History renders it even if the catalog changes later.
4. As a player who refreshes mid-run, I want the run written only once it ends, so that a mid-run refresh loses it exactly as it does today.
5. As a player whose browser refuses to save, I want the "Progress may not save." notice as today and the run still playable, so that a storage failure never blocks play.
6. As a maintainer, I want the run built by a pure engine function from the final state and an injected clock, so that it is tested without the DOM and without a real clock.
7. As a maintainer, I want a pure helper to prepend a run to the stored list and drop anything past fifty, so that the cap is one well-tested function, not page logic.

### History

8. As a player, I want a switcher at the top of History with Daily and Blitz, so that both records live in one place.
9. As a player, I want the switcher to work like the Daily switcher, with two addresses, so that a reload or a link keeps the segment I chose.
10. As a player, I want the History nav item lit on both segments, so that the two segments read as one surface.
11. As a player, I want the Daily segment unchanged, so that nothing I rely on moves.
12. As a player, I want the Blitz segment to list my saved runs newest first, grouped by local date, each with its setup, why it ended and at what time, its score, and an expandable round log, so that I can revisit any run.
13. As a player with no saved runs, I want the Blitz segment to say "No runs yet.", so that an empty segment still says something.
14. As a player, I want no links from History rows, so that History stays a record, as today.
15. As a screen reader user, I want the History switcher to have an accessible name and the outer list to keep announcing as "History" on both segments, so that the grouped structure and the switcher both announce properly.

### Maintainer

16. As a maintainer, I want the new `blitzRuns` key versioned under the existing prefix and validated on read, so that corrupt data in it never breaks another key.
17. As a maintainer, I want the storage seam to stay synchronous and storage-agnostic, so that this record shape carries over unchanged when a later backend replaces the adapter.
18. As a maintainer, I want a new engine-level function that groups saved Blitz runs by local calendar date to take a local-date formatter as a parameter, so that the page passes one built on the browser's timezone and tests pass a fixed one with no timezone stubbing.
19. As a maintainer, I want the Blitz page's diff for this ticket confined to the run-end write and exporting its existing round-log list component, so that it rebases cleanly against the parallel Codex-encounters ticket, which touches the guess-handling code nearby.

## Implementation Decisions

### Engine

- A new `BlitzRun` type (added alongside `Round` in the shared engine types): `{ category: DailyCategory; orientation: Orientation; mode: BlitzMode; ended: "lives" | "timeout"; endedAt: string; score: number; rounds: Round[] }`. `endedAt` is an ISO 8601 instant. A run carries no id of its own; `endedAt` both orders it and identifies it, per the ADR "localStorage until a backend" and this repo's plain-JSON-for-later-import approach.
- `buildRun`, in the Blitz engine module alongside `reduceBlitz` and `startBlitz`: takes the final `BlitzState` (`ended` already non-null) and an injected clock (a zero-argument function returning an ISO 8601 instant, the same injection shape as the reducer's `rng`), and returns a `BlitzRun` snapshotting the state's category, orientation, mode, ended reason, score, and rounds, plus `endedAt` from the clock. It is the caller's job to invoke it only once a run has ended.
- `prependRun`, in the same module: a pure function taking the currently stored runs (newest first) and a new run, returning a new array with the run prepended and anything past the newest fifty dropped. Rounds inside a run are never capped: Sprint and Marathon are time-bounded, but Survival ends only on three misses, so an expert run can grow past the ~150-rounds-per-run average that the fifty runs' ~1 MB storage estimate assumes (against the 5 MB localStorage budget the ADR relies on). This is accepted, per Spec 2: an overflow surfaces as a failed write and the existing "Progress may not save." notice, never as blocked play.

### Persistence

- One new key under the `portdle:v1:` prefix: `blitzRuns`, an array of `BlitzRun` records, newest first, already capped by `prependRun` before the page writes it. No existing key changes shape, so no migration exists or is needed.
- Reads validate the whole array: each element's `category`, `orientation`, `mode`, `ended`, `endedAt`, `score`, and `rounds` are checked against their known shapes. This ticket writes the round-shape validation itself — `Round` and its `WrongAnswer` variants have no existing validator to reuse — built at the same rigor as the existing `blitzBests`/`daily` validators, reusing the persist seam's existing `Identified` validator for the nested owner/pick shapes inside a round's `wrong` field. A value that is not an array, or that has any element failing validation (including a run missing `rounds`), reads as no runs (`[]`). Corrupt JSON reads as no runs the same way corrupt JSON reads as empty for every other key today. Reading or writing this key never touches any other key.
- Write failures raise the existing "Progress may not save." notice and never block play, matching every other write in this app.

### Blitz screen

- The existing run-end `useEffect` (the one that already calls the best-recording helper once `run.ended` becomes truthy) gains one more step, run before or alongside the existing best write: build the run record with `buildRun`, using `() => new Date().toISOString()` as the clock, prepend it to the runs currently in the store with `prependRun`, and write the result back through the storage seam. A failure on this write sets the same save-warning state the best write already sets on failure; the warning shows if either write fails.
- This ticket's only other change to the Blitz screen is exporting the existing round-log list component so History can render the same line format; nothing about its rendering changes. No other part of the Blitz screen — setup, HUD, guessing, timers, the end card, or Play again — changes in this ticket. Blitz still opens on the setup screen and Play again still returns to it; the arena replaces that in a later ticket.

### History screen

- Two addresses render the same History screen: the existing `/history` for the Daily segment and a new `/history/blitz` for the Blitz segment. The screen takes which segment to show as an input from its route, the same way the Daily screen already takes its category from its route.
- Both segments sit under the same `h1` "History" and a new switcher below it: a segmented control matching the Daily switcher's existing look and behavior (a nav of links, the active segment marked current), named "History switcher", with two segments labelled "Daily" and "Blitz" linking to the two addresses.
- The Daily segment's rendering, rows, and eligibility rules are unchanged by this ticket.
- The Blitz segment reads the stored runs and groups them by local calendar date, newest date first, using the History engine's new grouping function (below). Each date heading uses the Daily segment's existing `YYYY-MM-DD` form, built from the run's end instant in the viewer's local timezone (not UTC, since the instant is a moment in time, not a UTC calendar day the way a Daily's date is).
- Within a date group, each run renders, in this order: its setup badges (category, orientation, and mode, reading "Mixed", "Protocols", or "Applications" for category, "Default" or "Inverted" for orientation, and "Sprint", "Marathon", or "Survival" for mode — the existing mode names with their durations stripped, distinct from today's setup screen's own duration-bearing pill labels), then "Time's up" or "Out of lives" matching the run's `ended` reason, then the local time of `endedAt` as 24-hour `HH:MM`, then the score, then a native `<details>`/`<summary>` disclosure titled "Rounds ({n})" containing the full round log in play order (oldest first) using the same round-log list component the run and end card use. No row, badge, or disclosure is a link; History stays read-only.
- The orientation and mode badges share the category badge's existing visual treatment (the same pill shape, sizing, and light/dark colors already used for the Daily segment's category badge), so the row's three badges read as one consistent style rather than three new ones.
- The outer list around the grouped rows keeps the accessible name "History" in both segments, the same way it already does for the Daily segment today. With no stored runs, the Blitz segment reads "No runs yet." in place of any date groups.
- The History engine module (`src/engine/history.ts`) gains `groupBlitzRunsByDate`, a pure function that groups a list of Blitz runs by local calendar date, newest first, taking the local-date formatter as a parameter — a function from a run's `endedAt` instant to its `YYYY-MM-DD` local date string. Like the existing Daily-segment grouping helper, it assumes its input is already newest-first (guaranteed by `prependRun`) and only walks and buckets adjacent runs sharing a local date; it never re-sorts or re-orders the runs it is given. The page passes a formatter built from the browser's local timezone (`Date`'s local year/month/day accessors); tests pass a fixed one, so no timezone stubbing is needed anywhere in this ticket's tests.

### Shell

- The nav's History link is marked current on both `/history` and `/history/blitz`, the same way the Daily link is already marked current on all three Daily addresses.

### Copy

- Exact strings this ticket introduces or reuses, all already fixed by Spec 2 or by existing Blitz/History copy: "History switcher" (reusing the existing nav labels "Daily" and "Blitz" for its two segments), "Rounds ({n})", the existing "Score {n}" copy reused for each row's score, "Time's up", "Out of lives", the badge forms "Sprint" and "Marathon" (existing pill labels with their durations stripped; "Survival" already has none), "Mixed", "Protocols", "Applications", "Default", "Inverted", "No runs yet.", and the existing round-log outcome and wrong-answer copy ("correct", "miss", "you typed {port}", "you typed {port} ({name})", "you picked {name}") carried over unchanged by reusing the existing round-log list component.

## Testing Decisions

A good test exercises a public seam with literal inputs and asserts what a player sees or what a pure function returns. It does not read class names, colors, or library internals. Expected values are literals from this spec.

1. **Engine seam** (prior art: the existing Blitz reducer tests and the existing History tests).
   - `buildRun`: given an ended `BlitzState` (lives and, separately, timeout) and a fixed clock, the returned run's category, orientation, mode, `ended`, `score`, and `rounds` match the state, and `endedAt` is the clock's instant.
   - `prependRun`: prepending a run to fewer than fifty stored runs adds it at the front without dropping any; prepending to exactly fifty keeps the list at fifty, newest first, dropping the oldest.
   - `groupBlitzRunsByDate`: grouping three runs across two local dates, with a fixed formatter injected, yields two groups in newest-first order.
2. **Persist seam** (prior art: the existing storage test file, especially the `blitzBests` validator tests).
   - Corrupt JSON, a non-array value, and an array containing one run missing `rounds` under the `blitzRuns` key all read as no runs (`[]`); writing or corrupting `blitzRuns` never affects a neighboring key, and corrupting a neighboring key never affects `blitzRuns`.
3. **App seam** (render the app with a memory store, memory history, and an injected UTC day; prior art: the existing Blitz, Blitz best, and History app-seam test files; the new run-persistence tests land in a new `blitz-runs.test.tsx` file rather than the existing `blitz.test.tsx`, the same way `blitz-best.test.tsx` already lands separately, so this ticket's tests do not collide with the parallel Codex-encounters ticket's edits to `blitz.test.tsx` and `blitz-page.tsx`; the History Blitz-segment tests extend the existing `history-page.test.tsx`; Blitz tests derive the current entry from the heading, as today; seeded run instants sit at 12:00 UTC so every offset from -11 to +11, which covers CI and the dev machines in use, agrees on the date, and no TZ pinning is needed; the row's local time is rendered but not asserted as a literal in any test, since it varies with the machine's own timezone the same way the date would without the injected formatter — its rendering is checked visually only, the way this repo already leaves some presentational details to a visual check rather than a seam assertion).
   - A finished run (played to lives or to timeout) writes one run record to `blitzRuns` whose rounds match what was played, including a run that ends with score zero.
   - With fifty runs already stored, finishing one more run leaves the store at fifty, the new run first and the previously-oldest run gone.
   - "/history/blitz" shows the switcher named "History switcher" with Blitz selected, the nav's History item current, and — with a seeded run in the store — a date heading with that date's runs listed underneath it (the outer list still named "History", the same nested date-group structure the Daily segment already uses) and a row showing its setup badges (with the mode badge reading "Sprint", not "Sprint (1m)"), "Time's up", its score, and a "Rounds ({n})" disclosure that, opened, reveals the seeded round lines, with no link anywhere in the Blitz segment.
   - With no stored runs, the Blitz segment reads "No runs yet."
   - "/history" (the Daily segment) is unchanged: same heading, same grouped rows, same no-links guarantee, existing History tests stay green.
   - Existing Blitz tests (setup, guessing, timers, bests, and the round log) stay green with no behavior change beyond the new run-end write.
   - The nav's History link is current on both `/history` and `/history/blitz`.

No snapshot tests, no visual regression, no Playwright. This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` all passing, in addition to the seam coverage above.

## Out of Scope

- The Blitz arena: the "New run" button, the "Last run" and "Bests" sections, and the setup dialog — ticket #77. Blitz keeps opening on today's setup screen, and "Play again" keeps returning to it exactly as today; this ticket does not touch that behavior.
- The Codex and any encounter recording (`correct`/`missed`/`identified` writes) — ticket #73, running in parallel. This ticket's Blitz-page diff is confined to the run-end write so the two branches rebase cleanly; it does not touch guess handling.
- Any change to Blitz guess evaluation, scoring, lives, timers, or search.
- Any change to the Daily engine, the Daily board, or the Daily segment's rows, eligibility, or sort order.
- Any change to the shell's theme toggle, How-to dialog, or any nav item besides the History link's active state.

## Further Notes

- Primary source: `docs/superpowers/specs/2026-09-11-spec2-blitz-history-codex.md` (issue #70), sections "Persistence", "Blitz reducer" (the run-end paragraph only), "History", "Copy", and "Testing Decisions"; the ticket body of issue #75; ADR "localStorage until a backend"; and the round-log ticket's spec (`docs/superpowers/specs/2026-09-12-t72-blitz-round-log.md`, issue #72, already merged), whose `Round` shape and round-log component this ticket reuses unchanged.
- Coordination note (from this ticket's work assignment, not the ticket body or Spec 2 itself): issue #73 (Codex encounters) runs in parallel and adds a small write next to the Blitz guess handling; this ticket's Blitz-page edit stays confined to the run-end write so the two branches rebase cleanly.
- Glossary: `CONTEXT.md` already defines Run, Round log, History, History switcher, and Segment; this spec introduces no new terms and uses none of their _Avoid_ words.
- Author calls not covered by the ticket or Spec 2, listed so they can be overruled:
  - The two History addresses are implemented as flat sibling routes (`/history` and `/history/blitz`, both children of the root route) rather than a true nested route, matching how the three Daily addresses (`/`, `/protocols`, `/applications`) are already flat siblings sharing one page component with a prop. This is an implementation mechanic with no player-visible effect.
  - The Blitz segment's score reuses the existing "Score {n}" copy already shown in the HUD and the end card, since Spec 2's Copy section does not introduce a separate score string for History rows.
  - The Blitz segment always renders its outer list (named "History" via the shared heading, as today), holding a single "No runs yet." item when there are no stored runs, so the accessible list name holds the same way in both segments rather than only when rows exist.
  - The duration-stripped mode labels and the orientation labels used by the Blitz segment's badges are added locally in the History screen's module rather than shared, since this ticket is their only consumer; the arena ticket (#77) can extract them if it needs the same labels.
  - The new orientation and mode badges are styled to match the Daily segment's existing category-badge pill (shape, sizing, light/dark colors) rather than a new style, since neither the ticket nor Spec 2 specifies which existing element the new badges should visually match.
  - The new run-persistence app-seam tests land in a new `blitz-runs.test.tsx` file rather than the existing `blitz.test.tsx`, following the same collision-avoidance precedent the Blitz-best ticket set with `blitz-best.test.tsx`, since ticket #73 runs concurrently against `blitz.test.tsx` and `blitz-page.tsx`.
