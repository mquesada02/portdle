# Spec: Codex engine, codex key, and every encounter

Spec for #73. Tracker: https://github.com/mquesada02/portdle/issues/73

## Problem Statement

Every moment Daily and Blitz show a player an entry's name and port together is lost the instant it happens: a won or lost Daily, a Daily miss identification, a correct or missed Blitz round. None of it is remembered anywhere the player can return to. There is no store for "every service I have met," so a future Codex screen has nothing to read from, and nothing in Daily or Blitz today writes toward one.

## Solution

A new pure Codex engine module owns a small state machine over Unseen, Identified, Missed, and Correct, keyed by entry id, that only ever moves a state up. A new `codex` key under the existing storage prefix holds that map, read and written through the existing synchronous, validated seam. Daily and Blitz gain minimal writes next to their existing guess handling that turn a win, a loss, a miss identification, and a committed Blitz round into the right encounter. No Codex screen ships in this ticket — only the engine, the key, and the writers, so a later ticket can build the screen against a store that already holds real data once this ships.

## User Stories

### Daily encounters

1. As a player, I want a Daily I win to set its target to Correct in my Codex, so that a won Daily counts as Correct.
2. As a player, I want a Daily I lose to set its target to Missed, so that a lost Daily still reveals the entry.
3. As a player, I want a Daily try whose port belongs to another entry to set that entry to Identified, so that a wrong port still teaches me something I keep.
4. As a player, I want a Daily target to enter my Codex only when the Daily ends, not on the first try, so that an unfinished Daily reveals nothing.
5. As a player, I want an invalid or duplicate Daily try to change nothing in my Codex, so that only committed play counts.

### Blitz encounters

6. As a player, I want a correct Blitz round to set its prompt to Correct, so that Blitz builds my Codex too.
7. As a player, I want a missed Blitz round to set its prompt to Missed, so that what the round revealed is kept.
8. As a player, I want a missed Default round whose typed port belongs to an entry to set that entry to Identified, so that Blitz misses teach like Daily misses.
9. As a player, I want a missed Inverted round to set the entry I picked to Identified, including a same-port pick, so that the service I confused it with is kept.
10. As a player, I want an invalid Blitz guess and a timed-out prompt to change nothing in my Codex, so that only a committed round counts.
11. As a player, I want a mid-run miss to be kept in my Codex even if I refresh before the run ends, so that a lost run does not cost me what I already learned.

### Codex rules

12. As a player, I want a state to only ever move up, Identified to Missed to Correct, so that a later miss never takes a Correct away.
13. As a player, I want miss-only entries to be able to enter my Codex, so that finding chargen by typing 19 still counts, even though it can only ever reach Identified.
14. As a player, I want browsing History to change nothing in my Codex, so that only play on a play surface counts.
15. As a player whose browser refuses to save, I want the existing "Progress may not save." notice and to keep playing, so that a storage failure never blocks play.

### Maintainer

16. As a maintainer, I want all Codex logic in a pure engine module, so that it is tested without the DOM.
17. As a maintainer, I want the new key versioned under the existing prefix and validated on read, so that corrupt data in the Codex key never breaks another key.
18. As a maintainer, I want the storage seam to stay synchronous and storage-agnostic, so that this ticket's record shape carries over unchanged when a later backend replaces the adapter.
19. As a maintainer, I want the Codex engine to also derive grouping and counts now, so that the later Codex screen ticket has a tested seam to render against rather than building its own.
20. As a maintainer, I want the Blitz page's Codex write kept minimal and next to the existing guess handling, so that this ticket's diff to `applyResult` — a function the already-landed round-log ticket left untouched — stays small and easy to review.
21. As a maintainer, I want no backfill: Dailies finished before release, and tries already committed at release, do not count, so that an existing player opens an empty Codex rather than one seeded from data collected before the Codex existed.

## Implementation Decisions

### Codex engine

- New pure module, `src/engine/codex.ts`. It owns the state machine — including clearing every fresh flag — and the two things a future Codex screen will read: card grouping and counts. All of this is required directly by the ticket body ("The module also clears every fresh flag, derives grouping..., and derives counts..."), not only by Spec 2.
- Types added to `src/engine/types.ts` (Spec 2 leaves these shapes to the implementing seam; this ticket fixes them for this module's boundary):
  - `CodexState = "identified" | "missed" | "correct"`.
  - `CodexRecord = { state: CodexState; fresh: boolean }`.
  - `CodexMap = Record<string, CodexRecord>` — keyed by entry id; an id with no record is Unseen.
  - `CodexEncounter = { state: CodexState; id: string }` — the field is named `state`, matching `CodexRecord`'s, since applying an encounter always means "this entry is now at least this state," and the three encounter kinds share the `CodexState` union.
- `applyCodexEncounter(map, encounter)`: precedence Unseen (0) < Identified (1) < Missed (2) < Correct (3). When the encounter's rank is not above the entry's current rank, the map is left unchanged — implemented by returning the exact same `map` reference (an interpretive choice beyond the ticket's literal "leaves the state unchanged," disclosed under Further Notes). When it is above, it returns a new map with that entry's record set to `{ state: encounter.state, fresh }`: `fresh` is `true` when the entry was Unseen, and carried over unchanged from the existing record on a Seen-to-Seen upgrade.
- `clearCodexFresh(map)`: returns a new map with every record's `fresh` set to `false`; states are untouched. Nothing in this ticket calls it — its caller is the future Codex screen's mount effect (per Spec 2: read the map with flags intact to render, then write it back with every flag cleared) — but it is required by the ticket body and covered by the ticket's acceptance criterion 1 and by Testing Decisions.
- `codexGroups({ map, protocols, applications, sort })`: returns a `CodexGroup[]`, one group per catalog kind, Protocols before Applications, each holding a `CodexCard[]` with one card per entry in that kind's catalog array. `CodexGroup = { kind: CatalogKind; cards: CodexCard[] }`. `CodexCard = { status: "unseen"; entry: CatalogEntry } | { status: CodexState; entry: CatalogEntry; fresh: boolean }` — unlike `CodexRecord`/`CodexEncounter`, its tag is named `status`. This codebase does not use one tag name for every union: `status` already names an outcome or lifecycle state (`GuessResult`, `InvertedGuessResult`, `DailyPersist.status`), while `kind` names a fixed category (`WrongAnswer`, `CatalogIssue`) and `type` an event or action (`BlitzEvent`). A Codex card's `???`/Identified/Missed/Correct reads as a lifecycle, the same family as `DailyPersist.status`, not a fixed category — so `status` fits it better than `kind` would. Sorting is a stable partition, not a plain sort: unseen entries keep the index they hold in the underlying catalog array; seen entries are sorted by the chosen key (`"name"`, case-folded; or `"port"`, ties broken by case-folded name) and placed into the remaining, non-unseen indices in that sorted order. This is what keeps an unseen card's position fixed in both sorts, per Spec 2's accepted port-order leak.
- `codexCounts({ map, protocols, applications })`: returns the overall `seen` (any state above Unseen) and `correct` counts, plus the same two counts per catalog kind. Totals (how many entries exist per kind or overall) are not part of this return value — a caller with the catalog arrays already has `protocols.length`, `applications.length`, and their sum.
- Retired entries are included in `protocols`/`applications` like any other entry (this module receives the full catalog arrays, the same ones `catalogFor` returns for `"mixed"`, not the answer-eligible-filtered pool), so they group and count normally. Miss-only entries (not answer-eligible) are included the same way; nothing in the engine special-cases them — they can only ever reach Identified because nothing ever emits a `correct` or `missed` encounter for an id that is never a Daily target or Blitz prompt.

### Persistence

- One new key, `portdle:v1:codex`, added to `src/persist/storage.ts` alongside the existing keys, read and written only through the existing `readJson`/`writeJson` helpers.
- `Persist` gains `readCodex(): CodexMap` and `writeCodex(value: CodexMap): { ok: true } | { ok: false }`.
- Validation is whole-value, matching the existing keys' pattern: the read value must be a non-null, non-array object whose every value is a `CodexRecord` (`state` one of `identified`/`missed`/`correct`, `fresh` a boolean). If any single entry fails, the whole read returns `{}` — not a partial map. Corrupt JSON reads as `{}` the same way. A write failure returns `{ ok: false }`, letting the caller raise the existing "Progress may not save." notice; it never blocks play.
- No `codexSort` key. Spec 2 lists it as a third new key for the Codex screen's sort toggle, but this ticket ships no screen and its acceptance criteria do not mention it; it is deferred to the ticket that builds the Codex screen.

### Daily encounters

- `src/ui/daily-page.tsx`'s `submitGuess` gains two write points, both after the existing invalid/duplicate early returns (so an invalid or duplicate guess never reaches them):
  - Immediately after a committed guess, when `result.status === "miss"` and `result.identified` is not null: write an `identified` encounter for `result.identified.id`. This fires on every such committed try, independent of whether that try ends the Daily.
  - Inside the existing `if (next.status === "won" || next.status === "lost")` block: write `correct` for a Daily that ends `won`, `missed` for one that ends `lost` (naming `DailyPersist.status`'s existing literal values, which this ticket does not rename), for the puzzle's own id (`puzzle.id`). This keeps today's "only on Daily end" timing that block already expresses.
- Both writes go through a small local helper next to the existing `noteWrite`, reading the current Codex, applying the encounter, and writing the result back; a write failure feeds the same `noteWrite`/save-warning path already in place.

### Blitz encounters

- `src/ui/blitz-page.tsx`'s `submitGuess` and `submitInverted` each capture `run.currentId` — the prompt being answered, read before the reducer call — and pass it into `applyResult` as a parameter.
- `applyResult`, after its existing invalid/duplicate early returns (so an invalid guess or a duplicate inverted pick never reaches this), writes:
  - `correct` for the prompt id when the committed result is correct (`result.guess?.status === "correct"` or `result.inverted?.status === "correct"`).
  - Otherwise `missed` for the prompt id, and additionally an `identified` encounter for the entry the wrong answer points at: the typed port's owner, `result.guess.identified`, when it is not null (Default); or the wrong answer itself, `result.inverted.identified` (Inverted — the glossary's Wrong answer for Inverted already is the picked entry, always present on a miss, including a same-port pick).
- A guess's encounter(s) go through a small local helper mirroring Daily's in shape, but batched: it reads the current Codex once, folds every encounter from the guess into it in turn, and writes the result back once — a correct guess produces one encounter, a miss up to two, and both ever reach the store together, never through separate read-modify-write round trips. A write failure sets `saveWarning` to `true` directly, the same way `recordBest`'s existing write-failure branch already does — unlike Daily's `noteWrite`, no new save-warning-specific helper name is introduced on this page, since Blitz already sets `saveWarning` inline rather than through a named wrapper — so the shared "Progress may not save." notice (rendered by `ProgressNotice`) covers a Codex write failure too.
- Timeout continues to go through the existing `expire()` path, which never calls `applyResult`, so a timed-out prompt writes nothing — unchanged.
- This keeps the touched surface of `applyResult` to the added parameter and the write calls. Ticket #72 (Blitz round log) has already merged into master, but its changes to `blitz-page.tsx` added new rendering only (the round log, the `Round {n}` HUD text) — its `rounds` bookkeeping lives in the pure reducer (`src/engine/blitz.ts`), and it left `applyResult` itself untouched. This ticket's diff to `applyResult` stays small and easy to review.
- No surface other than Daily's `submitGuess` and Blitz's `applyResult` calls a Codex write: History today only reads the store, and so will the arena and the Codex screen once they ship, matching every other row of Spec 2's encounter table ("Viewing History or the arena" and "Viewing the Codex" both "nothing").

## Testing Decisions

A good test exercises a public seam with literal inputs and asserts a pure function's return value or what a player or maintainer can observe through the store — never internal state, class names, or a storage read mid-render.

1. **Engine seam** (`src/engine/codex.test.ts`, new file; prior art: `src/engine/stats.test.ts`, `src/engine/blitz.test.ts`, `src/engine/history.test.ts`).
   - `applyCodexEncounter`: `identified`/`missed`/`correct` on an unseen id gives Identified/Missed/Correct with `fresh: true`; `missed` on Identified gives Missed keeping `fresh` as it was (tested both `true` and `false`); `correct` on Missed and `correct` on Identified each give Correct keeping `fresh` as it was; every non-upgrading encounter (`identified` on Identified, Missed, or Correct; `missed` on Missed or Correct; `correct` on Correct) leaves the map unchanged, asserted as the exact same object reference (the implementation choice explained under Implementation Decisions and disclosed under Further Notes).
   - `clearCodexFresh`: clears every `fresh` flag and leaves every `state` intact.
   - `codexCounts`: a map with one of each state (Identified, Missed, Correct) reads `seen: 3, correct: 1`; a map with two protocol entries and one application entry seen reads a Protocols count of 2 and an Applications count of 1.
   - `codexGroups`: the Protocols group precedes the Applications group; name sort (case-folded) sorts "chargen" between "BGP" and "Daytime"; port sort breaks ties by case-folded name; an unseen entry keeps its original catalog-array index in both the name sort and the port sort.
2. **Persist seam** (extend `src/persist/storage.test.ts`, following the file's existing pattern).
   - A Codex value with a state outside `identified`/`missed`/`correct` reads as `{}`; corrupt JSON under the Codex key reads as `{}`; a write failure returns `{ ok: false }`; writing or corrupting the Codex key does not touch or clear any neighboring key (theme, a Daily, stats, Blitz bests).
3. **App seam** (render the app with a memory store, memory history, and an injected UTC day; prior art `src/ui/mixed-daily.test.tsx`, `src/ui/blitz.test.tsx`, `src/ui/app.test.tsx`; Blitz tests derive the current entry from the heading and inject no rng into the page, as today).
   - Winning a Daily records its target as Correct in the store; losing records it as Missed; a Daily try on a known wrong port records that entry as Identified.
   - A correct Blitz round records the prompt as Correct; a Default miss on a known port records the prompt as Missed and the port's owner as Identified; a Default miss on an unowned port records the prompt as Missed and nothing else; an Inverted miss records the prompt as Missed and the pick as Identified, including a same-port pick.
   - A mid-run miss writes the Codex before the run ends (asserted by reading the store immediately after the miss, before lives reach zero or time runs out).
   - An invalid Daily try, a duplicate Daily try, an invalid Blitz guess, a timeout mid-prompt, and a History visit each leave the stored Codex unchanged (asserted against the map read before and after the action).
   - The existing Daily and Blitz test suites stay green with no behavior changes beyond the new writes.

No snapshot tests, no visual regression, no Playwright. This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` all passing, plus the seam coverage above.

## Out of Scope

- The Codex screen, its route, its nav item, and the How-to's Codex line — a later ticket.
- The `codexSort` key and any sort-toggle persistence — belongs with the Codex screen.
- The Blitz round log and `rounds` on `BlitzState` — ticket #72, already merged into master; this ticket does not touch the Blitz reducer's shape. `BlitzRun`, the `blitzRuns` key, and the Blitz arena/dialog — not built by #72 either (deferred by its own Out of Scope), left to later Blitz-arena tickets.
- The History Blitz segment and switcher — a later ticket.
- Backfilling the Codex from Dailies finished, or tries already committed, before this ships.
- Any change to Daily or Blitz game rules, scoring, timers, or catalog content.

## Further Notes

- Primary sources: the body of issue #73 "Codex engine, codex key, and every encounter"; Spec 2's "Persistence", "Encounters and the Codex engine", and "Testing Decisions" sections; ADR 0001 "localStorage until a backend".
- Glossary: `CONTEXT.md` already defines Entry, Catalog kind, Encounter, Play surface, Unseen, Seen, Identified, Missed, Correct, Miss identification, Answer-eligible, Miss-only, Try, Run, Prompt, Round, Wrong answer, and History; this ticket introduces no new glossary terms and uses all of the above as defined. "Seen" is used only as the umbrella for any state above Unseen, never as a synonym for Identified alone. `fresh` (the field on `CodexRecord`) is deliberately not a glossary term — Spec 2 says so explicitly ("`fresh` is a persistence field; none are glossary terms"), so its absence from `CONTEXT.md` is by design, not an oversight.
- ADR 0001 continues to hold: the Codex map is plain JSON behind the existing synchronous seam, keyed by entry id, so a later backend import is mechanical.
- Implementation Decisions is grouped by code module (Codex engine, Persistence, Daily encounters, Blitz encounters) rather than mirroring User Stories' groupings (Daily encounters, Blitz encounters, Codex rules, Maintainer) one-for-one, since the engine and persistence changes each cut across more than one story group. Every user story is still covered: within the User Stories heading "Codex rules" (12-15), stories 12 and 13 fall under Implementation Decisions' Codex engine section and story 14 under its Blitz encounters section, while story 15 falls under Persistence; the Maintainer stories (16-21) are spread across Codex engine, Persistence, Blitz encounters, and Out of Scope (the no-backfill story).
- Testing Decisions is organized by seam (Engine, Persist, App), matching Spec 2's own Testing Decisions structure and this repo's established prior art (separate engine test files per module, one storage persist-test file, and app-seam UI test files), rather than mirroring Implementation Decisions' code-module subsections one-for-one. The single App-seam item's bullets individually itemize the Daily-encounters and Blitz-encounters behavior each corresponding Implementation Decisions subsection describes, so nothing from either subsection goes untested.
- Author calls made while writing this spec, not settled by the ticket or Spec 2, listed so they can be overruled: every function and type name in `src/engine/codex.ts` and its exports beyond the two shapes Spec 2 names verbatim, `CodexState` and `CodexRecord` — `applyCodexEncounter`, `clearCodexFresh`, `CodexEncounter`, `CodexMap`, `codexGroups`, `codexCounts`, `CodexCard`, and `CodexGroup`, plus `codexGroups`/`codexCounts`'s return shapes (Spec 2 explicitly leaves all of this to the implementing seam); reading the ticket's "leaves the state unchanged" as literal reference-identity for a no-op encounter (`applyCodexEncounter` returns the identical `CodexMap` object, not just an equal one) rather than only value-equality, since it costs nothing to implement and matches Spec 2's own phrasing ("returns the map unchanged") most literally; writing the Codex unconditionally on every encounter rather than having a caller skip the write when `applyCodexEncounter` returns that same reference (both are observably identical to a reader, since the stored map is unchanged either way; the simpler, unconditional path was chosen); the small per-page write helper is duplicated between `daily-page.tsx` and `blitz-page.tsx` rather than extracted to a shared module, to keep each page's diff minimal.
