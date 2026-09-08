# Spec: Three Dailies and schedules

Spec for #3. Tracker: https://github.com/mquesada02/portdle/issues/12

## Problem Statement

A player can play Mixed, but Protocols and Applications are still placeholder headings. The catalogs are four fixture rows, not the hand-curated floors. There is no Protocols or Applications schedule, no `gen:schedule`, and no A2 freeze, so two players on the same build are not guaranteed the same three rows today, and a catalog edit can rewrite identity that has already been dealt.

## Solution

Protocols and Applications are real Dailies besides Mixed. `/` stays Mixed (the landing default). All three share UTC days, independent persist and win-streaks, and hand-curated catalogs (answer-eligible vs miss-only). A committed A2 schedule for each Daily category means every player with this build gets the same three distinct catalog ids today. `gen:schedule` freezes through today, shuffles new or retired-in-tail ids into the future tail only, covers today+7, and `--check` is idempotent. Frozen-prefix `name` and `port` cannot change; flavor text can. Miss identification is scoped to that Daily's catalog (Mixed = union). Mixed remains the headline streak.

## User Stories

1. As a player who opens the app, I want `/` to be today's Mixed Daily, so that the landing default stays Mixed.
2. As a player, I want `/protocols` to be today's Protocols Daily, so that I can play protocols besides Mixed.
3. As a player, I want `/applications` to be today's Applications Daily, so that I can play applications besides Mixed.
4. As a player, I want all three Dailies to use the same UTC calendar day, so that "today" is one shared day.
5. As a player on any Daily, I want default orientation only (name in, port out), so that Daily never asks me to search names.
6. As a player on Protocols, I want the heading to be that Daily's canonical `name`, so that I know which protocol I am mapping to a port.
7. As a player on Applications, I want the heading to be that Daily's canonical `name`, so that I know which application I am mapping to a port.
8. As two players with this build, I want the same three catalog ids for Mixed, Protocols, and Applications today, so that the Daily is shared.
9. As a player on one UTC date, I want the three Daily ids to be three different entries, so that the three Dailies are not the same row.
10. As a player, I want Mixed, Protocols, and Applications boards, stats, and `lastPlayed` to be independent, so that playing one Daily does not finish or score another.
11. As a player who finishes Mixed, I want Protocols and Applications stats unchanged, so that streaks do not leak across Daily categories.
12. As a player who finishes Protocols, I want Mixed stats unchanged, so that the headline streak is not moved by Protocols play.
13. As a player who finishes Applications, I want Mixed and Protocols stats unchanged, so that each win-streak stands alone.
14. As a player on `/` after a Mixed finish, I want Mixed current/best streak (the headline streak), so that the landing Daily shows Mixed.
15. As a player on Protocols after a Protocols finish, I want Protocols personal stats, so that I see that Daily's record.
16. As a player on Applications after an Applications finish, I want Applications personal stats, so that I see that Daily's record.
17. As a player who wins Protocols then Mixed the same day, I want two independent current streaks of 1, so that each Daily category counts its own win.
18. As a player who skips a UTC day on Protocols only, I want Protocols current streak reset and Mixed current streak left to Mixed's own gap rules, so that a skip is per Daily category.
19. As a player who left yesterday's Protocols in `playing`, I want Protocols current streak reset, so that an unfinished Protocols day breaks only that streak.
20. As a player with no Protocols `lastPlayed` yet, I want Protocols streak left stored (0 until first finish), so that a first Protocols visit is not a skip.
21. As a player whose tab crosses UTC midnight, I want streak gap applied per Daily category when `lastSeenUtc` is before today, so that an overnight tab does not keep a stale streak on any Daily.
22. As a player on Protocols, I want a miss whose port exists in the Protocols catalog (including miss-only and retired) to show that entry's name, so that identification is scoped to Protocols.
23. As a player on Applications, I want a miss whose port exists in the Applications catalog (including miss-only and retired) to show that entry's name, so that identification is scoped to Applications.
24. As a player on Mixed, I want a miss whose port exists in either catalog (the union, including miss-only and retired) to show that entry's name, so that Mixed identification stays the union.
25. As a player on Protocols who guesses a port that exists only in Applications, I want "Not in this catalog.", so that Mixed union does not leak into Protocols.
26. As a player on Applications who guesses a port that exists only in Protocols, I want "Not in this catalog.", so that Mixed union does not leak into Applications.
27. As a player on Mixed who guesses that same Applications-only port, I want the application name, so that Mixed still uses the union.
28. As a player whose miss port is shared by several entries in that Daily's catalog, I want the lexicographically smallest `id`, so that identification stays deterministic.
29. As a player on any Daily, I want incomplete, non-digit, and `> 65535` guesses to be invalid and spend no try, so that garbage does not count.
30. As a player on any Daily, I want a repeated integer this puzzle to be duplicate and spend no try, so that repeating a miss does not burn a row.
31. As a player on any Daily, I want at most six committed tries, win on try 1–6, and loss on a 6th miss, so that every Daily matches How-to.
32. As a player who won or lost a Daily, I want input frozen, reveal (name, port, transport as `TCP` / `UDP` / `TCP/UDP`, description), stats, and Share for that Daily category, so that finish is complete.
33. As a player who shares Protocols, I want `Portdle · Protocols · {date} · …`, so that the share line names that Daily.
34. As a player who shares Applications, I want `Portdle · Applications · {date} · …`, so that the share line names that Daily.
35. As a player who shares Mixed, I still want `Portdle · Mixed · {date} · …`, so that Mixed share copy does not change.
36. As a player who already finished today's Protocols in this browser, I want reveal and stats with no input, so that refresh does not let me replay Protocols today.
37. As a player who has not committed a guess on Protocols, I want no Protocols Daily persist key, so that opening Protocols is not an unfinished Daily.
38. As a player whose first committed Protocols guess is a miss or a correct, I want persist created under the Protocols key, so that the board can restore.
39. As a player who refreshes mid-Protocols puzzle, I want the committed rows restored, so that I do not lose progress.
40. As a player on a Daily whose schedule does not cover today, I want "Puzzle unavailable" and a link to Help, so that an uncovered date is explained.
41. As a first-time player on Protocols or Applications, I still want the How-to dialog, so that teaching is not lost.
42. As a player, I want Blitz and History to stay stubs with headings Blitz and History, so that this ticket does not ship those surfaces.
43. As a player, I want Help, theme, and nav labels unchanged, so that chrome stays as the shell already shipped.
44. As a player, I want one `h1` per Daily screen (canonical name, or "Puzzle unavailable"), so that heading structure stays one per screen.
45. As a keyboard-only player, I want to complete each Daily without a pointer, so that slots, Submit, and Share stay reachable.
46. As a player, I want English copy only, so that v1 stays one locale.
47. As a player, I want transport to be reveal metadata only, so that the guess is the port number and never TCP/UDP.
48. As a player, I want the canonical `name` as the Daily title, never an alias, so that aliases stay search keys only.
49. As a maintainer, I want ≥40 answer-eligible protocol entries and ≥25 answer-eligible application entries, so that the hand-curated floors are met.
50. As a maintainer, I want extra miss-only rows in both catalogs, so that some wrong ports can still be named.
51. As a maintainer, I want every canonical `name` unique across the whole catalog (case-insensitive), so that a title is one entry.
52. As a maintainer, I want every `id` unique globally and stable, so that schedules can name rows forever.
53. As a maintainer, I want `port` to be an integer 0–65535, so that a guess is a port number.
54. As a maintainer, I want `transport` to be `tcp`, `udp`, or `both`, so that reveal can show `TCP` / `UDP` / `TCP/UDP`.
55. As a maintainer, I want crowded non-retired ports in a catalog kind to each have a `blurb` that does not contain that entry's name or alias, so that inverted crowding rules are already valid.
56. As a maintainer, I want Mixed-union crowding to also require blurbs, so that Mixed inverted later does not fail validation.
57. As a maintainer, I want a committed frozen-identity map of frozen-prefix ids to `name` and `port`, so that `--check` can reject identity edits without a previous catalog checkout.
58. As a maintainer, I want `gen:schedule` to freeze each schedule through today (including today), so that already-dealt days plus today do not change identity.
59. As a maintainer who adds a new answer-eligible id, I want the frozen prefix untouched and the new id shuffled into the future tail, so that new answers only enter after today.
60. As a maintainer who retires a tail id or sets `answerEligible: false` on a tail id, I want that id dropped from the tail and the tail reshuffled, so that retired-in-tail ids leave the future.
61. As a maintainer who retires a frozen-prefix id, I want that id to stay in the order file, so that that day's Daily is still this id.
62. As a maintainer who only edits description, aliases, blurb, or transport, I want schedules unchanged, so that flavor text is not a schedule rewrite.
63. As a maintainer who changes `name` or `port` of a frozen-prefix entry, I want validation to fail, so that puzzle identity cannot move.
64. As a maintainer who changes `name` or `port` of a future-tail-only entry, I want that allowed, so that undealt rows can still be corrected.
65. As a maintainer, I want each schedule after a successful run to cover `utcToday` through `utcToday + 7`, so that the next week cannot go unavailable.
66. As a maintainer, I want a second `gen:schedule` with no eligibility change to be a no-op, so that the generator is idempotent.
67. As a maintainer, I want `gen:schedule --check` to exit 0 when a run would not change schedule files or frozen identity and validation (blurbs, frozen identity, floors, coverage) passes, so that CI can gate identity.
68. As a maintainer, I want `gen:schedule --check` to exit non-zero if a run would change any schedule file or the frozen-identity map, or if validation fails (including frozen-prefix `name`/`port` mismatch), so that drift is caught.
69. As a maintainer, I want same-day Mixed vs Protocols vs Applications collisions resolved only after today (or from `startDay` on a brand-new cycle), so that the frozen prefix is never rewritten to fix a collision.
70. As a maintainer, I want collision repair to swap Mixed with a later Mixed id, or insert the lexicographically smallest unused Mixed-eligible id, never stealing a Protocols or Applications card, so that the other two Dailies stay theirs.
71. As a maintainer, I want epoch `2026-09-09` committed in all three schedule files, so that day indexes match Mixed.
72. As a maintainer, I want days before epoch never assigned, so that there is no Daily before the first public day.
73. As a maintainer, I want engine schedule generation to take injected `utcToday` and catalogs, so that tests do not use the clock.
74. As a maintainer, I want production `gen:schedule` to use `PORTDLE_UTC_TODAY` when set, else wall-clock UTC, so that first freeze and tests can pin the day.
75. As a player, I want committed port digits in monospace and the service name in the UI sans-serif, so that the board matches the visual tone.

## Implementation Decisions

- **Seams** (already implied by the v1 design spec; no new seam): (1) **engine** — pure functions, no React, no DOM, no `localStorage`; catalogs, `getDaily`, default guess, stats, share, RNG, schedule generation, catalog validation; (2) **persist** — existing `createPersist` already keyed by `DailyCategory`; (3) **UI** — Daily screen on `/`, `/protocols`, `/applications`; Vitest + Testing Library through `App`; (4) **`gen:schedule`** — thin CLI over the engine generator. Tests inject `utcToday`, catalogs, and schedules. The browser UI passes `utcToday` from `utcDateString(new Date())` and loads the production JSON catalogs plus the three committed schedules.

- Closed unions unchanged: `CatalogKind = "protocol" | "application"`; `DailyCategory = "mixed" | "protocols" | "applications"`; `Transport = "tcp" | "udp" | "both"`. Do not add Orientation, BlitzMode, inverted guess, search, Blitz reducer, or History rows.

- `getDaily(category, date, schedule, protocols, applications)` stays as shipped: one schedule file per call. Protocols UI passes the Protocols schedule; Applications UI passes the Applications schedule; Mixed UI passes the Mixed schedule. Missing cycle or missing id → `null` → "Puzzle unavailable".

- `catalogFor` stays as shipped. Miss catalog is `catalogFor` for that Daily category (Mixed = union). `evaluateDefaultGuess` already takes that catalog; do not special-case Mixed in the guess function.

- Catalog helpers to add (engine):

  ```ts
  answerPool(catalog): entries where answerEligible && !retired

  type CatalogIssue =
    | { kind: "duplicate-id"; id: string }
    | { kind: "duplicate-name"; name: string }
    | { kind: "invalid-port"; id: string }
    | { kind: "missing-blurb"; id: string }
    | { kind: "blurb-leaks-name"; id: string }

  validateCatalog(entries): CatalogIssue[]
  ```

  Crowding and blurbs: among **non-retired** entries that share `port`, each must have a `blurb`, and `blurb.toLowerCase()` must not contain `name` or any alias as a substring. `validateCatalog` also flags duplicate `id`, duplicate case-insensitive `name`, and `port` that is not an integer in 0–65535.

  Run `validateCatalog` on protocols, on applications, and on the Mixed union (concatenated). Unique `id` / `name` are global (the union run catches cross-file clashes).

- Production catalogs replace the four-row Mixed fixtures. Hand-curate real services until the floors hold (`answerPool` protocols ≥ 40, applications ≥ 25) plus at least one miss-only row in each catalog. Exact extra ids are implementation as long as uniqueness, ports, transport, blurbs, and floors validate. This spec pins only Mixed-continuity literals so #2 fixtures do not become different rows:

  | id | name | port | notes |
  |---|---|---|---|
  | http | HTTP | 80 | answer-eligible protocol |
  | chargen | chargen | 19 | miss-only protocol |
  | telnet | Telnet | 23 | answer-eligible protocol (no longer retired) |
  | vite | Vite | 5173 | answer-eligible application |

  Aliases remain optional same-service names (v1 example: `postgres` → PostgreSQL). They are never Daily titles. Tests must not require Mixed on epoch day to be Vite.

- RNG (engine, deterministic): `hashSeed(string) → number`; `mulberry32(seed) → () => number` in `[0, 1)`. Shuffle is Fisher-Yates after sorting the id list lexicographically (so input array order cannot change the deal).

- Schedule generation (engine):

  ```ts
  type FrozenIdentity = Record<string, { name: string; port: number }>

  generateSchedules({ utcToday, protocols, applications, current, identity }): {
    schedules: Record<DailyCategory, ScheduleFile>
    identity: FrozenIdentity
  }
  schedulesEqual(a, b): boolean
  identityEqual(a, b): boolean
  validateSchedules({ utcToday, protocols, applications, schedules }): string[]
  validateFrozenIdentity({ utcToday, identity, protocols, applications, schedules }): string[]
  ```

  Epoch is `2026-09-09` in every schedule file (v1). Never assign a day whose `utcDayIndex` is negative. Freeze through `utcToday`. Coverage: each schedule's last assigned day index `>= utcDayIndex(utcToday, epoch) + 7`. Tests and the first committed run pin `utcToday` to epoch.

  A2 (v1 §6.2). Steps 1–4 run when answer-eligible ids are **added**, or tail ids are **retired** or lose `answerEligible`. A second run with no catalog-eligibility changes is a no-op (step 5 still runs; if coverage already holds it does not append).

  1. If a cycle contains `utcToday`, leave `order[0] … order[todayIndex]` untouched (frozen prefix, including today). If today is **past all cycles**, use the last cycle and treat its entire `order` as frozen (tail is empty; step 5 appends for coverage). If today is **before all cycles** (including before epoch), there is no prefix.
  2. `tail = order[todayIndex+1 …]` minus ids that are `retired` or not `answerEligible`, plus new eligible ids not already in this cycle. Protocols tail only uses Protocols `answerPool`; Applications tail only uses Applications `answerPool`; Mixed tail uses the union `answerPool`.
  3. Deterministically shuffle `tail` (seed `hashSeed(\`${category}:${cycle.startDay}:${sortedTailIds.join(",")}\`)`).
  4. Resolve same-day distinctness for days **after** `utcToday` only (v1 §6.3), except a **brand-new cycle** walks from that cycle's `startDay`.
  5. If the last assigned day is sooner than `utcToday + 7`, append a full new cycle: shuffle all current `answerPool` ids for that category (seed `hashSeed(\`${category}:${newStartDay}\`)`), then run §6.3 on the new cycle's days.

  Same-day distinctness (v1 §6.3): after building/updating a tail or a new cycle, walk days from `utcToday+1` (or from `startDay` for a brand-new cycle) forward. Let `P`, `A`, `M` be that day's ids. If `M === P` or `M === A`, swap `M` with the nearest **later** Mixed id that does not collide with that day's `P` and `A`. If none works, insert the lexicographically smallest unused Mixed-eligible id (`answerEligible && !retired` in either catalog, not already in this Mixed cycle) into that slot. Never steal a Protocols or Applications card. If the Mixed pool is exhausted, append the next Mixed cycle and continue. Do not rewrite the frozen prefix even if a historical collision exists.

  Empty `current` (missing file or `{ epoch, cycles: [] }`): append cycles from `startDay` 0 until coverage holds, then run distinctness from `startDay`.

  Frozen identity (v1 §5.4 / §6.2 `--check` “frozen identity”): a committed map of id → `{ name, port }` for every id that appears on a scheduled day with `utcDayIndex <= utcDayIndex(utcToday)` (already-dealt days plus today; if today is past all cycles, every id in every cycle). `generateSchedules` copies the current map, then records `{ name, port }` from the catalogs for any newly frozen id not already present. Existing map entries never change. Flavor fields (`description`, `aliases`, `blurb`, `transport`) and eligibility flags are not in the map.

  `validateFrozenIdentity` (empty = ok): every frozen-prefix id exists in that category's catalog; if the id is in the map, catalog `name` and `port` equal the map; missing map entries for already-frozen ids fail. Changing a future-tail-only id's `name`/`port` is allowed (not in the frozen prefix, not required to match).

  `validateSchedules` returns messages (empty = ok) for: catalog issues (floors, `validateCatalog` on both files and the union), every scheduled id exists in that category's catalog, coverage through `utcToday+7`, same-day ids distinct on every day after `utcToday` (and on a brand-new cycle from `startDay`), no assigned day before epoch. Floors: `answerPool(protocols).length >= 40`, `answerPool(applications).length >= 25`, at least one miss-only row in each JSON file.

- CLI `gen:schedule`: read production protocols/applications JSON, the three schedule files (missing schedule → `{ epoch: "2026-09-09", cycles: [] }`), and the committed frozen-identity map (missing → `{}`). `utcToday` from `PORTDLE_UTC_TODAY` if set, else `utcDateString(new Date())`. Compute next schedules and next identity. If argv includes `--check`, exit 1 if `!schedulesEqual` or `!identityEqual` or `validateSchedules` is non-empty or `validateFrozenIdentity` is non-empty. Else write pretty JSON (tab indent, trailing newline) for schedules and identity, and still fail if validation is non-empty. Flavor-text-only catalog edits do not require this script.

- Persist keys already exist per `DailyCategory`. Use them. Do not add `blitzBests`. Overnight gap: when `lastSeenUtc < utcToday` on load, run `applyStreakGap` for **each** Daily category with that category's stats, `lastPlayed`, and yesterday persist, write each stats key, then write `lastSeenUtc`. Missing `lastSeenUtc` still writes today without resetting. Recording a finish still runs `applyStreakGap` for **that** category only, then `applyDailyFinish`, then that category's `lastPlayed`. Playing one category never reads or writes another category's daily / stats / `lastPlayed`.

- Daily UI: one screen parameterized by `DailyCategory` (do not fork three copies of guess/reveal). `/` Mixed, `/protocols` Protocols, `/applications` Applications. Same copy and controls as Mixed: slots labelled "Port digits", invalid `Not a valid port.`, duplicate `Already guessed.`, miss name or `Not in this catalog.`, Share via `formatShare({ category, … })` (labels already `Mixed` / `Protocols` / `Applications`). Stats on reveal are that category's stats. Headline streak on `/` is Mixed because Mixed reveal reads Mixed stats.

- Existing Mixed UI tests that assumed the fixture schedule (epoch day = Vite, four slots, win `5173`, miss `0080` / `0019` / `0023`) must resolve today's Mixed entry from the committed Mixed schedule via `getDaily` and use that entry's `name` / `port` / `digitLength` / `description`. Miss ports must be in the Mixed catalog, not equal to the answer port, and padded to the answer's digit length. Shell route-heading tests must expect the Mixed canonical name for the injected date, not the word "Mixed", and must expect Protocols/Applications canonical names rather than the placeholder words "Protocols" / "Applications".

- First committed schedules and frozen-identity map are the output of `generateSchedules` with `utcToday` `2026-09-09` (epoch) and the production catalogs. `PORTDLE_UTC_TODAY=2026-09-09 pnpm gen:schedule --check` must then exit 0.

- No Playwright, no GitHub Actions this ticket. No cookies, analytics, accounts, or network besides static assets.

## Testing Decisions

A good test checks observable behavior through a public interface. It does not inspect private helpers, mock internal collaborators, or recompute the expected value the way the production code does. Expected values are literals from this spec (floors 40 / 25, epoch `2026-09-09`, continuity ids `http`/`chargen`/`telnet`/`vite`, copy `Not in this catalog.`, share labels `Mixed` / `Protocols` / `Applications`, key prefixes `portdle:v1:daily:protocols:` / `portdle:v1:stats:applications`).

Four seams (same as Implementation Decisions):

1. **Engine** — `catalogFor`, `answerPool`, `validateCatalog`, `hashSeed` / `mulberry32`, `generateSchedules`, `schedulesEqual`, `identityEqual`, `validateSchedules`, `validateFrozenIdentity`. Catalog cover: Mixed union still protocols-then-applications; Protocols/Applications are the source arrays; `answerPool` drops miss-only and retired; duplicate id; duplicate name case-insensitive (`HTTP` vs `http`); port `-1` / `65536` invalid; crowded non-retired ports missing blurb; blurb that contains `name`; unique ports need no blurb; production JSON meets floors, has miss-only rows, `validateCatalog` is empty on protocols, applications, and the union; global unique ids and names; continuity literals (`http` 80, `vite` 5173, `chargen` miss-only, `telnet` answer-eligible). Schedule cover (tiny injected catalogs, not production, injected `utcToday`): empty current covers `utcToday+7` for all three categories; adding an answer-eligible id does not change frozen prefix including today; retiring a tail id drops it from the tail and leaves the prefix; retiring a frozen-prefix id leaves that slot's id; flavor-only description edit leaves schedules and identity equal; same-day Mixed id differs from Protocols and Applications after today; brand-new cycles are distinct from `startDay`; second generate with no eligibility change equals the first; changing frozen-prefix `name` or `port` makes `validateFrozenIdentity` non-empty and `--check` would fail even when schedule JSON is unchanged; changing frozen-prefix description does not; `utcToday` before all cycles with covering schedules and no eligibility change is a no-op; today past all cycles freezes the last cycle's entire order; never assigns a negative day index. Do not use wall-clock. Do not test inverted, search, Blitz, or History.

2. **Persist** — existing adapter. Cover: Protocols daily/stats/`lastPlayed` round-trip on `portdle:v1:…:protocols…` keys; Applications the same; writing Protocols stats does not write Mixed or Applications keys; Mixed finish keys still do not create Protocols keys.

3. **UI** — Vitest + Testing Library + jsdom through `App`. Inject persist, memory history, `utcToday` `2026-09-09`. Resolve answers with `getDaily` against production JSON + committed schedules. Cover: `/` Mixed `h1` is Mixed's canonical name; `/protocols` and `/applications` `h1`s are those answers' names; three ids that day are distinct; Protocols miss of an Applications-only port (Vite `5173` if that is not the Protocols answer) shows `Not in this catalog.`; Mixed miss of a Protocols port still names it; finishing Protocols writes Protocols stats/`lastPlayed` and does not change Mixed stats; finishing Mixed does not change Protocols stats; Share on Protocols copies a `Portdle · Protocols ·` line; Mixed win/loss/share/restore/How-to/unavailable still hold, using the resolved Mixed answer instead of fixture Vite; Blitz and History still have headings Blitz and History. Do not assert CSS class names except existing `html.dark` shell tests. Do not drive Blitz gameplay.

4. **`gen:schedule`** — CLI over the engine. `PORTDLE_UTC_TODAY=2026-09-09 pnpm gen:schedule --check` exits 0 on the committed files (schedules and frozen identity unchanged, validation empty). A frozen-prefix `name`/`port` mismatch against the committed identity map exits non-zero even if schedule JSON would not change.

Prior art: engine tests next to sources; persist injected-store tests; Mixed Daily and App tests through `App`. Follow those. Do not introduce Playwright.

Typecheck and the full Vitest suite pass.

## Out of Scope

- Blitz (default or inverted), search index, Blitz reducer, skip, archive play, History rows
- Inverted Daily; Orientation / BlitzMode usage
- Accounts, leaderboards, PWA, i18n, custom domain, IANA scrape
- GitHub Actions / GitHub Pages deploy (later ticket)
- Changing How-to copy, theme rules, or nav labels
- Changing epoch after this commit; rewriting a frozen prefix to fix a historical collision
- Deleting a catalog row whose `id` appears in any cycle of any schedule (prefer `retired: true`)
- Cookies, analytics, backend, UI kit, Redux/Zustand
- `blitzBests` persist

## Further Notes

- Product and architecture authority is `docs/superpowers/specs/2026-09-08-portdle-design.md`. This spec is ticket #3 only.
- Glossary: Entry, catalog kind, Daily category, Mixed, A2, answer-eligible, miss-only, Daily, Cycle, Schedule, Frozen prefix. Do not say "mode" for Daily category or "tutorial" for How-to.
- Headline streak on `/` is Mixed.
- Transport is never part of the guess.
- Aliases are not Daily titles.
- Ticket #2 fixture catalogs and the 90-day vite/http Mixed schedule are replaced by production content, generated schedules, and a committed frozen-identity map.
- Extra catalog rows are hand-curated to the floors; this spec does not pin a roster beyond the Mixed continuity literals.
