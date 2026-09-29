# Ticket spec: Merge engines (#133)

Ticket spec for [#133](https://github.com/mquesada02/portdle/issues/133), a child of [Spec 4](2026-09-28-spec4-backend.md) (#127, map #114). It builds only the pure merge functions. The sync module, `Persist`, `Remote`, and the UI are other tickets.

## Problem Statement

Sync must join a device's data with the account's data without losing progress, whichever device merges first. The rules exist only as prose in Spec 4. No code can merge a Codex, the Bests, the runs, a Daily, or a preference, and nothing can rebuild stats and streaks from merged Dailies.

## Solution

A set of pure functions, one per synced kind, in one new engine module (`merge.ts`, tested in `merge.test.ts`) beside the existing Codex, stats, and Blitz engines. The only changes to existing modules are exporting the Codex state rank table and the Blitz run cap. Each takes two values and returns the merged value. Each is order-independent (commutative on the synced value) and idempotent. One more function folds a category's merged Dailies into stats and last played.

## User Stories

1. As a signed-in player, I want my Codex to keep the highest state any device reached for each entry, so that a Correct never goes back to Missed or Identified.
2. As a signed-in player, I want the Codex `fresh` flags to stay as this device has them, so that a pull never uses up my fresh-card pop.
3. As a signed-in player, I want an entry that first arrives from my account to arrive not fresh, so that entries I never saw on this device do not pop.
4. As a signed-in player, I want each Best to be the highest score any device reached, so that a Best never goes down.
5. As a signed-in player, I want the faster time to score to win a tie, so that improving my speed counts.
6. As a signed-in player with a Best from before time to score existed, I want a timed Best at an equal score to beat it, and two untimed Bests at an equal score to merge as equal, so that old Bests keep working.
7. As a signed-in player, I want my runs from every device combined, keeping the newest 50, stored newest first, so that Last run stays the newest run.
8. As a signed-in player who played the same Daily on two devices, I want the finished Daily to beat the unfinished one, a win to beat a loss, and fewer tries to beat more, so that the account keeps my best result.
9. As a signed-in player with the same Daily unfinished on two devices, I want the one with more tries to win, so that the more advanced Daily survives.
10. As a signed-in player with two identical-rank Dailies (two losses included), I want the result to be deterministic, so that both devices converge on the same Daily.
11. As a signed-in player, I want each preference merged on its own by last write wins, so that changing one preference never undoes a newer change of another.
12. As a signed-in player, I want stats, streaks, and last played rebuilt from my merged Dailies, so that no day is double-counted and no streak is invented.
13. As a signed-in player, I want the rebuilt current streak to reset after a skipped day or an unfinished previous day, including the gap up to the current UTC day, so that it matches what playing day by day gives.
14. As the owner, I want every merge to give the same result in any order and when repeated, so that two devices converge.

## Implementation Decisions

- One new engine module holds all merge functions. It has no dependency on `Persist`, `Remote`, React, or the clock. It reads only engine types, the Codex state ranks, and the stats and UTC-day functions that already exist. The Codex state rank table is exported from the Codex engine for reuse instead of being duplicated.
- **Codex**: merge a local Codex (with `fresh` flags) with the account's Codex (states only, since `fresh` is never synced). Per entry id, the higher state wins (Identified < Missed < Correct). An entry present only locally is kept as it is. An entry present only on the account is added with `fresh` false. An entry present on both keeps the local `fresh` flag, whichever state wins. Commutativity holds on the synced value (the states).
- **Best**: merge two optional Bests for one key; inputs are already normalized to the score-plus-optional-time shape by `Persist` reads, so a bare stored number never reaches the merge. Higher score wins. At an equal score, a timed Best beats an untimed Best, and the faster time wins between two timed Bests. Equal score with equal or absent times gives an equal Best. A keyed variant merges two Bests maps over the union of their keys; a key on one side only is kept as it is. The Best merge is a separate function from the run-versus-Best rule already in the Blitz engine (`replacesBest`), which needs a new run's time; the two agree on every case they share, and a test checks that.
- **Runs**: union of two run lists by `endedAt`, keep the newest 50 by `endedAt`, return newest first. A shared `endedAt` means the same run; if the two copies differ, the copy whose JSON text is smaller is kept so the result never depends on argument order. `endedAt` values are ISO strings from the app clock (`toISOString()`) and compare as text; a different format is not supported.
- **Daily**: merge two stored Dailies for one category and date. Order of rules: finished beats unfinished (status playing); between two finished, won beats lost; between two wins, fewer tries (guesses) wins; between two unfinished, more tries wins; two losses tie on tries. Any exact tie breaks by comparing the guesses as `JSON.stringify` text (a deterministic tie-break only; it does not claim one text is better); the smaller text wins.
- **Preference**: merge two stamped values of one preference, where a stamp is the per-preference server timestamp. The later stamp wins (compared as instants). An equal stamp breaks by comparing the values as `JSON.stringify` text, then the stamp texts (the smaller wins), so the result is deterministic even when two texts name the same instant. The function is generic over the value type, so it serves the theme, the How-to seen flag, and the Codex sort, each merged on its own. Deciding which side is local or pending is the sync module's job, not this function's.
- **Stats fold**: input is a Daily category's Dailies keyed by date and the current UTC day. Result is the category's stats and last played (null when no Daily is finished). Fold the finished Dailies in date order; unfinished Dailies add nothing to the fold and are seen only by a gap check.
  - Per finished Daily: first apply the existing streak gap with that date as the day, the previous fold step's last played, and the Daily stored on the calendar day before that date (none if absent; an unfinished one resets the streak). Then apply the existing Daily finish with the Daily's status and its try count (the number of guesses, as the Daily screen counts). Then set last played to that date.
  - Final gap: after the last one, apply the streak gap with the current UTC day and the Daily stored on the day before it, but only when last played is before the current UTC day. On a day a Daily was finished, the Daily screen applies no second gap, so the fold applies none either.
  - No finished Daily: the result is empty stats and null last played.
  - The fold does not defend against Dailies dated after the current UTC day, which a real clock cannot produce. Stats stored before this rebuild that no stored Daily backs are replaced by the rebuild, as Spec 4 decides.
- No domain term is added, so `CONTEXT.md` does not change.

## Testing Decisions

- A good test calls the function with values and asserts the returned value. No test looks at internal calls.
- Merge tests sit in a new test file beside the engine, in the style of the existing engine tests (`codex.test.ts`, `stats.test.ts`, `blitz.test.ts`).
- Each engine has: one test per rule, a commutativity test (merge a,b equals merge b,a; for the Codex, on the states), and an idempotence test (merging the result with either input again changes nothing).
- The Codex cases are tested: both sides present keeps the local `fresh` flag whichever state wins, and an account-only entry arrives with `fresh` false. The keyed Bests merge is tested over the union of keys, including a key on one side only.
- The tie cases are tested: equal Best scores with times, with one time, and with none; two losses; two wins with equal tries; two unfinished Dailies with equal tries; equal preference stamps; runs with a shared `endedAt`; more than 50 runs.
- The stats fold is tested against the incremental path: each sequence of days is applied step by step with the existing stats functions the Daily screen and the UTC-day change use, and the fold must return the same stats and last played. The sequences include a skipped day, a loss, an unfinished day, a final gap to a later UTC day, a win after an unfinished yesterday, a win on the current UTC day with yesterday's Daily still unfinished (streak 1), a later current UTC day where yesterday's Daily is won (no reset) and where it is unfinished (reset), and no finished Daily at all. The fold gives the same result whatever order the Dailies are supplied in.

## Out of Scope

- The sync module, `Persist` changes, `Remote`, push and pull, bookkeeping, and any UI.
- Storing the fold's result (the sync module writes it through `Persist`).
- Deciding which preferences have a pending local change.
- SQL and backend rules (the database has its own preference trigger).

## Further Notes

- Author calls, listed so the owner can overrule them:
  - Merge functions live in one new engine module, not spread across the Codex, stats, and Blitz modules.
  - The Codex merge takes the account side as states only.
  - Runs are unioned by `endedAt` alone, as #117 decided.
  - The smaller JSON text wins exact ties for Daily guesses and for runs with a shared `endedAt`; #117 named text comparison but not its direction.
  - An equal preference stamp breaks by comparing values as text.
  - JSON text tie-breaks assume the app writes a fixed key order, which it does.
  - The fold returns empty stats and null last played when no Daily is finished.
