# Spec: Mixed Daily

Spec for #2. Tracker: https://github.com/mquesada02/portdle/issues/10

## Problem Statement

A player who lands on Mixed today can open the app and read the rules, but they cannot play. Mixed is still a placeholder heading. There is no catalog, no Daily identity for today, no digit slots, no guesses, no persist of the board, no personal stats, and no spoiler-free share. The player came to guess a port from a service name.

## Solution

`/` is today's Mixed Daily in default orientation: the player sees the service name, types the port into digit slots whose length is known from the start, and has six committed tries. A miss that exists in the Mixed catalog (including retired and miss-only entries) shows that service name; otherwise the miss is "Not in this catalog." Invalid and duplicate guesses do not spend a try. The board is created in persist only on the first committed guess and restores after refresh. After a win or a 6th miss, the answer is revealed, Mixed personal stats are shown (played, win%, current/best streak, 1–6 bars), and the player can copy a spoiler-free share line. How-to still works. Protocols, Applications, Blitz, and History stay stubs. A tiny fixture catalog and Mixed schedule are enough.

## User Stories

1. As a player on Mixed, I want to see today's service name as the page heading, so that I know which name I am mapping to a port.
2. As a player, I want default orientation only (name in, port out), so that I am not asked to search names on Daily.
3. As a player, I want empty digit slots equal to the decimal length of the answer port with no leading zeros, so that I know how many digits to type before guessing.
4. As a player whose answer port is 80, I want two slots, so that length matches `80` not `080`.
5. As a player whose answer port is 5173, I want four slots, so that length matches `5173`.
6. As a player whose answer port is 0, I want one slot, so that zero is still typeable.
7. As a player, I want to type only digits into the slots, so that letters cannot enter a port guess.
8. As a keyboard-only player, I want Backspace to remove the last digit, so that I can correct a slot without a pointer.
9. As a keyboard-only player, I want Enter to submit a complete guess, so that I can play without a pointer.
10. As a player, I want a Submit control, so that I can commit a guess with a pointer.
11. As a player, I want the slots to be a labelled group named "Port digits" with `inputMode="numeric"`, so that assistive tech and mobile keyboards treat them as a port.
12. As a player, I want at most six committed tries, so that Mixed Daily matches the How-to rule.
13. As a player, I want a correct guess on try 1 through 6 to win, so that the sixth try can still succeed.
14. As a player, I want a miss on the sixth committed try to lose, so that using all tries without the port ends the Daily.
15. As a player who won or lost, I want input frozen, so that I cannot spend more tries after the Daily is over.
16. As a player who won or lost, I want the answer revealed: name, port, transport as `TCP` / `UDP` / `TCP/UDP`, and description, so that I learn the service.
17. As a player who already finished today's Mixed in this browser, I want reveal and stats with no input, so that refresh does not let me replay today.
18. As a player who submits a miss whose port exists in the Mixed catalog, I want to see that entry's service name, so that a wrong port still teaches me what it maps to.
19. As a player who misses with a retired entry's port, I want that retired service name, so that retired rows still name misses.
20. As a player who misses with a miss-only entry's port, I want that miss-only service name, so that non-answer rows still name misses.
21. As a player who misses with a port that is not in the Mixed catalog, I want "Not in this catalog.", so that I know the number is unused here.
22. As a player whose miss port is shared by several Mixed entries, I want the name of the entry with the lexicographically smallest `id`, so that identification is deterministic.
23. As a player who submits an incomplete slot string, I want an inline invalid message and no new row, so that a partial type does not spend a try.
24. As a player who submits non-digits, I want invalid and no spent try, so that garbage does not count.
25. As a player who submits an integer greater than 65535, I want invalid and no spent try, so that a non-port does not count.
26. As a player who submits a port I already committed this puzzle, I want duplicate and no spent try, so that repeating a miss does not burn a row.
27. As a player who types leading zeros in a longer slot string (`0080` for port 80), I want the guess treated as integer 80, so that padding zeros collapse.
28. As a player, I want committed guesses shown as rows of digits padded to the answer's digit length, so that the board is readable after each try.
29. As a player, I want status messages in an `aria-live` region, so that invalid, duplicate, and miss outcomes are announced.
30. As a player who has not yet committed a guess, I want no Mixed Daily persist key, so that merely opening Mixed is not an unfinished Daily.
31. As a player whose first committed guess is a miss or a correct, I want persist created with status `playing` or `won` as appropriate, so that the board can restore.
32. As a player who refreshes mid-puzzle, I want the committed rows restored, so that I do not lose progress.
33. As a player who refreshes after a win or loss, I want the finished board, reveal, and stats restored, so that today stays finished.
34. As a player whose Daily persist JSON is corrupt, I want that key ignored and a fresh empty board, so that one bad key does not crash Mixed.
35. As a player whose browser cannot write storage, I want "Progress may not save." and a still-playable Daily, so that quota failure is not a lockout.
36. As a player who finished Mixed, I want personal stats for Mixed: played, win% as a whole number 0–100, current streak, best streak, and six bars for tries 1–6, so that I can see my record.
37. As a player who won in 3 tries, I want played 1, win% 100, current and best streak 1, and bar 3 equal to 1, so that the histogram records wins only.
38. As a player who then loses, I want played 2, win% 50, current streak 0, best streak still 1, and no increment on bar 6, so that a loss resets streak and does not fill a win bar.
39. As a player who skipped one or more UTC days after a win, I want current Mixed streak reset to 0 before today's result is applied, so that streaks require consecutive UTC days.
40. As a player who left yesterday's Mixed in `playing`, I want current Mixed streak reset, so that an unfinished day breaks the streak.
41. As a player with no `lastPlayed` yet, I want streak left at 0 until the first finish, so that a first visit is not treated as a skip.
42. As a player who finished yesterday and plays today, I want the streak continued on a win, so that consecutive UTC finishes count.
43. As a player, I want Mixed finishes to write Mixed stats and Mixed `lastPlayed` only, so that Protocols and Applications stats never change from Mixed play.
44. As a player, I want `lastPlayed` written only when Mixed is `won` or `lost`, never while `playing`, so that an in-progress board is not a streak event.
45. As a player whose tab crosses UTC midnight, I want streak gap applied when `lastSeenUtc` is before today, so that an overnight tab does not keep a stale streak.
46. As a player who finished Mixed, I want a Share control that copies a spoiler-free result, so that I can post without leaking the name or port.
47. As a player who won on try 3, I want share text exactly `Portdle · Mixed · {date} · 3/6` then a blank line then `⬜⬜🟩`, so that squares match committed tries only.
48. As a player who won on try 1, I want a single `🟩` and `1/6`, so that a first-try win is not padded to six squares.
49. As a player who lost, I want `X/6` and six `⬜`, so that a loss is distinct from a six-try win.
50. As a player whose clipboard is denied, I want a select/copy fallback of the same share text, so that I can still copy.
51. As a player on Mixed when today's Mixed schedule id is missing, I want "Puzzle unavailable" and a link to Help, so that an uncovered date is explained.
52. As a first-time player on Mixed, I still want the How-to dialog, so that teaching is not lost when the board appears.
53. As a player who dismissed How-to, I want Help to still show the same rules, so that I can re-read them.
54. As a player on Protocols, Applications, Blitz, or History, I want those screens to stay stubs with their existing headings, so that this ticket does not ship other Dailies or Blitz.
55. As a keyboard-only player, I want to complete Mixed Daily without a pointer, so that slots, Submit, and Share are reachable.
56. As a player, I want committed port digits in monospace and the service name in the UI sans-serif, so that the board matches the visual tone.
57. As a player, I want one `h1` on Mixed (the canonical name, or "Puzzle unavailable" when there is no Daily), so that heading structure stays one per screen.
58. As a player, I want English copy only, so that v1 stays one locale.
59. As a maintainer, I want a tiny fixture catalog (protocols + applications) and a Mixed schedule, so that Mixed is playable without the production floor or `gen:schedule`.
60. As a maintainer, I want `engine/` to stay pure TypeScript with injected catalogs, schedule, and `utcToday`, so that tests do not use the clock or `localStorage`.

## Implementation Decisions

- **Seams** (already implied by the v1 design spec; no new seam): (1) **engine** — pure functions, no React, no DOM, no `localStorage`; (2) **persist** — extend the existing `createPersist(injected KeyValueStore)`; (3) **UI** — Mixed Daily screen on `/`, Vitest + Testing Library. Tests inject `utcToday`, catalogs, and schedule. The browser UI passes `utcToday` from `utcDateString(new Date())` and loads the fixture JSON catalogs plus the Mixed schedule.

- Closed unions used this ticket: `CatalogKind = "protocol" | "application"`; `DailyCategory = "mixed" | "protocols" | "applications"`; `Transport = "tcp" | "udp" | "both"`. Do not add Orientation, BlitzMode, inverted guess, search, Blitz reducer, or `gen:schedule`.

- Catalog entry shape (v1):

  ```ts
  type CatalogEntry = {
    id: string;
    name: string;
    aliases?: string[];
    port: number;
    transport: Transport;
    description: string;
    blurb?: string;
    answerEligible: boolean;
    retired?: boolean;
  };
  ```

- Mixed catalog for misses = union of both fixture JSON arrays (protocols then applications), including retired and miss-only. `catalogFor("mixed", protocols, applications)` concatenates. `catalogFor("protocols")` / `catalogFor("applications")` exist so Mixed union is not a special case, but only Mixed Daily is wired to the UI.

- `getDaily("mixed", date, mixedSchedule, protocols, applications)` uses `utcDayIndex(date, schedule.epoch)` and the cycle whose `startDay <= index < startDay + order.length`, then resolves `order[index - startDay]` in the Mixed catalog. Missing cycle or missing id → `null`. Other Daily categories are not resolved in the UI this ticket.

- Fixture content (literals tests may use):

  | id | name | port | transport | answerEligible | retired | kind |
  |---|---|---|---|---|---|---|
  | `http` | HTTP | 80 | tcp | true | — | protocol |
  | `chargen` | chargen | 19 | tcp | false | — | protocol (miss-only) |
  | `telnet` | Telnet | 23 | tcp | true | true | protocol (retired; still names misses) |
  | `vite` | Vite | 5173 | tcp | true | — | application |

  Descriptions (reveal flavor; tests may match these strings):

  - HTTP: `Hypertext Transfer Protocol.`
  - chargen: `Character generator protocol.`
  - Telnet: `Telnet protocol.`
  - Vite: `Vite default development server.`

- Mixed schedule: `epoch` `2026-09-09` (v1). One cycle, `startDay` 0, `order` long enough to cover utc day indexes 0–89 by alternating `vite`, `http` (day 0 = Vite, day 1 = HTTP, …). Protocols and Applications schedule files are not required this ticket. A date before epoch or past the cycle → `getDaily` null → UI "Puzzle unavailable" plus a link to Help. Tests inject `utcToday` (do not use wall-clock). Production Mixed uses the real UTC date; if that date is uncovered, unavailable is correct until later schedule work.

- Default guess (v1 §7.1):

  ```ts
  type Identified = { id: string; name: string; port: number };
  type GuessResult =
    | { status: "invalid" }
    | { status: "duplicate" }
    | { status: "correct"; port: number }
    | { status: "miss"; port: number; identified: Identified | null };

  digitLength(port): decimal digit count of the integer (80 → 2, 0 → 1, 5173 → 4)

  evaluateDefaultGuess({ digits, answer, previousPorts, catalog }): GuessResult
  ```

  Submitted value is `parseInt(digits, 10)` when `digits` is one or more digits; leading zeros collapse. Incomplete, empty, non-digits, or integer `> 65535` → `invalid` (no try). Same integer in `previousPorts` → `duplicate` (no try). Integer `=== answer.port` → `correct` (spends a try). Else if some catalog entry has that port (retired and miss-only included) → `miss` with `identified` = that entry's `{ id, name, port }` (lexicographically smallest `id` if several). Else `miss` with `identified: null`.

- A Mixed Daily accepts at most 6 committed tries (`correct` or `miss`). 6th `correct` → `won`. 6th `miss` → `lost`. Reveal still shows the answer.

- Stats (Mixed only in the UI this ticket):

  ```ts
  type CategoryStats = {
    currentStreak: number;
    bestStreak: number;
    played: number;
    wins: number;
    histogram: [number, number, number, number, number, number];
  };
  ```

  `emptyStats()` is all zeros. `applyDailyFinish({ stats, result, tries })` once per Mixed UTC date: `played += 1`; on win, `wins += 1`, `histogram[tries-1] += 1`, `currentStreak += 1`, `bestStreak = max(best, current)`; on loss, do not increment histogram, `currentStreak = 0`. `winPercent(stats)` is `played === 0 ? 0 : wins / played`. Displayed Win % is `Math.round(winPercent * 100)` (0–100).

- Streak gap (`applyStreakGap`), applied when `lastSeenUtc < utcToday` on load and again when recording today's Mixed finish:

  - If yesterday's Mixed persist `status === "playing"` → `currentStreak = 0`.
  - Else if `lastPlayed` is missing → leave streak as stored.
  - Else if `lastPlayed < yesterdayUtc(utcToday)` → `currentStreak = 0`.
  - Else leave streak as stored (yesterday already applied).
  - Then write `lastSeenUtc` to `utcToday`.
  - Missing `lastSeenUtc` on first load: do not treat as a skip; write `utcToday` without resetting.

  `lastPlayed` is written only on Mixed `won` or `lost`. Playing Mixed never reads or writes Protocols or Applications stats or `lastPlayed`.

- Share (`formatShare({ category: "mixed", date, status, committed })`):

  ```
  Portdle · Mixed · 2026-09-09 · 3/6

  ⬜⬜🟩
  ```

  Category label `mixed` → `Mixed`. Win: `committed/6`, one square per committed guess, misses `⬜`, winning try `🟩` (not padded to 6). Loss: `X/6` and six `⬜`. Win on try 1 is a single `🟩`. No service name, no port.

- Persist: keep theme and How-to. Add prefix `portdle:v1:` keys:

  | Key | Value |
  |---|---|
  | `portdle:v1:daily:mixed:{date}` | `DailyPersist` |
  | `portdle:v1:stats:mixed` | `CategoryStats` |
  | `portdle:v1:lastPlayed:mixed` | UTC date |
  | `portdle:v1:lastSeenUtc` | UTC date |

  ```ts
  type DailyPersist = {
    status: "playing" | "won" | "lost";
    guesses: Array<{
      port: number;
      result: "correct" | "miss";
      identified: Identified | null;
    }>;
  };
  ```

  Extend `createPersist` with `readDaily` / `writeDaily`, `readStats` / `writeStats`, `readLastPlayed` / `writeLastPlayed`, `readLastSeenUtc` / `writeLastSeenUtc` (category parameter on Daily/stats/lastPlayed so Mixed cannot collide with later categories). `readDaily` missing/corrupt → `null`. `readStats` missing/corrupt → `null` (UI uses `emptyStats()`). `readLastPlayed` / `readLastSeenUtc` missing/corrupt → `null`. `setItem` throw → `{ ok: false }`. Do not add `blitzBests`. Corrupt JSON for one key still ignores that key only. `DailyPersist` is created on the first committed guess; opening Mixed, invalid, and duplicate do not write the daily key. Committed slot rows are recovered from `guesses[].port` padded to `digitLength(answer.port)`.

- Mixed UI (`/`): if `getDaily` is null, `h1` "Puzzle unavailable" and a link to Help. Else `h1` is the canonical `name` (not the word "Mixed"). Empty slots from the start. Invalid copy: `Not a valid port.` Duplicate copy: `Already guessed.` Miss with `identified`: show `identified.name`. Miss with null: `Not in this catalog.` After `won` or `lost`: freeze; reveal name, port, transport (`tcp` → `TCP`, `udp` → `UDP`, `both` → `TCP/UDP`), description; Mixed stats; Share. Share copies `formatShare` via clipboard; on failure, show the same text in a selectable fallback. How-to dialog behavior is unchanged. `/protocols`, `/applications`, `/blitz`, `/history` keep placeholder `h1`s Protocols / Applications / Blitz / History. `/help` unchanged.

- App tests inject `utcToday` (and persist). Default production `utcToday` is `utcDateString(new Date())`. Existing shell tests that expected Mixed placeholder `h1` "Mixed" must expect the fixture name for the injected date (day 0 = `Vite`) or inject How-to-only routes that still use placeholder headings.

- No Playwright, no `gen:schedule`, no GitHub Actions this ticket. No cookies, analytics, accounts, or network besides static assets.

## Testing Decisions

A good test checks observable behavior through a public interface. It does not inspect private helpers, mock internal collaborators, or recompute the expected value the way the production code does. Expected values are literals from this spec (ports `80` / `19` / `23` / `5173` / `65536`, names `HTTP` / `chargen` / `Telnet` / `Vite`, copy `Not in this catalog.`, share lines, key prefixes `portdle:v1:`).

Three seams:

1. **Engine** — `digitLength`, `evaluateDefaultGuess`, `getDaily`, `catalogFor`, `applyStreakGap`, `applyDailyFinish`, `winPercent`, `formatShare`, UTC helpers. Inject catalogs/schedule/`utcToday`. Cover: digit length 80→2, 0→1, 5173→4; correct; miss identified (including retired Telnet and miss-only chargen); miss unknown (`identified: null`); incomplete / non-digits / `65536` invalid; duplicate; leading zeros collapse to the same integer; win try 1; win try 6; lose on 6th miss; Mixed miss uses the union; `getDaily` Mixed day 0 is Vite, uncovered date is null; win increments streak and histogram; loss resets streak and does not increment histogram; UTC skip resets current streak; unfinished yesterday (`playing`) resets; Mixed finish does not require Protocols keys; share win 3, win 1, loss literals. Do not test inverted, search, Blitz, or `gen:schedule`.

2. **Persist** — existing `createPersist` plus Daily/stats/lastPlayed/lastSeenUtc. Cover: Mixed daily round-trip; daily created shape `{ status, guesses }`; corrupt daily JSON → `null` without dropping theme; Mixed stats/lastPlayed round-trip; writing Mixed stats does not write a Protocols stats key; `setItem` throw still `{ ok: false }` on the new writes. Do not use `window.localStorage`. Do not add Blitz bests tests.

3. **UI (Mixed Daily)** — Vitest + Testing Library + jsdom through `App` (highest UI seam). Inject persist, memory history, and `utcToday` `2026-09-09` (Vite, four slots). Cover: `h1` Vite; four slots labelled "Port digits" visible before any guess; incomplete Enter does not persist a daily key and shows `Not a valid port.`; a miss of `80` shows `HTTP` and writes daily persist; a miss of `19` shows `chargen`; a miss of `23` shows `Telnet`; a miss of `0001` (integer 1) shows `Not in this catalog.`; duplicate of 80 does not add a row; correct `5173` wins, reveals Vite / 5173 / TCP / the fixture description, shows stats, Share copies the win-1 share text; six distinct misses lose, freeze, reveal, share is the loss text; refresh restores a mid-puzzle miss row from persist; How-to still appears on first Mixed visit; Help and other stub routes still have their headings. Do not assert CSS class names except existing `html.dark` shell tests. Do not drive Protocols/Applications/Blitz gameplay.

Prior art: `src/persist/storage.test.ts` (injected store) and `src/ui/app.test.tsx` (Testing Library through `App`). Follow those, do not introduce Playwright.

## Out of Scope

- Playable Protocols Daily, Applications Daily, Blitz (default or inverted), History rows
- Inverted Daily, search index, Blitz reducer, skip, archive play
- Production catalog floors, blurb/crowding validation, `gen:schedule`, A2 freeze, same-day distinctness
- `blitzBests` persist, accounts, leaderboards, PWA, i18n, custom domain, IANA scrape
- GitHub Actions / GitHub Pages deploy (later ticket)
- Changing How-to copy, theme rules, or nav labels
- Cookies, analytics, backend, UI kit, Redux/Zustand

## Further Notes

- Product and architecture authority is `docs/superpowers/specs/2026-09-08-portdle-design.md`. This spec is ticket #2 only.
- Glossary: Entry, catalog kind, Daily category, Mixed, answer-eligible, miss-only, Daily, Orientation (default only here), Cycle, Schedule, Frozen prefix. Do not say "mode" for Daily category or "tutorial" for How-to.
- Headline streak on `/` is Mixed.
- Transport is never part of the guess.
- Aliases are not Daily titles and are unused on Mixed default orientation this ticket.
- Fixture catalogs are placeholders for ticket #3 (Three Dailies and schedules), which owns production content and `gen:schedule`.
