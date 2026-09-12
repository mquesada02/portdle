# Spec: Blitz round log

Spec for #72. Tracker: https://github.com/mquesada02/portdle/issues/72

## Problem Statement

During a Blitz run a player has no idea which round they are on, and each committed round vanishes the moment the next prompt appears: a miss flashes the service name in the message line for a second and is gone. When the run ends, the end card shows a score but the rounds themselves are lost, so a player can't review what they just got right or wrong.

## Solution

The Blitz reducer's state gains a `rounds` list. Every committed round, correct or miss, appends one entry snapshotting the prompt's name and port, the outcome, and — on a miss — what the player answered. An invalid guess and a timeout append nothing. The HUD gains "Round {n}" between the hearts and the score, where n is committed rounds plus one. Under the input, a round log lists the last three committed rounds, newest first, each as a colored dot (correct/miss, accessible by text), the entry's name and port, and on a miss what the player typed or picked. When the run ends, the end card keeps everything it shows today and adds a "Rounds ({n})" heading followed by the full round log in play order, oldest first, using the same line rendering.

This ticket does not touch persistence, the arena, the setup dialog, History, or the Codex — those land in later tickets. Play again keeps its current behavior (return to the setup screen).

## User Stories

1. As a player, I want the HUD to read "Round {n}", where n is the number of rounds I have committed plus one, so that I know how far into the run I am.
2. As a player, I want a round log under the input showing my last three committed rounds, newest first, so that I can see what just happened without the message flashing away.
3. As a player, I want each round log line to show the outcome as a dot with text for assistive tech, the entry's name, and its port, so that a miss teaches me the right answer.
4. As a player, I want a missed round in Default orientation to also show what I typed, as "you typed 6380", with the owner's name when that port belongs to an entry, as "you typed 6379 (Redis)", so that I see both what I answered and what it was.
5. As a player, I want a missed round in Inverted orientation to also show what I picked, as "you picked MySQL", so that I see the service I confused it with.
6. As a player, I want older rounds to drop off the round log after three, so that the input never scrolls out of reach on a phone.
7. As a player, I want an invalid guess to leave the round log unchanged, so that only committed rounds are counted.
8. As a player, I want a run that times out mid-prompt to leave that prompt out of the round log, so that only rounds I answered are recorded.
9. As a player, I want the existing miss message, hearts, score, and countdown to keep working as they do today, so that the run feels the same apart from the new context.
10. As a player, I want the end card to list every round of the run under a "Rounds ({n})" heading, in the same line format as the round log during the run but oldest first rather than newest first, so that I can review the whole run.
11. As a player, I want the end card to keep "Time's up" or "Out of lives", the score, the best, and the "New best" badge, so that nothing I had is lost.
12. As a player, I want "Play again" to keep returning me to the setup screen exactly as it does today, so that this ticket changes nothing about starting a new run.
13. As a maintainer, I want a Blitz guess to never be a duplicate, so that each prompt takes exactly one committed answer and the round list has no gaps to reconcile.
14. As a maintainer, I want the Blitz reducer to keep its pure, rng-injected shape, so that round-building is tested without the DOM.

## Implementation Decisions

### Engine

- `BlitzState` gains `rounds: Round[]`, initialized to `[]` by `startBlitz`. The round number shown in the HUD is the count of committed rounds plus one.
- New shapes (the existing `Identified` shape, `{ id, name, port }`, is reused unchanged — not renamed): a round outcome is either `"correct"` or `"miss"`. A wrong answer is either a typed-port record, carrying the typed port and its owner (the existing `Identified` shape, or `null` when the port has no owner), or a picked-entry record, carrying the picked entry as the existing `Identified` shape. A round carries the prompt entry's id, name, and port, its outcome, and its wrong answer, which is present only on a miss.
  `id`, `name`, and `port` snapshot the prompt entry (the answer) at commit time; `id` is the entry's catalog id, unread by this ticket's own logic and kept only so it lines up with a later import. The wrong answer is absent for a correct round.
- Building a `Round` from a guess result stays inside the reducer, since `reduceBlitz` already holds the answer entry and the guess/inverted result when it decides the outcome. The typed-port owner for a Default miss is the guess result's existing `identified`; the picked entry for an Inverted miss is the existing `identified` on the inverted result (always present on an Inverted miss, same-port pick included).
- A round is appended only when a guess or pick actually commits: `correct` or `miss`. `invalid` and `duplicate` guesses, `duplicate` inverted picks, and a `timeout` event append nothing and leave `rounds` untouched, matching the reducer's existing no-append behavior for those cases.
- No cap is applied to `rounds` within the reducer; the round log's three-line and "last three" behavior is a display-time concern (the UI slices), not a state concern, matching Spec 2's "rounds per run are not capped" note (persistence, which would care about a cap, is out of this ticket's scope).

### Blitz screen

- The HUD row (rendered during an active run) gains a "Round {n}" text node between the existing `Hearts` element and the "Score {n}" text, where n is the count of committed rounds plus one. It is plain text with no separate accessible name, matching how "Score {n}" already renders.
- A new round-log line renderer is shared by two call sites: the in-run log (the last three rounds, newest first) and the end-card log (every round, oldest first, in the order they were committed). Each line shows, in order: the outcome dot, the entry name, the entry port in monospace, and — for a miss — the wrong-answer text with its embedded port in monospace: "you typed {port}" when the wrong answer has no owner, "you typed {port} ({name})" when it has one, or "you picked {name}" for an Inverted miss (no port embedded, per the exact copy).
- The outcome dot is a `role="img"` element carrying the accessible text "correct" or "miss" verbatim (the `RoundOutcome` value itself), colored emerald for correct and zinc for miss, matching the board tile's placed/absent colors.
- The in-run round log is a plain list with no group name and is not a live region — the existing `aria-live="polite"` message line stays the only announcement, unchanged. The round log renders last on the page: below the input, below the Search panel (Inverted only), and below the message line, matching the page's existing bottom-up order.
- The end card keeps its current content unchanged (outcome line, score, best, "New best", the message line, "Play again") and appends, after all of it, a "Rounds ({n})" heading, where n is the total number of rounds, followed by the same round-log list rendering, oldest first.
- Nothing else on the Blitz screen changes: setup stays a page (not a dialog), "Play again" still returns to the setup screen, and no persistence write is added.

## Testing Decisions

A good test exercises a public seam with literal inputs and asserts what a player sees or what a pure function returns, following this repo's existing Blitz tests. Expected values are literals from this spec.

1. **Engine seam** (the existing Blitz reducer test file; prior art: the existing tests in that file):
   - A committed correct round appends a round with the answer's name and port and no wrong answer.
   - A Default miss appends a round whose wrong answer is the typed port with its owner, covering both an owned port and an unowned port (owner absent).
   - An Inverted miss appends the picked entry as the wrong answer; a same-port Inverted miss still appends it.
   - An invalid guess and a timeout append nothing to the round list.
   - The round number (rounds committed plus one) reads 3 after two committed rounds.
2. **App seam** (the existing Blitz app-seam test file; prior art: the existing Blitz app-seam tests; Blitz tests derive the current entry from the heading, as today; the page receives no rng, only the reducer does, so this seam has nothing to inject):
   - The HUD reads "Round 1" at the start of a run and "Round 3" after two committed rounds.
   - After one correct and one missed round, the round log shows two lines, newest first, each with its outcome text "correct" or "miss"; the miss line names the entry, its port, and "you typed {port}" for an unowned port or "you typed {port} ({name})" for an owned one.
   - In Inverted orientation, a miss line reads "you picked {name}".
   - After four rounds, only three lines show in the in-run log.
   - An invalid guess leaves the round log unchanged.
   - The end card lists "Rounds ({n})" with every round line, in play order (oldest first).
   - Existing Blitz tests (setup, guessing, timers, bests) stay green with no behavior change.

No snapshot tests, no visual regression, no Playwright. This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` all passing, in addition to the seam coverage above.

## Out of Scope

- The Blitz arena, the "New run" setup dialog, and "Play again" returning to an arena instead of setup — a later ticket.
- Any persistence of runs or rounds (the `blitzRuns` key, the fifty-run cap, writing on run end) — a later ticket.
- The History Blitz segment and the History switcher — a later ticket.
- The Codex and any encounter recording (`correct`/`missed`/`identified` writes) — a later ticket.
- Any change to Blitz guess evaluation, scoring, lives, timers, or search — unchanged except for the new round-building step in the reducer.
- Any change to the Daily board, Daily engine, or shared shell/nav.

## Further Notes

- Primary source: `docs/superpowers/specs/2026-09-11-spec2-blitz-history-codex.md` (issue #70), sections "Blitz reducer" and "Blitz screen" (the run and end-card parts only; the arena/dialog parts of that section belong to a later ticket), and the ticket body of issue #72.
- Note from the ticket: issue #73 (Codex encounters) runs in parallel and adds a small write next to the Blitz guess handling in the reducer; this ticket's edits to `reduceBlitz` stay minimal and local (building and appending the `Round`) so the two branches rebase cleanly.
- Glossary: `CONTEXT.md` already defines Run, Round, Prompt, Wrong answer, Round log, and HUD (HUD already lists "round number" among its contents); this spec introduces no new terms and uses none of their _Avoid_ words. `Identified` is the existing glossary/type term and is reused, not renamed.
