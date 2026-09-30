# Ticket spec: Leaderboards

Spec for #139. Tracker: https://github.com/mquesada02/portdle/issues/139. Parent: Spec 4 (stories 3, 4, 40 to 51), https://github.com/mquesada02/portdle/issues/127 (`docs/superpowers/specs/2026-09-28-spec4-backend.md`, "Backend schema", "UI", "Operations"). Map: https://github.com/mquesada02/portdle/issues/114. Blocked by #132 (time to score) and #136 (row sync), both merged.

## Problem Statement

A Blitz Best is invisible to anyone else. The backend already holds each signed-in player's Bests and runs (row sync), but nothing ranks them and no screen shows a ranking.

## Solution

Anyone, signed in or not, can open a Leaderboards tab on the Blitz screen and browse the 18 Leaderboards (Daily category, Orientation, Blitz mode) in each of three Leaderboard windows: All-time, Weekly, and Today. Each shows the top 100 players with rank, display name, and score. A signed-in viewer sees their own row marked "You", pinned below the list when they rank outside the top 100. Three read-only database views do the ranking; the app only reads them. The daily keep-alive ping switches to a real read of the All-time view.

## User Stories

1. As a player who never signs in, I want to browse the Leaderboards, so that I see how scores compare before I decide to sign in.
2. As a player on a build with no backend configured, I want no Leaderboards tab at all, so that nothing points at a service that is not there.
3. As a player, I want a Play / Leaderboards tab control under the Blitz heading, so that Leaderboards sit beside my Bests without a fifth nav item.
4. As a player, I want the Play tab to be the arena exactly as it is now, so that starting a run is as quick as today.
5. As a player, I want the tab control to show only while the arena is idle, so that I cannot leave a run mid-play; it stays hidden during a run and on the end card.
6. As a player, I want the tab change to use the same motion as the other switchers, so that the app feels consistent.
7. As a player, I want to pick a window (All-time, Weekly, Today), a Daily category, an Orientation, and a Blitz mode with rows of pills, so that each of the 18 Leaderboards in each window is one tap away.
8. As a player, I want each Leaderboard to list the top 100 players with rank, display name, and score, so that I see who leads.
9. As a player, I want equal scores ordered by faster time to score, so that ties break fairly.
10. As a signed-in player outside the top 100, I want my own row pinned below the list with my rank, so that I see where I stand.
11. As a signed-in player inside the top 100, I want my row marked "You", so that I find it.
12. As a player, I want Weekly to rank each player's best run played since Monday 00:00 UTC and Today to rank their best run since 00:00 UTC today, so that each window starts fresh.
13. As a player, I want All-time to rank each player's Best or best run, whichever is higher, so that a long-standing Best still counts even when its run never reached the backend.
14. As a player, I want only scores above zero to create a row, so that empty rows never pad a list.
15. As a player, I want only players with a confirmed display name to appear, so that no unconfirmed name is public.
16. As a player, I want a loading line while a Leaderboard loads, so that I know the list is coming.
17. As a player, I want a plain error line when a Leaderboard cannot load, so that I know an empty list is not the real Leaderboard.
18. As a player, I want an empty Leaderboard to say nobody has played it yet, so that an empty list is not mistaken for a failure.
19. As a signed-in player, I want opening the tab to push my pending changes first, so that the run I just played shows.
20. As the owner, I want the views to expose only account id, confirmed display name, key, score, time to score, and rank, so that nothing private leaks.
21. As the owner, I want grants limited to select on the three views for anonymous and signed-in visitors, so that nothing wider than Spec 4 needs is opened.
22. As the owner, I want the daily keep-alive ping to run a real query on the All-time view, so that the free project sees database activity.

## Implementation Decisions

- **Migration** `20260930000005_leaderboards.sql`, applied by the owner in the Supabase SQL editor after 0003 (and any sibling migrations). Three views in the public schema: `leaderboard_all_time`, `leaderboard_weekly`, `leaderboard_today`. Each has the columns `account_id`, `display_name`, `category`, `orientation`, `mode`, `score`, `time_to_score_ms`, `rank`.
  - Each view keeps the default owner rights (not `security_invoker`), so it reads the private runs, Bests, and accounts tables that a visitor cannot. A comment in the migration says this is intentional (Supabase's linter flags such views) and that `account_id` is exposed only because Spec 4 decides so. It joins accounts on `name_confirmed` and keeps only scores above zero.
  - Weekly and Today take runs whose `ended_at` is at or after the window start and not after the current time, so a run with a future `ended_at` (a wrong device clock; the backend never checks plausibility) never ranks early. The window start is computed from the current UTC time with an explicit UTC conversion, so it does not depend on the session time zone (Weekly: the Monday 00:00 UTC of the current week; Today: 00:00 UTC today). All-time takes every run not after the current time plus the stored Best of the same key.
  - Per player and key, one row: the highest score, then the lowest time to score (a row without a time loses an equal-score tie to one with a time), then a stable choice.
  - `rank` is a row number partitioned by category, orientation, and mode (so the key filters of a read narrow the ranking work), ordered by score descending, time to score ascending with nulls last, then account id, so ranks are unique and stable.
  - Explicit grants only: the migration revokes all rights on each view from `public`, `anon`, and `authenticated`, then grants `select` on each view to `anon` and `authenticated`. Nothing is granted on the base tables and no function is added. The migration file is numbered 0005 to leave 0004 free for a sibling ticket; the owner applies migrations in filename order.
- **`Remote` gains one call**, `readLeaderboard(query)`, where the query names the window, category, orientation, and mode. It returns the rows with rank up to 100, plus the viewer's own row when the viewer is signed in and ranked, and the viewer's account id (or none). A row carries account id, display name, score, time to score (or none), and rank. The Supabase adapter reads one view with the four key filters, ordered by rank ascending, and, for a signed-in viewer, `rank <= 100 or account_id = <viewer>`, in one request. The viewer id comes from the client's stored session; a session that is unreadable or cannot be refreshed degrades to an anonymous read with no own row. A failed read rejects. The in-memory fake holds rows per window and key and applies the same rank, order, and own-row rule; it can be told to fail or to hold a read, and it records how many pushes had completed when each read arrived, so a test can see that a push landed before the first read.
- **Blitz screen.** When the app has a `Remote`, the idle arena shows a Play / Leaderboards tab control under the heading (tab semantics: `tablist`, `tab` with `aria-selected` and `aria-controls`, a labelled `tabpanel`, roving tabindex, left and right arrows that wrap, Home and End). Tab state is component state, not an address. The Leaderboards tab replaces the whole idle body (Last run and Bests included); the Play tab shows it unchanged. The page reads `remote` and `sync` from the router context, which already carries both. Without a `Remote` the control is absent and the page is unchanged. Starting a run replaces the idle view as today, so the control disappears during a run and on the end card and the tab resets to Play.
- **Tab motion.** The tab change runs through the existing view-transition helper with the `switcher` type, and the panel content carries the existing `switcher-content` transition name, as History's segments do. No new CSS.
- **Leaderboards panel.** A picker of three pill rows (window; Daily category; Orientation and Blitz mode sharing one row), each choice its own labelled radio group (Window, Daily category, Orientation, Blitz mode), built from the arena setup dialog's radio pills and its category and mode lists (moved to a shared module so both use them). Default selection: All-time, Mixed, Default, Sprint. Below it, the list of rank, display name, and score. The viewer's row is marked "You" wherever it appears; when it is outside the top 100 it is pinned below the list with its rank. States (the loading line has `role="status"`, the error line `role="alert"`; focus stays on the tab after a tab change): loading, an error line, and an empty line ("Nobody has played this Leaderboard yet."). A picker change starts a new read and drops the answer of a superseded read; leaving the tab drops any read in flight. Names render as plain text.
- **Push first.** Opening the panel first waits for the sync module's existing `refresh` (read the sign-in state, pull, merge, push of pending changes; it never rejects, and for a signed-out visitor with no stored sign-in it loads nothing) and then reads. A failed push or pull does not block the read. Later picker changes read again without another sync.
- **Keep-alive.** The `keep-alive` job in the Daily freeze workflow requests `/rest/v1/leaderboard_all_time?select=account_id&limit=1` with the anon key instead of the REST root, and passes only on an HTTP 2xx status (a 4xx now means the read did not run). This is the follow-up the #141 spec's owner decision names for this ticket, and it supersedes the status range in the #141 spec. Skip-when-empty, timeout, `permissions: {}`, and job independence stay as they are.
- **Smoke.** The hand-run smoke script gains anonymous and signed-in reads of the three views and checks that writing to a view and reading the base tables anonymously are refused. A new owner-run SQL test creates throwaway users and rows in one transaction, asserts the ranking rules, the windows (with the session time zone set away from UTC, around the Sunday-to-Monday and midnight boundaries, and with a future run), the exact column list of each view, and the grants (including as `anon`, and no write rights on the views), and removes its rows.

## Testing Decisions

- A good test drives `App` with `memoryStore` and the fake `Remote`, acts as the player, and asserts what is on screen, the local store, and the fake account's rows, never internal calls.
- App-level tests: no tab control without a `Remote`; tab control on the idle arena only (absent during a run and on the end card); Play is the unchanged arena; the tab change goes through the `switcher` view transition (`stubViewTransitions`); the picker requests the chosen window and key; top rows show rank, name, score; "You" marks the viewer's row inside the top 100; an outside-the-top-100 viewer's row is pinned with its rank; a signed-out viewer sees no "You"; loading, error, and empty lines; a superseded read is ignored; opening the tab pushes pending changes before the read (a run played and not yet pushed is pushed, and the fake shows the push had completed at the first read); the tab and pill roles and states.
- The Supabase adapter's request shape gets a unit test with a fake client in the existing adapter test file. The views and grants are checked by the owner-run SQL test and the smoke script, not by Vitest, as Spec 4 decides.
- Prior art: `blitz-arena.test.tsx`, `history-page.test.tsx`, `row-sync.test.tsx`, `account-menu.test.tsx`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Out of Scope

- Daily leaderboards, friends, avatars, realtime updates, and paging beyond the top 100.
- Showing time to score in a row.
- A retry button, or any sync status.
- Applying the migration (the owner does it by hand).

## Further Notes

- Author calls, so they can be overruled:
  - Leaderboard windows keep unique ranks with a stable order, not shared ranks for equal scores; Spec 4 says "a stable order".
  - The default picker selection is All-time, Mixed, Default, Sprint, as in the approved prototype.
  - The Leaderboards tab is not an address and resets to Play when the Blitz screen remounts.
  - "Push first" reuses `refresh`, so opening the tab also pulls once. A push that hangs delays the read; there is no timeout.
  - The keep-alive job now passes only on 2xx (Spec 4's ticket #141 passed any status below 500, because no table existed). A merge before the migration is applied turns the ping red until it is applied.
  - The owner-run SQL test file is beyond the smoke script Spec 4 names; it exists because the ranking rules cannot be checked otherwise. The owner can drop it.
  - The panel does not re-read when the viewer signs out while it is open; a stale "You" stays until the next read.
  - The pill rows use the setup dialog's radio pills; the tab control keeps the History switcher's underline look.
- The viewer's own row is found by account id, which the views expose by Spec 4's decision.
