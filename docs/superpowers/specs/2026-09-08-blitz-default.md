# Spec: Blitz Default

Spec for #5. Tracker: https://github.com/mquesada02/portdle/issues/16

## Problem Statement

A player can play the three Dailies, but `/blitz` is still a placeholder heading. They cannot pick a Daily category, Default orientation, and Sprint / Marathon / Survival, type ports one-shot, or keep a local best score. There is no timed run, no lives, and no pool that excludes today's three Daily ids.

## Solution

`/blitz` is Blitz in Default orientation: the player picks a Daily category and a mode (Sprint 60s, Marathon 300s, or Survival), then types ports one-shot against a shuffled pool of answer-eligible, non-retired entries in that category minus today's three Daily ids. Three lives. Invalid and duplicate guesses do not spend a life and do not advance. A miss spends a life and shows catalog identification, then the next item (or the end screen if lives hit 0). Sprint and Marathon end on a wall-clock timer or three misses; Survival ends on lives only. The run is not persisted (refresh returns to setup). Best scores persist per Daily category, Default orientation, and mode. Inverted search is not this ticket.

## User Stories

1. As a player who opens `/blitz`, I want a setup screen headed Blitz, so that I know I am on Blitz and not a Daily.
2. As a player on setup, I want to pick a Daily category (Mixed, Protocols, or Applications), so that the run uses that category's catalog.
3. As a player on setup, I want Default orientation (name in, port out), so that I type ports and am not asked to search names.
4. As a player on setup, I want no Inverted start option, so that this ticket does not ship inverted search.
5. As a player on setup, I want to pick Sprint, Marathon, or Survival, so that I choose timer versus lives-only.
6. As a player, I want Sprint labelled so I know it is 1 minute, so that the 60s timer is not a surprise.
7. As a player, I want Marathon labelled so I know it is 5 minutes, so that the 300s timer is not a surprise.
8. As a player, I want Survival labelled without a time, so that I know it is lives only.
9. As a player on setup, I want Mixed, Default, and Sprint selected until I change them, so that Start works without extra picks.
10. As a player, I want a Start control, so that I can begin the run.
11. As a keyboard-only player, I want to pick category, pick mode, and activate Start without a pointer, so that setup is reachable from the keyboard.
12. As a player who starts Mixed Default Sprint, I want a run that uses the Mixed catalog, Default orientation, and a 60s timer, so that the picks match the run.
13. As a player who starts Protocols Default Marathon, I want a Protocols pool and a 300s timer, so that category and mode do not leak from Mixed Sprint.
14. As a player who starts Applications Default Survival, I want an Applications pool and no timer, so that Survival is lives only.
15. As a player in a run, I want to see the current entry's canonical `name` as the `h1`, so that I know which service to map to a port.
16. As a player in a run, I want empty digit slots equal to the decimal length of that item's port with no leading zeros, so that slot count matches Daily Default.
17. As a player in a run, I want the same Port digits control as Daily (labelled group, `inputMode="numeric"`, digits only, Backspace, Enter or Submit), so that Default Blitz is the same typing skill as Daily.
18. As a player, I want one shot per item, so that a committed miss or correct moves me on.
19. As a player who submits a correct port, I want score increased by 1 and the next item, so that a hit counts and the run continues.
20. As a player who submits a miss whose port exists in this Blitz category's catalog (including retired and miss-only), I want that entry's name, a life spent, and the next item, so that a wrong port still teaches me what it maps to.
21. As a player who misses with a port that is not in this Blitz category's catalog, I want "Not in this catalog.", a life spent, and the next item, so that an unused number is explained.
22. As a player on Protocols Blitz who guesses a port that exists only in Applications, I want "Not in this catalog.", so that Mixed union does not leak into Protocols Blitz.
23. As a player on Applications Blitz who guesses a port that exists only in Protocols, I want "Not in this catalog.", so that Mixed union does not leak into Applications Blitz.
24. As a player on Mixed Blitz who guesses a port that exists in either catalog, I want that entry's name, so that Mixed identification stays the union.
25. As a player whose miss port is shared by several entries in this Blitz category's catalog, I want the lexicographically smallest `id`, so that identification stays deterministic.
26. As a player who misses with a retired entry's port, I want that retired name, so that retired rows still name misses and are not Blitz targets.
27. As a player who misses with a miss-only entry's port, I want that miss-only name, so that non-answer rows still name misses.
28. As a player who submits an incomplete, non-digit, or `> 65535` guess, I want "Not a valid port.", no spent life, and the same item, so that garbage does not count.
29. As a player who submits a port already committed on this item, I want "Already guessed.", no spent life, and the same item, so that a duplicate does not count.
30. As a player who types leading zeros in a longer slot string, I want the guess treated as the integer (`0080` → 80), so that padding zeros collapse like Daily.
31. As a player, I want three lives at the start of every run, so that three misses end the run.
32. As a player, I want lives and score visible during the run, so that I know how I am doing.
33. As a player on Sprint, I want remaining time visible in whole seconds starting at 60, so that I can see the 1-minute clock.
34. As a player on Marathon, I want remaining time visible in whole seconds starting at 300, so that I can see the 5-minute clock.
35. As a player on Survival, I want no remaining-time display and no timeout, so that Survival is lives only.
36. As a player on Sprint or Marathon, I want the timer to use wall clock (`Date.now()`), so that a backgrounded tab still consumes time and there is no pause.
37. As a player on Sprint whose wall clock reaches 60s, I want the run to end as timeout even if I still have lives, so that Sprint is timed.
38. As a player on Marathon whose wall clock reaches 300s, I want the run to end as timeout even if I still have lives, so that Marathon is timed.
39. As a player who reaches 0 lives before the timer, I want the run to end as lives, so that three misses end any mode.
40. As a player, I want no Skip control, so that I cannot bypass an item.
41. As a player whose remaining pool is empty after a correct or a miss with lives left, I want a fresh shuffle of the start pool (including already-solved ids) and the next item, so that the run can continue.
42. As a player, I want the start pool to be answer-eligible, not retired, in the chosen Daily category, minus today's three Daily ids (Mixed, Protocols, and Applications), so that Blitz does not reuse today's Dailies.
43. As a player who starts Protocols Blitz, I want Mixed and Applications Daily ids excluded too, so that exclusion is always the three Daily ids, not only this category's Daily.
44. As a player who starts when that category's filtered pool is empty, I want Start to fail with "Cannot start Blitz: not enough unused answers today.", so that an empty pool cannot begin a run.
45. As a player in a run, I want status messages in an `aria-live` region, so that invalid, duplicate, and miss outcomes are announced.
46. As a player whose third miss ends the run, I want an end screen with the score, "Out of lives", and a comparison to the stored best, so that I know why it ended and how I did.
47. As a player whose Sprint or Marathon timer ends the run, I want an end screen with the score, "Time's up", and a comparison to the stored best, so that timeout is distinct from lives.
48. As a player on the end screen, I want a Play again control that returns to setup, so that I can start a new run.
49. As a player who finishes a run with a score greater than the stored best for that Daily category, Default orientation, and mode, I want the new best persisted, so that a personal record sticks.
50. As a player who finishes a run with a score equal to the stored best, I want the stored best unchanged, so that ties do not rewrite.
51. As a player who finishes a first run for that key with any score (including 0), I want that score stored as the best, so that a first finish creates a best.
52. As a player who then plays a different Daily category or mode, I want that other key's best unchanged, so that bests do not leak across keys.
53. As a player who refreshes during a run, I want to return to setup with that run discarded, so that a Blitz run is not persisted.
54. As a player who refreshes after a run that wrote a best, I want the best still there and the run gone, so that only bests persist.
55. As a player whose `blitzBests` JSON is corrupt, I want that key ignored (no bests), so that one bad key does not crash Blitz.
56. As a player whose browser cannot write storage, I want "Progress may not save." and a still-playable run, so that quota failure is not a lockout.
57. As a player, I want Daily boards, stats, and `lastPlayed` unchanged by Blitz, so that Daily and Blitz do not share a live session.
58. As a first-time player on `/blitz`, I still want the How-to dialog, so that teaching is not lost.
59. As a player, I want Help, theme, nav, History (heading History), and the three Dailies unchanged, so that this ticket does not ship History rows or inverted search.
60. As a keyboard-only player, I want to complete a Default Blitz item (slots + Submit) without a pointer, so that a run is playable from the keyboard.
61. As a player, I want one `h1` per screen (Blitz on setup and end; the current canonical name during a run), so that heading structure stays one per screen.
62. As a player, I want English copy only, so that v1 stays one locale.
63. As a player, I want committed port digits in monospace and the service name in the UI sans-serif, so that Blitz matches Daily visual tone.
64. As a maintainer, I want the Blitz reducer to stay pure TypeScript with injected catalogs, schedules, `utcToday`, and RNG, so that tests do not use the clock or `localStorage`.
65. As a maintainer, I want Orientation and BlitzMode closed unions available for persist keys, so that bests keys match v1 even though Inverted is not playable yet.

## Implementation Decisions

- **Seams** (already implied by the v1 design spec; no new seam): (1) **engine** — pure functions, no React, no DOM, no `localStorage`; Blitz start + reduce, reusing `catalogFor`, `answerPool`, `getDaily`, `evaluateDefaultGuess`, and injected RNG; (2) **persist** — existing `createPersist(injected KeyValueStore)` plus `blitzBests`; (3) **UI** — `/blitz` setup then in-page run (no run sub-route), Vitest + Testing Library through `App`. Tests inject `utcToday`, catalogs, schedules, and RNG at the engine. The browser UI passes `utcToday` from the existing App injection (production: `utcDateString(new Date())`), loads the production JSON catalogs plus the three committed schedules, and uses `Math.random` as RNG. Timer is UI wall clock (`Date.now()`); the engine only receives a `timeout` event. Do not add a catalog-injection seam on `App` for empty-pool UI.

- Closed unions this ticket:

  ```ts
  type Orientation = "default" | "inverted"
  type BlitzMode = "sprint" | "marathon" | "survival"
  type BlitzBests = Partial<
    Record<`${DailyCategory}|${Orientation}|${BlitzMode}`, number>
  >
  ```

  `DailyCategory` is already `mixed` | `protocols` | `applications`. This ticket writes and reads only `default` orientation keys. Do not implement inverted guess, search index, or typeahead.

- Blitz engine:

  ```ts
  type BlitzState = {
    category: DailyCategory
    orientation: "default"
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
    | { type: "timeout" }

  startBlitz({
    category, orientation, mode, utcToday,
    protocols, applications, schedules, rng
  }): BlitzState | { error: "empty-pool" }

  reduceBlitz({
    state, event, protocols, applications, rng
  }): { state: BlitzState; guess?: GuessResult }
  ```

  `orientation` this ticket is always `"default"`. `rng` returns a number in `[0, 1)` (same contract as `mulberry32`).

- Start pool: `answerPool(catalogFor(category, protocols, applications))` ids, minus the three `getDaily(... utcToday)?.id` values for Mixed, Protocols, and Applications (omit a category when `getDaily` is null). Shuffle with Fisher–Yates: for `i` from `n - 1` down to `1`, swap `i` with `Math.floor(rng() * (i + 1))`. Empty → `{ error: "empty-pool" }`. Otherwise `lives: 3`, `score: 0`, `ended: null`, `startPool` = the shuffled ids, `currentId` = first id, `remainingIds` = the rest.

- Catalog for a guess: `catalogFor(state.category, protocols, applications)` (Mixed = union, including retired and miss-only). Answer for the current item is the catalog entry whose `id === state.currentId`.

- `default-guess`: `evaluateDefaultGuess({ digits, answer, previousPorts: [], catalog })`. Invalid or duplicate: return the same `state` and the `guess`. Correct: `score += 1`, then advance. Miss: `lives -= 1`; if `lives === 0`, `ended: "lives"` and keep `currentId`; else advance. Advance: if `remainingIds` is non-empty, `currentId` = first remaining, rest stay; if empty, Fisher–Yates shuffle a copy of `startPool` and deal `currentId` / `remainingIds` the same way as start. Each item is one shot, so `previousPorts` is always empty at guess time; duplicate still has the §7.1 meaning and must not change state if it ever occurs.

- `timeout`: `ended: "timeout"`, keep score, lives, and `currentId`. No `guess`. Survival UI never sends `timeout`; the reducer still applies it if sent.

- Events on an already `ended` state return that state unchanged (no further score or lives change).

- Persist: one key `portdle:v1:blitzBests` holding `BlitzBests`. Public methods `readBlitzBests(): BlitzBests` (missing or corrupt → `{}`) and `writeBlitzBests(value): { ok: true } | { ok: false }`. `setItem` throw → `{ ok: false }`. Do not persist the run. Do not write Daily / stats / `lastPlayed` from Blitz.

- Best update on run end (when `ended` becomes `"lives"` or `"timeout"`): let `key` be `` `${category}|default|${mode}` ``. Let `best` be `readBlitzBests()[key]`. If `best` is missing or `score > best`, write `{ ...bests, [key]: score }`. Equal score does not write.

- `/blitz` UI, in-page (no run sub-route):

  Setup: `h1` Blitz. Daily category radios labelled Mixed / Protocols / Applications (group name `Daily category`). Visible Default orientation (not a working Inverted choice). Mode radios labelled `Sprint (1m)` / `Marathon (5m)` / `Survival` (group name `Mode`). Initial selections: Mixed, Default, Sprint. Start control named `Start`. Empty pool on Start: stay on setup, show `Cannot start Blitz: not enough unused answers today.`

  Run: `h1` is the current entry's canonical `name`. Show lives, score, and (Sprint/Marathon only) remaining whole seconds. Remaining seconds at t=0 are 60 (Sprint) or 300 (Marathon). Deadline is `Date.now() + durationMs` at Start (`60000` / `300000`). Remaining display is `max(0, Math.ceil((deadline - Date.now()) / 1000))` until `Date.now() >= deadline`, then dispatch `timeout`. Do not decrement a tick counter; backgrounded tabs still consume wall time. DigitSlots + Submit as Daily. Invalid copy `Not a valid port.` Duplicate copy `Already guessed.` Miss with `identified`: show `identified.name`. Miss with null: `Not in this catalog.` Then next item (or end). No Skip.

  End: `h1` Blitz. Show score, `Out of lives` or `Time's up`, stored best for this key (or none), `Play again` → setup (discard run state; keep bests). How-to, Help, theme, nav, History heading, and Daily routes stay as shipped.

- Production RNG is `Math.random`. Tests inject `rng`. UI tests use Vitest fake timers for timeout; do not use wall-clock in tests.

- No Playwright, no GitHub Actions this ticket. No cookies, analytics, accounts, or network besides static assets.

## Testing Decisions

A good test checks observable behavior through a public interface. It does not inspect private helpers, mock internal collaborators, or recompute the expected value the way the production code does. Expected values are literals from this spec (3 lives, Sprint 60, Marathon 300, copy `Not a valid port.` / `Already guessed.` / `Not in this catalog.` / `Cannot start Blitz: not enough unused answers today.` / `Out of lives` / `Time's up` / `Play again` / `Sprint (1m)` / `Marathon (5m)` / `Survival`, key `portdle:v1:blitzBests`, bests key shape `mixed|default|sprint`).

Three seams (same as Implementation Decisions):

1. **Engine** — `startBlitz`, `reduceBlitz`. Inject tiny catalogs, tiny schedules, `utcToday`, and `rng` (do not use wall-clock or `Math.random`). Cover: start pool is answer-eligible and not retired; today's three Daily ids are excluded (Mixed start does not contain that day's Mixed, Protocols, or Applications ids); miss-only and retired ids are not in the start pool; empty filtered pool returns `{ error: "empty-pool" }`; `lives` starts at 3 and `score` at 0; a correct default-guess increments score by 1 and changes `currentId`; a miss decrements lives by 1 and changes `currentId` while lives remain; three misses set `ended: "lives"` and do not advance off the last item; invalid digits do not change lives, score, or `currentId`; `timeout` sets `ended: "timeout"` and leaves score; a correct or miss when `remainingIds` is empty reshuffles `startPool` and continues (`ended` stays null, a `currentId` is present); reducing an already-ended state is a no-op. Identification of a miss uses `evaluateDefaultGuess` / this category's catalog (Protocols miss of an Applications-only port is `identified: null`; Mixed miss of a Protocols port is identified). Do not test inverted-guess, search, Daily persist, or History.

2. **Persist** — existing adapter plus `blitzBests`. Cover: missing key reads `{}`; round-trip `{ "mixed|default|sprint": 4 }`; corrupt JSON reads `{}` without dropping theme; writing bests does not write Daily/stats keys; `setItem` throw returns `{ ok: false }` on `writeBlitzBests`. Do not use `window.localStorage`.

3. **UI** — Vitest + Testing Library + jsdom through `App`. Inject persist, memory history, `utcToday` `2026-09-09`. Cover: `/blitz` setup `h1` Blitz; Daily category and mode radios and Start exist and are keyboard-reachable; no Inverted start control; Start Mixed Default Sprint shows a service `h1` that is not today's Mixed, Protocols, or Applications Daily `name`, shows lives 3 and score 0 and time 60, and uses Port digits; a correct port increments score; a catalog miss shows the identified name or `Not in this catalog.`, decrements lives, and advances; incomplete Enter shows `Not a valid port.` and does not change lives; Survival Start shows no remaining time; fake timers: Sprint Start then advance 60s shows `Time's up` and the score; three misses show `Out of lives`; end writes `portdle:v1:blitzBests` when the score is a new best for `mixed|default|sprint` and does not write a Daily key; Play again returns to setup `h1` Blitz; a second run with a lower score does not lower the stored best; refresh (new `App` mount, same persist) during a run returns to setup and does not restore the in-flight score; How-to still appears on first `/blitz` visit; History still has heading History; Mixed Daily still plays. Do not assert CSS class names except existing `html.dark` shell tests. Do not drive inverted search. Do not add an App catalog-injection seam; empty-pool copy is specified for Start but is not required as an `App` test against production catalogs.

Prior art: engine tests next to sources with injected catalogs/schedules/`utcToday`/RNG; persist injected-store tests; Mixed Daily and App tests through `App`. Follow those. Do not introduce Playwright.

Typecheck and the full Vitest suite pass.

## Out of Scope

- Inverted orientation, inverted guess, search index, typeahead, listbox
- Skip, archive play, History rows
- Accounts, leaderboards, PWA, i18n, custom domain, IANA scrape
- Inverted Daily; changing Daily guess rules, schedules, or `gen:schedule`
- GitHub Actions / GitHub Pages deploy
- Changing How-to copy, theme rules, or nav labels
- Cookies, analytics, backend, UI kit, Redux/Zustand
- Persisting a Blitz run
- A pause control

## Further Notes

- Product and architecture authority is `docs/superpowers/specs/2026-09-08-portdle-design.md`. This spec is ticket #5 only.
- Glossary: Entry, catalog kind, Daily category, Mixed, answer-eligible, miss-only, Daily, Orientation, Blitz, Sprint, Marathon, Survival. Do not say "mode" for Daily category or "tutorial" for How-to. Mode means `BlitzMode`.
- Transport is never part of the guess.
- Aliases are not Blitz titles.
- Daily and Blitz do not share a live session.
- Ticket #6 owns Inverted.
