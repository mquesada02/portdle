# Ticket spec: Time to score and Best ties (#132)

Tracker: https://github.com/mquesada02/portdle/issues/132. Ticket of Spec 4 (`docs/superpowers/specs/2026-09-28-spec4-backend.md`, issue #127, map #114). Local only: no backend, no `Remote`, no sync.

## Problem Statement

A Blitz player who reaches the same score twice cannot tell which run was better. Two runs of 12 in Sprint look equal even when one reached 12 at 20 seconds and the other at 58 seconds. The Best only records a score, so a faster tie is thrown away, and later leaderboards would have no fair way to break ties.

## Solution

Each Blitz run records its **time to score**: how long the run took to reach the score it ended with. A **Best** becomes a score plus an optional time to score. A run that ties the Best at a faster time replaces it, and the end card's New best badge shows for it. Bests and runs stored before this change keep working and read as having no time.

## User Stories

1. As a Blitz player, I want each run to record how long it took to reach its final score, so that equal scores can be ranked fairly.
2. As a Blitz player, I want the time to score to stop at my last correct answer, so that a long wait on a missed round or a timeout does not count against me.
3. As a Blitz player whose run scored zero, I want the run to record a time to score of zero, so that a run with no correct answer has a defined value.
4. As a Blitz player, I want a tie with my current Best at a faster time to score to become my new Best, so that improving my speed counts.
5. As a Blitz player, I want a tie with my current Best at a slower or equal time to leave my Best unchanged, so that a Best never gets worse.
6. As a Blitz player, I want a higher score to replace my Best whatever its time, so that score stays the first ranking.
7. As a Blitz player, I want a score that ties a Best with no time to replace it, so that my first timed run at that score gets a time on record.
8. As a Blitz player, I want the New best badge on the end card whenever a run with a score above zero replaces my Best, faster tie included, so that I see my speed gain.
9. As a Blitz player, I want no New best badge for a run that scores zero, so that a zero is never celebrated.
10. As a Blitz player with Bests and runs from before this change, I want them to keep working without a time, so that nothing old is lost or migrated.
11. As a Blitz player in Survival mode, I want the same time to score rules as in Sprint and Marathon, so that every Blitz mode ranks the same way.
12. As a Blitz player in inverted Orientation, I want the same time to score rules as in default Orientation, so that both Orientations rank the same way.

## Implementation Decisions

- **Monotonic clock, injected.** The Blitz engine gets its elapsed time from an injected monotonic clock (a function returning milliseconds that never goes backward), not from wall-clock time. The input is named `now` (a function returning milliseconds), distinct from the ISO-string `clock` that the run builder already takes for the run's end instant. `now` is passed to the engine function that starts a run and to the engine function that reduces an event, the same way the engine already takes an injected random source. The Blitz page passes the browser's monotonic clock on every start and reduce call, the timeout call included.
- **Run state.** Every existing test fixture or call that builds a state, starts a run, or reduces an event gains the clock and the new fields. The start reading is taken once inside the start function, a short, bounded offset before the page arms its countdown; that offset is accepted. The two new state fields are `startedAtMs` and `timeToScoreMs`; the stored run's `timeToScoreMs` is copied from the state's. The Blitz state records the clock reading and a running time to score. The time to score starts at zero. Each committed correct round, in either Orientation, sets it to the clock now minus the start reading. A missed round, an invalid or duplicate guess, and the timeout leave it unchanged. So a run that scores zero keeps zero, and the value always belongs to the last correct answer.
- **Run record.** A stored run gains an optional time to score in milliseconds, under the name `timeToScoreMs`. The engine function that builds the stored run copies it from the state, so every new run has one. The run validator accepts runs with the field absent and rejects a field that is not a number (the same plain number check the validators use today). Runs from before this change have no field and are not migrated.
- **Best shape.** A Best is a score plus an optional time to score, `{ score, timeToScoreMs? }`, stored under the existing key `category|orientation|mode` in the existing Bests storage key. Three types describe them: `BlitzBest` is `{ score: number; timeToScoreMs?: number }`; `BlitzBests` keeps its name and holds only `BlitzBest` values (the normalized form); a new `StoredBlitzBests` accepts each entry as a bare number or a `BlitzBest`. The Bests writer accepts the stored form, so tests can seed a bare number as legacy data; the Bests reader returns the normalized form, turning a bare number into a Best with a score and no time. Every screen and the replacement rule use the normalized form. Nothing rewrites stored data; a stored bare number changes only when a run replaces it. The Bests validator accepts either shape and rejects anything else.
- **Replacement rule.** One pure engine function decides whether a run replaces the stored Best. It takes the run's score and a required time in milliseconds (a Blitz state satisfies this) plus the stored Best or none; it is not yet the full merge rule, which Spec 4 also defines for two untimed Bests. A run replaces it when there is no Best; or its score is higher; or its score is equal and the Best has no time; or its score is equal, the Best has a time, and the run's time is strictly lower. An equal score at an equal or slower time does not replace it. The order matches the Spec 4 merge for Bests where the run has a time.
- **New best badge.** The Blitz page shows the badge when the run replaces the Best and its score is above zero. A run that scores zero still writes a Best (with time zero) when there is none, and a timed zero run rewrites an untimed zero Best, a small new consequence of the rule; it never shows the badge.
- **End card and arena.** The page's Best-recording step uses the replacement function. The touch points are the three Best types, the Persist read and write signatures, the Bests validator, the Best-recording step, the end card's displayed Best, and the arena's Bests rows. The Best-recording step re-reads the stored Best at write time, as Spec 4 requires, and the replacement decision and the badge both use that read. The Best shown on the end card (the higher of the stored Best's score and the run's score) and the Score in the arena's Bests table look as they do now and read the score of each Best. Time to score is not shown anywhere in this ticket; leaderboards show it in a later ticket.
- **Glossary.** The glossary gains **Time to score** (no Avoid line): the milliseconds from a run's start to the commit of its last correct answer, or zero for a run with no correct answer. Its **Best** entry says a Best is a score plus an optional time to score, faster time winning a tie. The Spec 4 glossary note lists the other new terms; they belong to their own tickets.
- **ADR.** None. ADR 0001's storage decisions are untouched by this ticket.

## Testing Decisions

- A good test drives behavior through the highest seam and asserts what the player or the store sees, never internal calls.
- **Engine tests with an injected clock** (`blitz.test.ts`): a correct round in default and in inverted Orientation sets the time to score to the elapsed time; a missed round, an invalid or duplicate guess, and a timeout leave it unchanged; a zero-score run builds a record with time zero; the run record carries the time; one time-to-score case in Survival, since the path is mode-independent; the replacement rule for each case (no Best, higher score with a slower time, equal score and faster time, equal score and equal time, equal score and slower time, equal score against an untimed Best, lower score, zero score with no Best, zero score against an untimed zero Best).
- **Storage tests** (`storage.test.ts`): Bests round-trip with and without a time; a stored bare-number Best reads as a Best with no time; a Best whose time is present but not a number, or whose score is missing, makes the whole store read as empty like any corrupt store, while a store mixing bare numbers and objects loads; runs with and without `timeToScoreMs` load, and a non-number `timeToScoreMs` is rejected.
- **App-level Blitz tests** (`blitz.test.tsx`, `blitz-best.test.tsx`): a faster tie shows the New best badge and stores the faster time; a slower tie shows no badge and keeps the stored Best; a tie with a bare-number stored Best replaces it and shows the badge; a zero-score run shows no badge.
- Prior art: the existing engine tests that inject an `rng` and the ISO `clock` of the run builder, and the App-level Blitz suites that seed `memoryStore` Bests.
- App-level tests control elapsed time by advancing vitest fake timers, which also fake the browser's monotonic clock (`performance.now`); the implementation confirms this, and if not, stubs `performance.now` with a spy.
- Existing tests that write or read a bare-number Best update to the new shape where they read it back; tests that only seed a bare number keep it, which also covers the legacy read.

## Out of Scope

- Showing time to score in the arena, the end card, or History.
- Leaderboards, the merge engines, sync, and any backend column for time to score.
- Migrating stored Bests or runs.
- Any change to how a run's score, lives, or timer work.

## Further Notes

- Author calls, listed so they can be overruled: the field name `timeToScoreMs`; the stored Best becoming an object with a bare number still readable; the clock passed to both engine functions; a tie at an equal time not replacing the Best; a zero-score run writing a Best when there is none, and a timed zero run rewriting an untimed zero Best; the input named `now`; the glossary edit; the page using the browser's monotonic clock.
- Spec 4 places these rules in "Time to score" (Implementation Decisions) and Further Notes (author calls on time to score); this ticket implements only the local half.
