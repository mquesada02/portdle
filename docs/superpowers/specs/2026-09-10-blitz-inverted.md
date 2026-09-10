# Spec: Blitz Inverted

Spec for #6. Tracker: https://github.com/mquesada02/portdle/issues/18

## Problem Statement

A player can run Blitz in Default orientation (name in, port out), but setup does not offer Inverted. They cannot see a port, search names, or pick a row. Crowded ports have no on-screen blurb, and a wrong name does not teach the other mapping.

## Solution

`/blitz` setup includes Orientation: Default and Inverted. Inverted is port in, name out: the player sees the target port (plus a name-free blurb when that port is crowded in the chosen Daily category), searches by prefix on name and aliases, and submits only a listed row. Correct is the target `id`. A miss spends a life and shows `{name} is {port}`, or `Wrong service, same port.` when the picked row shares the target port. Duplicate `id` on the same item spends no life. Lives, timer, exclusion, reshuffle, end screen, and bests follow Default; inverted bests use the `inverted` orientation key. Default play is unchanged.

## User Stories

1. As a player on `/blitz` setup, I want an Orientation choice of Default and Inverted, so that I can start either skill.
2. As a player on setup, I want Default selected until I change it, so that Start without extra picks is still Default.
3. As a keyboard-only player, I want to pick Orientation without a pointer, so that Inverted is reachable from the keyboard.
4. As a player who starts Mixed Inverted Sprint, I want a Mixed pool, Inverted orientation, and a 60s timer, so that the picks match the run.
5. As a player who starts Protocols Inverted Marathon, I want a Protocols pool and a 300s timer, so that category and mode do not leak from Mixed Sprint.
6. As a player who starts Applications Inverted Survival, I want an Applications pool and no timer, so that Survival is lives only.
7. As a player who starts Default after this ticket, I want the same Default run as #5 (name `h1`, Port digits, one-shot ports), so that Inverted does not replace Default.
8. As a player in an Inverted run, I want the current entry's port as the `h1` with no leading zeros, so that I know which number to map to a name.
9. As a player whose current port is unique among non-retired entries in the chosen Daily category, I want the number only, so that a unique port is not padded with a blurb.
10. As a player whose current port is crowded among non-retired entries in the chosen Daily category, I want that entry's `blurb` as well, so that I can tell crowded services apart without seeing the name.
11. As a player on Mixed Inverted, I want crowding measured on the Mixed union, so that a port unique in Protocols but shared in Applications is treated as crowded.
12. As a player on Protocols Inverted, I want crowding measured on Protocols only, so that an Applications-only roommate does not make a Protocols port crowded.
13. As a player, I want the blurb to omit the entry's name and aliases, so that the prompt does not spoil the answer.
14. As a player in an Inverted run, I want a search control named Service name, so that I can type a prefix.
15. As a player who has typed nothing (empty or whitespace query), I want an empty list and "No matches.", so that the catalog is not dumped.
16. As a player who types a prefix of a canonical name, I want matching rows after a 200ms debounce, so that I can pick from names.
17. As a player who types a prefix of an alias, I want that service's row (canonical name), so that aliases find the same entry.
18. As a player who types a string that only appears in description or blurb, I want no rows, so that flavor text is not searchable.
19. As a player, I want matches case-folded, so that `HTTP` and `http` find the same rows.
20. As a player, I want name-prefix matches before alias-prefix matches, then names sorted with `localeCompare`, so that the list order is stable.
21. As a player whose query matches more than 20 rows, I want at most 20, so that the list stays short.
22. As a player, I want miss-only and retired entries in the search list, so that I can still pick them as wrong guesses.
23. As a player, I want each row to show the canonical `name` (not the alias token), so that I pick a service, not a nickname.
24. As a player, I want the list to be a `listbox` of `option`s, so that assistive tech treats it as a picker.
25. As a keyboard-only player, I want ↑/↓ to move the highlight and Enter to submit the highlighted listed row, so that I can play without a pointer.
26. As a player with a pointer, I want a click on a listed row to submit that row's `id`, so that I can pick without the keyboard.
27. As a player, I want a submit that is not a listed row to do nothing (no life spent, same item, no invalid port copy), so that garbage cannot be guessed.
28. As a player who submits the current item's `id`, I want score increased by 1 and the next item, so that a hit counts.
29. As a player who selects the current item via an alias, I want that to count as correct, so that aliases only select the row and the engine compares `id`.
30. As a player who submits a different `id` whose port is not the target, I want "{name} is {port}" using the picked entry, a life spent, and the next item, so that a wrong name teaches the other mapping.
31. As a player who submits a different `id` whose port equals the target, I want "Wrong service, same port.", a life spent, and the next item, so that a crowded miss is distinct.
32. As a player who submits the same `id` already submitted on this item, I want "Already guessed.", no spent life, and the same item, so that a duplicate does not count.
33. As a player, I want three lives, visible lives and score, Sprint 60s / Marathon 300s wall-clock timer, Survival with no timer, and no Skip, so that Inverted uses the same lives and timer rules as Default.
34. As a player, I want the start pool to be answer-eligible, not retired, in the chosen Daily category, minus today's three Daily ids, so that exclusion matches Default.
35. As a player whose remaining pool is empty after a correct or a miss with lives left, I want a reshuffle of the start pool, so that the run can continue.
36. As a player who starts when the filtered pool is empty, I want "Cannot start Blitz: not enough unused answers today.", so that an empty pool cannot begin.
37. As a player whose third miss ends the run, I want "Out of lives", the score, and the stored best for this Daily category, Inverted orientation, and mode.
38. As a player whose Sprint or Marathon timer ends the run, I want "Time's up", the score, and that same stored best.
39. As a player who finishes an Inverted run with a new best, I want it stored under `{category}|inverted|{mode}`, so that Default bests are not overwritten.
40. As a player who has a Default best for the same category and mode, I want that Default best unchanged by an Inverted finish, so that orientation keys do not leak.
41. As a player on the end screen, I want Play again to return to setup, so that I can start a new run.
42. As a player who refreshes during an Inverted run, I want setup again with the run discarded, so that a Blitz run is not persisted.
43. As a player in a run, I want status messages in an `aria-live` region, so that miss, duplicate, and empty-list copy are announced.
44. As a player, I want one `h1` per screen (Blitz on setup and end; the port during an Inverted run; the canonical name during a Default run).
45. As a player, I want English copy only, committed port digits still monospace on Default, and service names in the UI sans-serif.
46. As a maintainer, I want inverted guess and prefix search to be pure TypeScript with injected catalogs, so that tests do not use the DOM or the clock.
47. As a maintainer, I want the Blitz reducer to accept `orientation: "inverted"` and an inverted-guess event, so that start and reduce stay the engine seam.

## Implementation Decisions

- **Seams** (already implied by the v1 design spec §7.2, §7.3, §7.4, §9.4 and ticket #6; no new seam): (1) **engine** — pure functions, no React, no DOM, no `localStorage`; inverted guess, prefix search, crowding, and Blitz start + reduce; (2) **persist** — existing `blitzBests` (already typed with `Orientation`); (3) **UI** — `/blitz` setup then in-page run, Vitest + Testing Library through `App`. Tests inject catalogs, schedules, `utcToday`, and RNG at the engine. The browser UI keeps production catalogs, committed schedules, `Math.random`, and wall-clock timer from #5. Do not add a catalog-injection or RNG-injection seam on `App`.

- Closed unions (already shipped; this ticket starts using `inverted`):

  ```ts
  type Orientation = "default" | "inverted"
  type InvertedGuessResult =
    | { status: "duplicate" }
    | { status: "correct"; id: string }
    | { status: "miss"; id: string; identified: Identified; samePort: boolean }
  type SearchHit = { id: string; name: string }
  ```

- Inverted guess:

  ```ts
  evaluateInvertedGuess({
    id, answer, previousIds, catalog
  }): InvertedGuessResult
  ```

  Look up `id` in `catalog`. Unknown `id` is a programmer error (the picker cannot produce it); throw. Same `id` already in `previousIds` → `{ status: "duplicate" }`. `id === answer.id` → `{ status: "correct", id }`. Else `{ status: "miss", id, identified: { id, name, port } of the picked row, samePort: picked.port === answer.port }`. Aliases are not compared; only `id`. The picked row is the identified row (not lexicographically smallest on that port).

- Prefix search:

  ```ts
  buildSearchIndex(catalog): SearchIndex
  searchNames(index, query): SearchHit[]
  ```

  Index the **chosen Daily category** catalog (full, including miss-only and retired). Tokens per entry: canonical `name` plus each alias, `toLowerCase`. Query: trim then `toLowerCase`. Empty query (including whitespace-only) → `[]`. Match: any token `startsWith` the query (prefix, not infix). Description and blurb are not indexed. Sort: name-prefix matches first, then alias-prefix (name did not prefix but an alias did), then `name.localeCompare`. Cap 20 after sort. Each hit is `{ id, name }` with the canonical name.

- Crowding (same rule as catalog validation): a port is crowded in a catalog when two or more **non-retired** entries share that `port`. Mixed = union of both JSON files. Unique → inverted shows the number only. Crowded → also show that entry's `blurb`. Export this as a pure `isCrowdedPort(entries, port)` used by inverted UI. Do not show `name` or aliases in the prompt.

- Blitz engine (widen #5):

  ```ts
  type BlitzState = {
    category: DailyCategory
    orientation: Orientation
    mode: BlitzMode
    lives: number
    score: number
    remainingIds: string[]
    currentId: string
    startPool: string[]
    ended: null | "lives" | "timeout"
  }

  type BlitzEvent =
    | { type: "default-guess"; digits: string }
    | { type: "inverted-guess"; id: string }
    | { type: "timeout" }

  startBlitz({ category, orientation, mode, utcToday, protocols, applications, schedules, rng })
  reduceBlitz({ state, event, protocols, applications, rng }): {
    state: BlitzState
    guess?: GuessResult
    inverted?: InvertedGuessResult
  }
  ```

  `startBlitz` records the given `orientation` (`"default"` or `"inverted"`). Start pool, lives 3, score 0, exclusion of today's three Daily ids, Fisher–Yates shuffle, empty-pool error, advance, reshuffle, and `timeout` are unchanged from #5.

  `inverted-guess` (only meaningful when `state.orientation === "inverted"`): `evaluateInvertedGuess({ id, answer, previousIds: [], catalog })` with `catalogFor(state.category, …)` and the entry whose `id === state.currentId`. Duplicate: same `state`, return `inverted`. Correct: `score += 1`, then advance. Miss: `lives -= 1`; if `lives === 0`, `ended: "lives"` and keep `currentId`; else advance. Each item is one shot, so `previousIds` is always empty at reduce time; duplicate still has the §7.2 meaning and must not change state if it ever occurs. `default-guess` on an inverted state, or `inverted-guess` on a default state: return the same `state` with no `guess` / `inverted`. Ended state: no-op, as in #5.

- Persist: no new keys. Best update on run end uses `` `${category}|${orientation}|${mode}` `` (Default still writes `default`; Inverted writes `inverted`). Equal score does not write. Missing or corrupt `blitzBests` still reads `{}`. Do not persist the run. Do not write Daily / stats / `lastPlayed` from Blitz.

- `/blitz` UI:

  Setup: `h1` Blitz. Keep Daily category and Mode radios from #5. Replace the static Default label with Orientation radios labelled `Default` / `Inverted` (group name `Orientation`). Initial selections: Mixed, Default, Sprint. Start named `Start`. Empty pool copy unchanged.

  Inverted run: `h1` is `String(answer.port)` (no leading zeros). If `isCrowdedPort(category catalog, answer.port)`, also show `answer.blurb` (not in the `h1`). Lives, score, remaining time as #5. No Port digits. Combobox named `Service name`. Debounce 200ms, then `searchNames`. Listbox (`role="listbox"`) of options (`role="option"`, accessible name = canonical `name`). Empty list: `No matches.` Click an option or Enter on the highlighted option submits that `id`. No listed row selected → Enter / Submit does nothing (no Default "Not a valid port."). Duplicate copy `Already guessed.` Miss with `samePort === false`: `{identified.name} is {identified.port}`. Miss with `samePort === true`: `Wrong service, same port.` Then next item (or end). No Skip.

  Default run, timer, end screen, Play again, How-to, Help, theme, nav, History heading, and Daily routes stay as shipped, except end-screen bests read the run's orientation key.

- Production RNG remains `Math.random`. Search debounce is UI-only. Engine search is synchronous. UI tests use Vitest fake timers to advance 200ms after typing; do not sleep.

- No Playwright, no GitHub Actions this ticket. No cookies, analytics, accounts, or network besides static assets.

## Testing Decisions

A good test checks observable behavior through a public interface. It does not inspect private helpers, mock internal collaborators, or recompute the expected value the way the production code does. Expected values are literals from this spec (copy `No matches.` / `{name} is {port}` / `Wrong service, same port.` / `Already guessed.`, debounce 200ms, cap 20, bests key `mixed|inverted|sprint`, 3 lives, Sprint 60).

Three seams (same as Implementation Decisions):

1. **Engine** — `evaluateInvertedGuess`, `buildSearchIndex` / `searchNames`, `isCrowdedPort`, `startBlitz`, `reduceBlitz`. Inject tiny catalogs, tiny schedules, `utcToday`, and `rng`. Cover: inverted correct `id`; miss other port identifies the picked row with `samePort: false`; miss same port sets `samePort: true`; duplicate `id` in `previousIds` returns `duplicate`; unknown `id` throws; search name prefix; search alias prefix returns the canonical-name row; empty / whitespace query is `[]`; description / blurb text does not match; case-fold; name-prefix before alias-prefix then `localeCompare`; cap 20; miss-only and retired rows are searchable; `isCrowdedPort` is true for two non-retired entries on the same port and false when the roommate is retired or in the other catalog kind; Mixed union is crowded when each kind has one occupant; `startBlitz` with `orientation: "inverted"` sets that orientation and still excludes today's three Daily ids; inverted correct increments score and changes `currentId`; inverted miss decrements lives and advances while lives remain; inverted duplicate (via `evaluateInvertedGuess`) spends no life; `timeout` and empty-pool and reshuffle still work; Default `default-guess` still works on a default run. Do not test Daily persist or History.

2. **Persist** — existing adapter. Cover a round-trip `{ "mixed|inverted|sprint": 4 }` and that writing an inverted key does not drop a stored `mixed|default|sprint` value. Do not use `window.localStorage`. Do not add persist methods.

3. **UI** — Vitest + Testing Library + jsdom through `App`. Inject persist, memory history, `utcToday` `2026-09-09`. Cover: setup has Orientation radios Default and Inverted, Default selected; Start Inverted Mixed Sprint shows a numeric `h1` that is not a service name, lives 3, score 0, time 60, no Port digits, a Service name combobox; empty query shows `No matches.` and no options; after typing a name prefix and advancing 200ms, a listed option with that canonical name appears; Enter without a listed selection does not change lives; clicking a listed row whose port is not the heading port shows `{name} is {port}`, decrements lives, and advances; when the heading port is crowded in Mixed, a blurb from a Mixed entry on that port is shown; when unique, no blurb; an Inverted finish writes `mixed|inverted|sprint` and does not write `mixed|default|sprint` or a Daily key; Default Start still shows a service-name `h1` and Port digits; Play again returns to setup; How-to, History heading, and Mixed Daily still work. Do not assert CSS class names except existing `html.dark` shell tests. Do not add an App catalog-injection seam.

Prior art: engine tests next to sources with injected catalogs; persist injected-store tests; Blitz Default and Mixed Daily through `App`. Follow those. Do not introduce Playwright.

Typecheck and the full Vitest suite pass.

## Out of Scope

- Inverted Daily
- Skip, archive play, History rows
- Accounts, leaderboards, PWA, i18n, custom domain, IANA scrape
- Changing Daily guess rules, schedules, or `gen:schedule`
- GitHub Actions / GitHub Pages deploy
- Changing How-to copy, theme rules, or nav labels
- Cookies, analytics, backend, UI kit, Redux/Zustand
- Persisting a Blitz run
- A pause control
- Changing Default lives, timer, exclusion, or digit-slot behavior beyond adding Orientation

## Further Notes

- Product and architecture authority is `docs/superpowers/specs/2026-09-08-portdle-design.md`. This spec is ticket #6 only.
- Glossary: Entry, catalog kind, Daily category, Mixed, answer-eligible, miss-only, Daily, Orientation, Blitz, Sprint, Marathon, Survival. Do not say "mode" for Daily category or "tutorial" for How-to. Mode means `BlitzMode`.
- Transport is never part of the guess.
- Aliases are search keys for the same service; they are not Blitz titles and not separate rows.
- Daily and Blitz do not share a live session.
- Ticket #5 shipped Default; this ticket adds Inverted and must not regress Default.
