# Ticket spec: Archive, and History of finished Dailies

Spec for #191. Tracker: https://github.com/mquesada02/portdle/issues/191. Parent: Spec 5 (Dailies from the backend), https://github.com/mquesada02/portdle/issues/181 (`docs/superpowers/specs/2026-09-30-spec5-dailies-backend.md`, "Archive", "History", stories 39 to 48). Map: https://github.com/mquesada02/portdle/issues/169. Base branch: `spec5`. Blocked by #187, #189, #190 (all merged).

## Problem Statement

A player who misses a Daily cannot play it later: the Daily screen plays only the server's today. History lists every scheduled day, finished or not, which turns it into a list of answers instead of the player's record. History rows show no puzzle number, no result, and no link.

## Solution

A new Archive screen lists every past Daily with a Schedule row, three categories per day, with puzzle number and the player's state, and no answer. Choosing a Daily opens its board at its own address. The board is the Daily board: an unplayed or unfinished Daily is playable (a late play follows the `late` rule that #189 built), and a finished Daily opens read-only with its Reveal and its global stats. History's Daily segment lists only finished Dailies, each with puzzle number, result, and (once the reads succeed) name and port, and each row links to its Archive board. The Daily screen and History link to the Archive. A failed past-rows read shows the shared Error panel on the Archive.

Scope note (owner, 2026-10-02, on #191): the paged past Schedule rows read (past days and today's row, 1,000 per request, ordered by day then category) and History's names from it already landed in #186. This ticket does not change `Remote.readSchedule` or its paging. Acceptance criterion 3's paging is delivered and tested in #186 (`supabase.test.ts`, paging past 1,000 rows); this ticket's tests cover the part it keeps: the failure shows the panel on the Archive.

## User Stories

1. As a player, I want an Archive screen that lists every past Daily from #1 to yesterday in all three categories, with number and date and no answers (spec story 39).
2. As a player, I want a link to the Archive on the Daily screen and at the top of History's Daily segment, with the nav staying at four items (story 40).
3. As a player, I want to play a past Daily from the Archive (story 41).
4. As a player, I want a finished Daily in the Archive to show its result and open its read-only finished board (story 42).
5. As a player who started a Daily on its day and left it unfinished, I want to finish it from the Archive and have it count as on-day (story 43).
6. As a player, I want a late play to count in my totals but never in a streak (stories 44 and 45; the engine rules exist, this ticket proves them through the Archive).
7. As a player, I want the Archive to show the Error panel when the server cannot be reached, so that it never shows a partial list (story 46).
8. As a player, I want History's Daily segment to list only the Dailies I finished (story 47), with the number of each (story 30), and a late play to appear after I finish it (story 48).
9. As a player, I want the Daily nav item to be the current one on Archive addresses (spec "Archive").

## Implementation Decisions

### Addresses (owner decision, Q1)

- `/archive`: the list. `/archive/$category/$date`: one board, for example `/archive/mixed/2026-09-10`. Both are registered in `src/router.tsx` with `ArchivePage` and `ArchiveBoardPage` from a new `src/ui/archive-page.tsx`.
- A board opens for any day from 2026-09-09 (`PUZZLE_EPOCH`) up to and including server today that has a Schedule row for the category. Today is included because History links a Daily finished today. Today's unfinished Daily on its Archive address plays as on-day (`isLate` is false), as on the Daily screen.
- Anything else (a category that is not one of the three, a malformed or impossible date, a day before #1, a day after server today, or a day with no Schedule row) shows the note "No Daily on this day." with a link "Back to the Archive". It is not the Error panel and not a redirect.
- Every Archive address waits for the gate below before it decides: the note "No Daily on this day." shows only after the catalog, the current Dailies, and the past rows are ready (a "no row" case needs the rows), so a failed read shows the Error panel, never the note.
- Nav: `src/ui/nav.ts` gains `"/archive"` in the Daily item's `matchPaths`, and one helper, `onScreen(item, pathname)`, that matches a path exactly or as a prefix followed by `/` (never for `/`). `screenFor` and the shell's `isActive` both use it, so `/archive/mixed/2026-09-10` is on the Daily screen. A move between the Daily and the Archive, or between two Archive addresses, stays on one nav screen, so the router's transition type is "switcher" for all of them; the Archive list and the note carry `[view-transition-name:switcher-content]`, as `DailyBoard` does. `ArchiveBoardPage` takes `category` and `date` as props; the inline route component in `src/router.tsx` reads them with `archiveBoardRoute.useParams()`, as the other inline route components are built.

### Engine

- New `src/engine/archive.ts`:
  - `archiveRows(schedule: ScheduleRow[], serverToday: string): ScheduleRow[]`: rows with `isArchiveDay` and `date < serverToday`, newest day first, then category order (`DAILY_CATEGORIES`). A day with only some categories lists only those.
  - `boardEntryId(schedule, category, date, serverToday): string | null`: the entry id of the row for that category and date when `isArchiveDay` holds and a row exists, else `null`.
  - `type DailyResult = { status: DailyPersist["status"]; tries: number }` and `dailyResult(record)` (a record's `{ status, tries }`), `newestFirst` (the shared date-then-category order, also used by `historyRows`), and `resultLabel(result: DailyResult | null): string`: "Won n/6" (n = `tries`) for `won`, "Lost" for `lost`, "In progress n/6" for `playing` with `tries` of at least 1, else "Not played" (also for `null`). The Archive builds the argument from the stored record (`{ status, tries: guesses.length }`, `null` for no record); History rows already carry it.
  - One date-range predicate, `isArchiveDay(date, serverToday)` (`PUZZLE_EPOCH <= date <= serverToday`), serves both functions: `boardEntryId` uses it, and `archiveRows` uses it plus `date < serverToday`.
- `src/engine/history.ts`: `historyRows` no longer walks the Schedule. Its input becomes `{ saved: SavedDaily[]; schedule: ScheduleRow[]; protocols; applications }` (`utcToday` and `finishedToday` go). `SavedDaily` gains `tries: number` (it stays `{ date, category, status, tries }`). Its output is one row per finished saved Daily (status `won` or `lost`), newest first then category order, each `{ date, category, status, tries }` (a `DailyResult` plus date and category) plus `name` and `port` when the Schedule has a row for it and the catalog (whole catalog, by id) has the entry; otherwise the name and port are absent. A finished record with no Schedule row, or an entry the catalog lacks, stays listed without a name. `savedFinishedRows` (and its tests) and the `finishedToday` input go away; their job is this function. `HistoryRow` gains `status` and `tries` and keeps `name` and `port` optional.

### Shared reads

- The `useScheduleRows` hook moves from `src/ui/history-page.tsx` to a new `src/ui/schedule-rows.ts` (module-private there), which exports `useScheduleReads`: the three reads History and the Archive need (catalog, current Dailies, past rows) as one `allReady` value, with the retries. On mount it calls `serverStore.retry()`; it attaches `attachRetryTriggers` for the past rows; its `retry` reloads the store reads and the past rows. History and the Archive both call it. `useScheduleRows` keeps the 10-second `settle` timeout, the `failed` retry, and the "no remote counts as failed" rule.
- `ErrorPanel` (`src/ui/server-data.tsx`) gains an optional `onRetry` prop; with none, "Try again" still calls `serverStore.retry` as today. `LoadStatus`'s props gain the same optional `onRetry` and pass it through.
- The imports `useScheduleRows` needs (`Remote`, `ScheduleRow`, `Loadable`, `settle`, `useCallback`, `useEffect`, `useState`) move with it, and `history-page.tsx` drops the ones it no longer uses, with `isFinished` (unused once `historyRows` takes finished records).
- One shared row piece, new `src/ui/daily-row.tsx`: `DailyRowLink` (the `Link` to a board address with the category badge, `#n`, the result label, and an optional trailing name and port) and `DailyGroupList` (the date-grouped list markup: an outer list named by the page heading, a date heading per day, one item per row; it groups the sorted rows itself, with a private `groupByDate`, and takes an `idPrefix` for the date heading ids and a `renderRow`). The Archive list and History's Daily segment both use them, so the badge, the text format, the grouping, and the list markup exist once.

### The Archive screen

- `ArchivePage` and `ArchiveBoardPage` share one gate. The gate is `useScheduleReads()`. While any read loads it shows the loading line; when any failed it shows the Error panel in place of the content, under the back link or heading, with the shell and nav staying. "Try again" calls `serverStore.retry()` and the schedule `retry`. On mount the gate calls `serverStore.retry()` and attaches `attachRetryTriggers(retrySchedule)`, as History does, so `online`, focus, and visibility retry a failed past-rows read. The App already attaches the store's own triggers. Only a read that has not succeeded shows the panel: a failed background read after a success changes nothing.
- The list (heading "Archive", `h1`): a list named by that heading, grouped by day, newest day first, the day's date as an `h2`, then one `li` per category in category order. Each `li` is a `Link` to the board address reading `[category badge] #n · <resultLabel>`. The badge is the same one History uses (`CATEGORY_LABEL`). No name, no port, no answer. The result label comes from the player's stored record (`persist.readDaily`). No paging, no filter.
- The board: `ArchiveBoardPage` parses `$category` with `isDailyCategory` and `$date` with `isValidUtcDate`, calls `boardEntryId`, and resolves the entry with `entryById` over both catalogs (the whole catalog). With no entry id: the note above. With an entry id the catalog lacks: the Daily's missing-entry rule through the exported `MissingPuzzle` (`serverStore.rejectCatalog()` in an effect, then the Error panel, so a retry reloads the catalog). Its button is the store retry only; the schedule rows are loaded by then, so nothing else needs a retry.
- Then it renders `DailyBoard` with `date` = the address's date and `serverToday` = the live server today from the current Dailies. The board keys on the category and date, so moving between two Archive addresses rebuilds it. `DailyBoard` is exported from `src/ui/daily-page.tsx` and gains one prop, `top: ReactNode`, rendered where it renders `DailySwitcher` today. The Daily screen passes the switcher and the Archive link; an Archive board passes a "Back to the Archive" link. `onTry` becomes optional and the Archive board omits it. `MissingPuzzle` and `DailyLoading` also gain the same `top` prop and are exported, so the Archive board's missing-entry and loading states reuse them; the Daily passes `<DailySwitcher>` as before.
- Everything else on the board comes from `DailyBoard` unchanged: the `#n · date` header, the `late` mark at the first try (`isLate(date, serverToday)`), the record under the board's own `(category, date)`, the share line with ` · late`, `categoryStats` folded at server today, `GlobalStats` (with its "Late play, not counted" note) after a finish, and the read-only finished board (no digit slots, no Submit). An Archive board open across midnight is unaffected: it shows a past day (or today's Daily, which then keeps working with the same `late` rule).

### Links

- Daily screen: an "Archive" link (to `/archive`) directly under the Daily switcher on the loaded board only (`DailyBoard`'s `top` prop). Loading and failed states show no link.
- History's Daily segment: an "Archive" link at the top, above the list, in every state. History's Blitz segment has none.

### History

- `DailySegmentList` always lists the finished saved Dailies from the device (`persist.listDailyDates` and `readDaily`), newest first, grouped by date as today. Each row is a `Link` to its Archive board reading `[category badge] #n · <resultLabel>` and, when the name is known, ` · <name> <port>` (port in the mono font as today). The name and port appear once the catalog, the current Dailies, and the past rows have all succeeded (`allReady`), as the #187 behavior; before that the rows show badge, number, and result. History still never shows the Error panel and shows no loading line. The rows are computed from the device store on each render of a status change, as the saved rows are now.
- Today's finished Daily is a History row like any other (its link opens the Archive board for today, a read-only finished board).
- Before the three reads succeed, History calls `historyRows` with empty `schedule`, `protocols`, and `applications`, so the rows carry no name; once ready it passes the loaded values. The rows are memoized on the reads' status and `persist`, as `saved` is now, so a render does not re-read the store. A finished record with no Schedule row has no name, and its link opens "No Daily on this day." (a finished record cannot be dated after server today in practice); the spec accepts this dead end rather than hide a finished Daily from History.

## Testing Decisions

Tests assert behavior through the highest seam: what the player sees, the local store, and the fake `Remote`'s calls.

- Engine unit tests: a nav test for `onScreen` (exact match, prefix followed by `/`, `/` never a prefix of another path, `/archive/mixed/2026-09-10` on the Daily item); `archive.test.ts` (`archiveRows`: range, order, partial days, excludes today and the future and any day before #1; `boardEntryId`: inside, today, before #1, after today, no row; `resultLabel`: all four states). `history.test.ts` is rewritten for the new `historyRows` (finished only, order, names joined, a missing row, a missing entry, retired and other-kind entries by id).
- App-level (a new `src/ui/archive-page.test.tsx`, `memoryStore`, the fake `Remote`; prior art `history-page.test.tsx`, `global-stats.test.tsx`, `new-day.test.tsx`):
  - list: grouped by day, newest first, without today and without a day that has no row, numbers match `puzzleNumber`, every row a link with the board address, all four states shown from stored records, no entry name or port anywhere;
  - addresses and nav: the Daily nav item is current on `/archive` and on a board; the Daily screen's and History's Archive links point to `/archive`; an invalid category, an invalid date, a day before #1, a future day, and a day with no row each show "No Daily on this day." with the back link;
  - late play: opening a past Daily with no record, finishing it, the stored record under that Daily's own date has `late: true` and today's record is untouched; the share text ends with ` · late`; the "Late play, not counted" note shows; the streak shown by the Reveal does not change;
  - on-day finish: a stored unfinished record from its day (`late: false`, dated yesterday) finished from the Archive keeps `late` false, its share has no ` · late`, and the streak counts it;
  - read-only board: a finished stored record opens with the Reveal and global stats and no digit slots or Submit; today's finished Daily opens the same way;
  - failure: with `failSchedule` the Archive shows the server message in the Error panel while the nav stays; after the fake recovers, "Try again" (and a focus) loads the list; a held read shows the loading line;
  - a board whose entry the catalog lacks shows the Error panel and "Try again" reloads the catalog;
  - today's unfinished Daily on its Archive address plays as on-day: its record has `late` false;
  - the Daily screen shows the Archive link only on the loaded board (not while loading or failed);
  - an invalid address waits for the gate: with `failSchedule` it shows the panel, not the note.
- `history-page.test.tsx`: these tests expect scheduled days and are rewritten or seeded with finished records: "History heading and past days newest first without today", "won Mixed today lists Mixed today and not unfinished categories", "lost Protocols today lists Protocols today", and "answers resolve by id in the whole catalog" (it seeds only Schedule rows; it gains finished records). "playing Mixed today", "corrupt Mixed persist today", "a failed past-rows read", and "History lists the saved rows until the past rows arrive" stay (their expectations hold). In the rewritten set: only finished Dailies list (a playing record and an unplayed day are absent, today's finished Daily is present); a row shows badge, `#n`, result, and name and port once loaded; a row's link goes to its Archive board; before the reads succeed rows show no name; a late play appears after it finishes; the "History list contains no links" test now covers only the Blitz segment, and the Daily segment has links.
- `daily-marks.test.tsx` and the other Daily suites stay green: `DailyBoard`'s only changes are the `top` prop, the optional `onTry`, and the export.

## Out of Scope

- The paged past Schedule rows read and History reading names from it (#186); the retry machinery, timeout, and panel copy (#187).
- Playwright end-to-end checks of the Archive and History (#193); the release and switch-over steps; any database change (none is needed: row-level security and `readSchedule` exist).
- Per-category Archive tabs, filters, paging of the list, a calendar, search by number, and a "next unplayed" shortcut.
- Changes to the glossary (it already defines Archive and Late play) and to the ADRs.

## Further Notes

### Author calls

Accepted by the owner through the coordinator, 2026-10-02:

- Q1: the addresses, the board range (today included), today's unfinished Daily on its Archive address plays as on-day, and the "No Daily on this day." note for every other address, instead of the Error panel or a redirect.
- Q2: the list layout (grouped by day, newest first, category order), the row text `[badge] #n · <state>` with the four states, History's row text with the name and port once loaded, the Archive links (under the Daily switcher on the loaded board; at the top of History's Daily segment), and no paging or filters.

Made while writing, listed to the owner before implementation:

- The Error panel's "Try again" gains an optional `onRetry`, so the Archive's button retries the store's reads and the past rows together.
- The Archive's gate needs the catalog, the current Dailies, and the past rows, as the spec's "Error panel" section says, even for the list, which uses no catalog.
- `DailyBoard` is exported and takes a `top` prop; the Archive board reuses it instead of a second board.
- `useScheduleRows` moves to its own module, behind one `useScheduleReads` hook that History and the Archive share.
- `historyRows` takes the saved Dailies instead of walking the Schedule; a finished record with no Schedule row or no catalog entry stays listed without a name (before, it could not exist, because rows came from the Schedule).
- A History row shows the result as "Won n/6" or "Lost" (the same labels as the Archive's).
- The nav matches the Archive addresses by prefix through one helper.
- One shared row piece (`daily-row.tsx`) and one range predicate (`isArchiveDay`), so History and the Archive cannot drift.
- A History row for a finished Daily with no Schedule row links to the "No Daily on this day." note.
