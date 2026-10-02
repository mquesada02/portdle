# Ticket spec: Daily from the server (tracer bullet)

Spec for #186. Tracker: https://github.com/mquesada02/portdle/issues/186. Parent: Spec 5 (Dailies from the backend), https://github.com/mquesada02/portdle/issues/181 (`docs/superpowers/specs/2026-09-30-spec5-dailies-backend.md`, "Architecture", "Client: loading and today", "Catalog on the client"). Map: https://github.com/mquesada02/portdle/issues/169. Backend facts: `docs/superpowers/specs/2026-09-30-t184-catalog-schedule.md`. Base branch: `spec5`.

## Problem Statement

The Daily, Blitz, the Codex, and History read the catalog and the Schedule from JSON files inside the site bundle. Anyone can read future answers, and the owner cannot change a Daily without a redeploy. The backend now holds the catalog and the Schedule (#184), but no client code reads them.

## Solution

The client loads the catalog and the current Dailies from the backend with plain public reads. The Daily date is the UTC date the server returns, never the device clock. Blitz leaves out the three Daily answers the server names. Retired entries leave play but stay in the Codex (when seen) and in History. History reads past Schedule rows from the backend. The client bundle stops importing the catalog and Schedule files. The files stay in the repository until #194.

Until the shared error panel (#187) exists, a failed read shows one plain line, "Could not load puzzles.", in the Daily, in Blitz's Play tab, and in the Codex. The owner approved this stand-in as a temporary fix (Q2, 2026-10-02). Each place carries a code comment that says it is temporary and that #187 replaces it.

## User Stories

1. As a player, I want the Daily to come from the server, so that nobody can read future answers from the site.
2. As a player, I want the Daily date to be the server's UTC date, not my device clock, so that a wrong clock never shows or saves the wrong Daily.
3. As a player, I want my tries saved under the date the server gave me, so that my record matches everyone else's Daily.
4. As a player, I want a loading state while Portdle loads puzzles, so that I know something is happening.
5. As a player, I want Blitz to load the catalog and the current Dailies, and to leave today's three Daily answers out of its prompts using the server's today, so that Blitz never spoils a Daily.
6. As a player, I want the Codex to load the catalog only, so that it works even when the current Dailies read fails.
7. As a player, I want a retired entry never to be a Daily answer, a Blitz prompt, a Blitz pick, or a miss identification, so that retired entries leave play.
8. As a player who has seen a retired entry, I want it to stay in my Codex and in my History, so that nothing I earned disappears.
9. As a player who never saw a retired entry, I want it hidden from my Codex, so that I am not asked to collect it.
10. As a player, I want a Daily's answer found by its entry id in the whole catalog, so that a change of an entry's catalog kind never loses a past answer.
11. As a player, I want History to list past Dailies with their answers, read from the backend, so that History keeps working with no bundled Schedule.
12. As a player, I want a plain failure line when puzzles cannot load, so that I never see a broken or blank screen.
13. As the owner, I want the client bundle to hold no catalog or Schedule JSON, and the Supabase library to stay lazy, so that future answers do not ship and first load stays small.
14. As a developer, I want the App-level tests to run on a fake `Remote` that serves fixtures, so that no test needs the bundled files in the product code.

## Implementation Decisions

### Remote reads

- `Remote` gains three public reads (no sign-in needed), typed in `src/remote/remote.ts`:
  - `readCatalog(): Promise<Catalog>`, with `Catalog = { protocols: CatalogEntry[]; applications: CatalogEntry[] }`, split by the entry's `kind`.
  - `readCurrentDailies(): Promise<CurrentDailies>`, with `CurrentDailies = { today: string; entryIds: Record<DailyCategory, string> }`. It rejects when the response does not hold exactly one row per category, or when any entry id is null (a missing day is a failed read, #184 story 20). It does not carry the server time; #188 adds that field when it needs it (author call).
  - `readSchedule(): Promise<ScheduleRow[]>`, with `ScheduleRow = { category: DailyCategory; date: string; entryId: string }`: every Schedule row the server shows (row-level security limits it to days on or before the server's UTC date), fetched page by page, 1,000 rows per request, ordered by day then category, until a page is short (owner decision, Q1).
- The Supabase adapter (`src/remote/supabase.ts`) serves all three with `fetch` and the public anon key (an `apikey` header, as `scripts/smoke-backend.ts` sends for anonymous calls, and `Content-Type: application/json` on the POST), never the Supabase library, which stays lazy for sign-in and sync. The adapter holds one new fetch-based paged helper (`fetchAllRows`, reusing `PAGE_SIZE`) that the catalog and the Schedule reads share; the client-based `readAll` stays for sync. The sort `order=day,category` is alphabetical by category, not the `DAILY_CATEGORIES` order, so no test asserts that order (`historyRows` sorts for itself). The `fetch` function is injectable through `Deps`, as `loadLibrary` is, so unit tests need no network.
  - Catalog: `GET {url}/rest/v1/catalog_entries?select=*&order=id`, paged like the Schedule (a page of 1,000 covers it today; paging keeps it correct later).
  - Schedule: `GET {url}/rest/v1/schedule?select=category,day,entry_id&order=day,category`, paged with `limit` and `offset`.
  - Current Dailies: `POST {url}/rest/v1/rpc/current_dailies` with body `{}`, so no browser or proxy cache can return a stale day. It returns three rows `{server_time, utc_date, category, entry_id}`.
  - A response that is not `ok` rejects. The adapter maps catalog rows to `CatalogEntry`, uses `kind` for the split and then drops it, and rejects an unknown kind (`answer_eligible` to `answerEligible`; null `blurb` to absent; `aliases` and `sources` kept).
- The 10-second timeout and every retry belong to #187; this ticket adds none.
- The fake `Remote` (`src/test/fake-remote.ts`) serves the three reads from fixtures: its current-Dailies `today` is settable, defaults to the suite's date, and the helper builds `entryIds` from that date with `getDaily` and has switches to fail each read and to hold each read until released, like its other reads.

### Server data in the app

- A small store, created once per `remote` in `App` (outside the router, so a load never remounts the screens), holds two states, each `loading`, `ready` with its value, or `failed`: the catalog, and the current Dailies. An effect in `App`, not the `useMemo` that creates the store (StrictMode runs `useMemo` twice), starts the load, guarded by a started flag so a double effect triggers one read of each kind per `remote`. It loads both once at app start, in parallel, and notifies subscribers. With no `remote` (a no-backend build) both go straight to `failed`. Screens read it through a hook and `useSyncExternalStore`; a snapshot object is replaced only on a state change, so `getSnapshot` is stable between changes. The store reaches screens through the router context; the router's inputs do not include its state.
- The router context keeps `utcToday` for the shell's streak-gap step, and `App` keeps it for `createSync` (owner decision, Q3). The device-clock state in `App`, its listeners, the shell's `syncUtcDay`, and the router rebuild on a clock change stay as they are; #188 and #189 remove them. No screen except the shell uses that `utcToday` for a Daily, Blitz, or History after this ticket.
- Server today is the `today` of the current Dailies. Every use of `utcToday` in the Daily screen switches to it: the record read and write, `readLastPlayed`, `writeLastPlayed`, `categoryStreakGap`, `writeLastSeenUtc`, and the prop passed to its child. Those stats steps stay in the Daily screen until #189 removes them; only their date changes, so a wrong device clock never writes a record and its stats under different dates. Blitz and History use server today too. The device clock stays in two places until #188 and #189: the shell's `syncUtcDay`, and the `utcToday` that `createSync` takes for its stats rebuild after a pull (a wrong clock can still skew that fold; #189 removes it).
- A failed or loading state writes nothing: no screen creates or overwrites a saved record before the answer is known.

### Screens

Each of the Daily, Blitz, the Codex, and History splits into an outer gate that reads the store and an inner component that keeps today's hooks and receives the loaded data as props. No hook, initializer, or effect of the inner component runs before the data is ready. This matters: the Codex's mount effect clears the fresh flags and writes the stored Codex, and the Daily's record initializer needs the server date. For Blitz the inner component is the whole Play side (the setup, the arena, and the run view, which own `run`, the timers, and the location-key effect) and renders its own chrome, including the tabs and the Leaderboards tab, in its no-run branch; the outer part only decides between the loading line, the failure line, and the inner component for the Play tab. The Leaderboards tab and the tab switcher must stay reachable while the Play tab loads or has failed, so the outer part also renders them in those two states.

- **Daily**: waits for the catalog and the current Dailies; `loading` shows a plain "Loading..." status line, `failed` shows the plain failure line. When ready, the answer is the catalog entry whose id equals `entryIds[category]`, found in the whole catalog (protocols and applications together). The digit count comes from the answer's port, as today; miss identification uses the category's playable catalog (see Retired entries). The guess caption's lookup of a saved identification (`RowCaption`) uses the whole catalog, so a saved guess that named a since-retired entry keeps its caption. The "Puzzle unavailable" screen goes away: an entry id missing from the catalog is a failed state.
- **Blitz**: the Play tab waits for both reads; the Leaderboards tab and the tab switcher are unaffected (they do not depend on the catalog). `loading` shows the loading line in the Play tab; `failed` shows the failure line. The Daily-answer exclusion takes the three entry ids from the current Dailies instead of the bundled Schedule (`startBlitz` takes `dailyIds: string[]` in place of `utcToday`, `schedules`, and the schedule lookup).
- **Codex**: waits for the catalog only.
- **History**: the Daily segment waits for the catalog, the current Dailies, and the past Schedule rows (read when History mounts, kept in component state, with a cancel flag so a late result never sets state after unmount). While any read is loading it shows the loading line; if a read failed it lists no Daily rows. This is interim: History's rows need the Schedule rows, so an empty list is deliberate until the Schedule read succeeds, and #187 and #191 own the end state ("History still shows saved results", ADR 0003). It then builds the same rows as today (every scheduled day up to server today; today's row only if that Daily is finished) from the rows and the catalog; names resolve by id in the whole catalog, retired entries included. #191 changes the filter to finished Dailies; this ticket does not (owner decision, Q1). The Blitz segment is unaffected.
- The loading line and the failure line are one small shared piece (a status text), so the three screens match; the failure line carries the temporary-stand-in comment once in that piece, naming #187.

### Retired entries

- A new engine helper returns the playable entries of a catalog: those with `retired` not true. The Daily's miss identification catalog, Blitz's inverted-mode picker and its default-mode identification use it; the filtering sits inside the engine: `reduceBlitz` filters, and a new engine function returns the picker's catalog (used where `blitz-page.tsx` builds `categoryCatalog` for the `Typeahead` today), so no call site can forget it. A test checks that a retired entry is not offered in the picker. `startBlitz`'s pool already drops retired entries through `answerPool`. A retired entry is never a Daily answer (the generator guarantees it; the client does not re-check). Whether a guess is correct compares the port with the answer found by id in the whole catalog, not with the playable catalog, so a Daily whose entry was retired after it was scheduled stays winnable (a unit test covers it). The helper is a code name only; the glossary does not change.
- The Codex hides a retired entry the player has not seen and keeps a retired entry that has a Codex record; `codexGroups` and `codexCounts` take this rule, and the page derives its totals from what the groups show (card counts) instead of `protocols.length` and `applications.length`. History resolves by id in the whole catalog.

### Bundle

- `src/catalogs/production.ts` is deleted. No non-test file under `src/` imports `src/catalogs/*.json`; "test file" means `*.test.*` and everything under `src/test/` (`src/test/blitz.ts` is repointed to the fixture helper). A Vitest test reads the source files and fails when a non-test source file imports a path under `catalogs/`. A second test fails when `src/remote/supabase.ts` imports `@supabase/supabase-js` other than as `import type` or as a dynamic `import()`, which keeps the library lazy; the build check below also confirms the library sits in its own chunk. The JSON files, `engine/daily.ts` (`getDaily`, still used by `catalog-load.test.ts`), and the schedule files stay until #194.
- Tests use the JSON files only as fixtures: a helper module in `src/test/` serves the fake `Remote`'s default data, and tests that import the JSON directly today (`miss-popover`, `codex-page`, `search`, `catalog-load`) may keep doing so. `src/test/dailies.ts` keeps using `getDaily` and `ScheduleFile` for fixtures.

## Testing Decisions

- Tests exercise behavior through the highest seam: `<App>` with `memoryStore` and the fake `Remote` serving fixtures. They assert what the player sees, the store's contents, and the fake's calls. Prior art: the existing App-level suites (`mixed-daily.test.tsx`, `blitz.test.tsx`, `codex-page.test.tsx`, `history-page.test.tsx`).
- Existing App-level tests that rendered `<App>` with no `remote` now pass a fake `Remote` with the fixtures, through one shared render helper that waits for the loaded screen. Their assertions stay, but where they read the screen right after render they now wait for it (`findBy*`). Passing a `Remote` also turns on the account menu and sync (`attach`, `refresh`); each suite is checked for assertions that assumed no backend (the Blitz suites also gain the tab switcher), and the helper's fake starts signed out.
- The `mixed-daily.test.tsx` case that asserts the "Puzzle unavailable" screen is replaced by a failure-line test (a null entry id in the current Dailies).
- `engine/blitz.test.ts` is updated for the new `startBlitz` input (`dailyIds` replaces `utcToday` and `schedules`). Where a test passes a `utcToday` today, the fake's current-Dailies fixture serves the same date, and the `utcToday` prop stays for the shell.
- New App-level tests: the Daily shows the loading line, then the Daily of the server's date when the device clock says another date; tries are saved under the server date; a failed catalog read and a failed current-Dailies read show the failure line in the Daily; a no-backend build shows it too; Blitz's Play tab shows loading then the failure line, and the Leaderboards tab still works; Blitz leaves out the three answers of the server's day; Codex loads with the current-Dailies read failing; a retired entry is never a Blitz prompt, a Blitz pick, or a miss identification, is hidden in the Codex when unseen and shown when seen; History lists rows from the past-rows read with names resolved in the whole catalog (including a retired entry and an entry whose catalog kind differs from the category's), and lists no Daily rows after a failed read.
- `engine/history.test.ts` is rewritten for `historyRows` on Schedule rows.
- The Daily test asserts that `lastPlayed` and `lastSeenUtc` take the server date when the device clock differs; a store test asserts one read of each kind per `remote` under a double mount.
- Unit tests: the Supabase adapter's three reads with an injected `fetch` (URLs, headers, the POST body, paging past 1,000 rows, a null entry id rejecting, non-ok rejecting, the row mapping); the engine helpers (playable catalog, whole-catalog lookup by id); `codexGroups` and `codexCounts` with retired entries; `historyRows` on schedule rows.
- Bundle test: the static import check above. After `pnpm build`, a manual check that no entry name from the JSON files appears in `dist/` and that `@supabase/supabase-js` sits in a separate chunk the entry chunk does not statically import (the evidence for the worker report).
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass; CI is green.

## Out of Scope

- The error panel, its two messages, Try again, `online` and focus retries, and the 10-second timeout (#187). Until then a failed read stays failed until a reload.
- New-day detection, the midnight timer, removing the device-clock state and the router rebuild on a day change (#188).
- The `late` mark, stored stats removal, the local switch-over step (#189).
- Puzzle numbers and the share line (#190); the Archive and History of only finished Dailies (#191).
- The Schedule generator run on the local stack (#185): until it runs, the local stack's Schedule ends at the switch-over day, so `pnpm dev` shows the failure line on a later date.
- Deleting the JSON files, `getDaily`, and `identity.json` (#194).

## Further Notes

- Author calls accepted by the owner: Q1 (past Schedule rows read in this ticket), Q2 (the temporary stand-in line), Q3 (device-clock state stays for the shell).
- Author calls made while writing, listed to the owner before implementation: the store outside the router; `Catalog` as two arrays; no server time in `CurrentDailies`; the three reads required on `Remote`; `readSchedule` paging in the adapter with `limit` and `offset`; History empty (not a retry) after a failed read; the loading line text "Loading..." and the failure line text "Could not load puzzles."; retired entries filtered from every play surface catalog, including Blitz's picker; the no-backend build showing the failure line; `engine/daily.ts` kept for `catalog-load.test.ts`; `Catalog` kept as two arrays (the Codex and `catalogFor` consume them) instead of one flat list; `codexCounts` and totals following what the Codex shows; the static-import tests; the injectable `fetch`; the shared status-text piece; the `apikey`-only header; History's interim empty state.
- Pull request targets `spec5`, title `feat(client): load the Daily and the catalog from the server`, body "Closes #186".
