# Ticket spec: Global stats with the Reveal

Spec for #192. Tracker: https://github.com/mquesada02/portdle/issues/192. Parent: Spec 5 (Dailies from the backend), https://github.com/mquesada02/portdle/issues/181 (`docs/superpowers/specs/2026-09-30-spec5-dailies-backend.md`, "Global stats view", "Global stats with the Reveal", stories 31 to 38). Map: https://github.com/mquesada02/portdle/issues/169. Base branch: `spec5`. Blocked by #189 (merged).

## Problem Statement

After a player finishes a Daily, the Reveal shows only the player's own stats. There is no way to compare the result with other players. The `dailies` table holds every signed-in player's finished results, but only its owner can read a row, and no public total exists.

## Solution

A read-only database view returns, for each Daily category and day, the counts of on-day finished results. `Remote` gains a public read of one Daily's counts. A new block below the Reveal shows the number of players, the solve rate, and the guess distribution with the player's own bar highlighted. The block shows only after the player finishes the Daily, also on a reopened finished board. A signed-in player pushes pending changes first, so the just-finished result is counted. After a late play the block adds the note "Late play, not counted". The privacy page gains one sentence.

The Archive board (#191) is not built yet. The block is one component that takes the Daily's category, date, and record, so #191 mounts it on an Archive board with no change. Until then the Daily screen is the only place that shows it, and a late record reaches it only through a stored record.

## User Stories

1. As a player who finished a Daily, I want to see how many signed-in players finished it on-day, its solve rate, and its guess distribution (percent won in 1 to 6 tries, plus percent lost) (spec story 31).
2. As a player, I want my own result highlighted in the distribution (story 32).
3. As a player, I want the block only after I finish, so that it never hints at the answer, and again when I open the finished board later (story 33).
4. As a signed-out player, I want the block after I finish (story 34).
5. As a signed-in player, I want my on-day result counted in the block (story 35).
6. As a player, I want the player count always visible, even with one player or none (story 36).
7. As a player after a late play, I want the on-day totals with my result highlighted and the note "Late play, not counted" (story 37).
8. As a player, I want the privacy page to say that Daily results count, without names, in public per-Daily totals (story 38).

## Implementation Decisions

### Backend

- New migration `supabase/migrations/20261001000013_daily_global_stats.sql`, applied by the owner in the SQL editor after `20261001000012`. It creates view `public.daily_global_stats` with owner rights (`security_invoker = false`, like the leaderboard views, and the same header comment on why the Supabase linter's warning is intended). Columns: `category text`, `day date`, `players bigint`, `wins bigint`, `won_in_1` to `won_in_6 bigint`, `lost bigint`.
- Rows: from `public.dailies`, where `status in ('won', 'lost')`, `late is not true` (a null `late` counts as on-day), and `day <= public.server_utc_date()` (the server's UTC date, never the session time zone), grouped by `category, day`. `players` counts the rows. `wins` counts `status = 'won'`. `won_in_n` counts `status = 'won'` with `jsonb_array_length(guesses) = n`. `lost` counts `status = 'lost'`. A won row whose guess list has a length outside 1 to 6 (a client-reported value) counts in `players` and `wins` but in no `won_in_n`. The view needs no account join: `dailies` keeps one row per account, category, and day, so an account counts once per Daily.
- Grants: `revoke all` on the view from `public, anon, authenticated`, then `grant select` to `anon, authenticated`. Nothing else changes: `dailies` stays readable only by its owner. The view is computed on every read; there is no cache table and no minimum player count. Account deletion cascades its `dailies` rows, so a total can shrink; this is accepted.
- Existing test `supabase/tests/dailies-late.sql` drops the `late` column inside its transaction. The new view depends on that column, so Postgres would refuse the drop and fail the whole SQL suite. The test gains `drop view if exists public.daily_global_stats;` right after `begin;`; the rollback restores the view. This is the only change to that file.
- New SQL test `supabase/tests/daily-global-stats.sql`, same pattern as `leaderboards.sql` and `catalog-entries.sql` (psql only, run by `scripts/run-sql-tests.sh`, raises on failure, one transaction rolled back, leaves no rows behind). It is a top-level `begin` and `rollback` file (`catalog-entries.sql` is the precedent), not a `do` block. It creates throwaway `auth.users` rows (the seed trigger makes the account rows) and inserts `dailies` rows on a day far in the past (`2000-01-01`, so no real row shares it and a null `late` is allowed) and asserts, with the same assertions repeated in a loop over three session time zones (`UTC`, `Pacific/Kiritimati`, `Pacific/Pago_Pago`): counts per try from the guess list length; losses by status; `playing` rows not counted; a `late = true` row not counted; a `late` null row counted; a row dated after the server's UTC date (inserted with `late = false`) absent from the view; a won row with seven guesses counted in `players` and `wins` only; categories kept apart; the view readable by `anon` and `authenticated`, each with a positive count assertion (checked with `set local role`, then `reset role`), and `dailies` itself refused to `anon` (the check expects `insufficient_privilege` and resets the role before the next assertion).

### Remote

- `src/remote/remote.ts`: new type `DailyGlobalStats = { players: number; wins: number; losses: number; byTries: [number, number, number, number, number, number] }`, and `Remote.readDailyStats(category: DailyCategory, date: string): Promise<DailyGlobalStats>`, in the public-reads group (no sign-in needed).
- `src/remote/supabase.ts`: `readDailyStats` calls `restJson` on `daily_global_stats?select=*&category=eq.<category>&day=eq.<date>` with the anon key, with no Supabase client library (the spec's public-read rule). It returns zeros when no row matches. Numbers arrive as JSON numbers. A failed request rejects. Like the Leaderboards read, it has no 10-second timeout: the block shows its own loading state and one-line error, not the error panel.
- `src/test/fake-remote.ts`: the fake serves `dailyStats: Record<string, DailyGlobalStats>` keyed `category|date` (zeros when absent), records `dailyStatsCalls` and `pushesAtStatsRead` (how many pushes had completed when each read arrived; it is recorded, and the answer captured, before the gate, as `readLeaderboard` does), and gains `failDailyStats` and `holdDailyStats()`. The gate has its own variable, as `leaderboardGate` does: the call is recorded and the answer captured, then the gate is awaited, then `failDailyStats` throws. The new fields join the `FakeRemote` type and the initial object.

### The block

- New `src/ui/global-stats.tsx` exports `GlobalStats({ category, date, board })`. It reads `backend` from the route context (`remote` and `sync`); with no backend it renders nothing (a build without a backend never reaches a Daily). The hooks are called before that guard. Its state is `{ status: "loading" } | { status: "error" } | { status: "ready"; stats: DailyGlobalStats }`.
- On mount, and when `category` or `date` changes: it shows a loading state, awaits `sync.refresh()` (which pushes pending changes for a signed-in player and only reads the account for a signed-out one, as the Leaderboards tab does), then calls `remote.readDailyStats(category, date)`. A failed refresh is not an error (`refresh` never rejects). The effect depends on `remote`, `sync`, `category`, and `date` only, never on `board` (which `DailyBoard` replaces on each try), so a try does not push or read again. It follows the Leaderboards effect: a `current` flag cleared in the cleanup, the loading state set at the start, and one rejection handler for the refresh and the read. A result that arrives after the component unmounted or changed key is dropped.
- The component is mounted by the Daily board only when the record is finished (`won` or `lost`). It is never mounted for an unfinished Daily, so no read is made before the finish. It mounts with the Reveal after the finishing try, and again on a reopened finished board.
- Placement: `src/ui/daily-page.tsx` renders `<GlobalStats>` in `DailyBoard` right after `<DailyReveal>`, in the same `frozen && board` branch. `DailyReveal` does not change; the branch's single element becomes a fragment holding both.
- Content, in order: a heading "Global stats"; when `board.late === true`, the line "Late play, not counted"; a definition list with "Players" (the count, always shown) and "Solve rate" (`round(wins / players * 100)` followed by `%`, or `-` when there are no players); then a "Global distribution" list (the Reveal already has a "Guess distribution" label) with seven rows: 1 to 6, each with its bar and its percent of `players`, then "Lost" with its percent. A percent is `round(count / players * 100)`; with no players every percent is 0. The percents are rounded one by one and may not sum to 100; this is accepted. The rows are keyed by their label. A bar's width is its percent, with a small minimum so a zero row still shows its label, as the personal histogram does.
- Own result: the row of the player's result (the guess count for a won record, "Lost" for a lost one) is highlighted with the personal histogram's emerald color and has `aria-current="true"`. A won record with more than six guesses cannot occur on the board (six tries at most), so no other case needs a rule. A late play is highlighted too, although the counts do not include it.
- States: loading is a `role="status"` line "Loading global stats…"; an error is a `role="alert"` line "Could not load the global stats." with no retry button, like the Leaderboards tab. The Daily screen, the Reveal, and Share work in every state.

### Privacy page

- `public/privacy.html`, section "What is public": one added sentence, "Your Daily results also count, without your name, in public per-Daily totals: how many players finished a Daily and how many tries they needed." The "Last updated" date and its `datetime` change to October 2, 2026. `src/ui/privacy-page.test.ts` gains an assertion for the new sentence, and its two existing date assertions (`time[datetime="2026-09-30"]` and "Last updated: September 30, 2026") change to the new date.

## Testing Decisions

Tests assert behavior through the highest seam: what the player sees and the fake `Remote`'s recorded calls.

- `src/remote/supabase.test.ts` (reuse the fetch stub of the `readCurrentDailies` tests): `readDailyStats` requests the view with the category and day filters and the anon key and no library; maps a row; returns zeros for no row; rejects on a failed request.
- App-level (a new `src/ui/global-stats.test.tsx`, with `memoryStore` and the fake `Remote`, prior art `leaderboards.test.tsx` and `mixed-daily.test.tsx`):
  - signed out: finishing a Daily shows the block with the fixture's players, solve rate, and distribution percents, and the own bar has `aria-current`; a lost result highlights "Lost";
  - never before the finish: an unfinished Daily shows no block and `dailyStatsCalls` stays 0, also after some tries;
  - a reopened finished board (record in the store, mount the Daily) shows the block again;
  - signed in after a push: the stats read arrives after at least one completed push, and the fake's account rows hold the finished record at that read;
  - late note: a stored finished record with `late: true` shows "Late play, not counted" and the highlight; an on-day record shows no note;
  - zero players: shows "Players 0", a `-` solve rate, and the own highlight;
  - loading (held read) and the one-line error (failed read), with the Reveal and Share still present;
  - a read that resolves after the player left the screen is dropped (the app stays usable and the new screen shows no block).
- `privacy-page.test.ts`: the added sentence and date.
- SQL: `daily-global-stats.sql` as above.

## Out of Scope

- The Archive screen, its boards, and the block's mount on an Archive board (#191; the component already takes category, date, and record), and the puzzle number and share line (#190).
- A retry button on the block, a repeating refresh, a cache of the totals, and a minimum player count (spec "Out of Scope").
- Named rankings: the totals carry no names.
- The Playwright end-to-end check of the block (#193), and the Archive late-play stats test (#191).
- Running the migration on the live project (owner, release day).

## Further Notes

### Implementation reminders

- Before writing the migration, confirm with `ls supabase/migrations` that `20261001000012` is still the latest on `spec5`, and use the next number.

### Author calls (accepted by the owner through the coordinator, 2026-10-02)

- View name `daily_global_stats` with columns `players`, `wins`, `won_in_1` to `won_in_6`, `lost`, in migration `20261001000013`; the client reads one row per category and day and treats no row as zeros.
- A won row with a guess count outside 1 to 6 counts in `players` and `wins` only.
- `Remote.readDailyStats(category, date)` over plain REST with the anon key and no timeout.
- One `GlobalStats` component, mounted by the Daily board below the Reveal; it awaits `sync.refresh()` for every player before the read, as Leaderboards does.
- With no players: "Players 0", solve rate `-`, all percents 0.
- Percents are whole numbers rounded one by one.
- The own row is highlighted for a late play too; the note text is exactly "Late play, not counted".
- Privacy sentence in "What is public" and a new "Last updated" date.
- The block is a play-surface add-on with its own states; the Reveal does not change.
