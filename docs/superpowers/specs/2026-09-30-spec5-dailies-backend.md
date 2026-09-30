# Spec: Dailies from the backend (Spec 5)

Spec for serving the Dailies and the catalog from the backend. Map: https://github.com/mquesada02/portdle/issues/169. Every decision below comes from the map's closed child tickets (#170 to #180); each ticket's resolution comment holds the full rationale. #176 was amended by #178; this spec follows the amended rule.

## Problem Statement

Every future Daily answer ships inside the site bundle. Anyone who opens the bundle can read the answers for weeks ahead (today `mixed` until 2026-11-12, `applications` until 2026-10-28, `protocols` until 2026-10-18). To change a Daily or fix a catalog entry, the owner must commit, wait for CI, and redeploy. And a Portdle Daily has none of what makes Wordle-style games social: no public puzzle number to share, no way to see how other players did on the same Daily, and no way to play a Daily that was missed.

## Solution

The Daily comes from the server, like Wordle. When Portdle opens, it loads the catalog and today's Dailies from the backend. The server decides what "today" is and never sends a future answer. The owner changes entries in the Supabase dashboard and runs the Schedule Action; no commit or redeploy is needed. Triggers in the database keep every past Daily as it was.

Every UTC day has one public puzzle number, #1 being 2026-09-09. The share line becomes `Portdle #22 · Mixed · 3/6`. After a player finishes a Daily, the Reveal shows how the signed-in players who finished it on-day did: the number of players, the solve rate, and the guess distribution, with the player's own result highlighted.

A new Archive screen lists every past Daily. A player can play a missed Daily late. A late play counts in the player's own totals, but not in streaks or in the global stats, and its share line ends with `· late`. History now lists only Dailies the player finished.

Portdle now needs the backend. Offline, with a paused project, or with no backend configured, the Daily, the Archive, Blitz, and the Codex show one shared error panel with a "Try again" button; History still shows saved results. A Daily already loaded keeps working if the network drops.

## User Stories

### Daily from the server

1. As a player, I want the Daily to come from the server, so that nobody can read future answers from the site.
2. As a player, I want "today" decided by the server's UTC date, not my device clock, so that a wrong device clock never shows me the wrong Daily or saves my tries under the wrong date.
3. As a player, I want my tries saved under the date the server gave me, so that my record matches everyone else's Daily.
4. As a player whose network drops while a Daily is loaded, I want to keep playing and finish it, so that a short outage does not end my game.
5. As a player who reloads while offline, even mid-game, I want the error panel and my saved tries kept on the device, so that they come back when the network returns.
6. As a player, I want the answers of every past Daily to stay what they were, so that my old results and shares stay true.
7. As a player who already played days that the old site showed, I want those days to keep their answers through the switch-over, so that my History stays true.
8. As a player, I want future answers that the old site exposed to be replaced, so that reading the old bundle gives nothing away.
9. As a player, I want Blitz to keep leaving today's three Daily answers out of its prompts, using the server's today, so that Blitz never spoils a Daily.

### Moving to the next day

10. As a player with Portdle open at UTC midnight, I want Portdle to ask the server for the new Daily, so that I do not need to reload.
11. As a player who comes back to the tab on a new UTC day, I want the new Daily, so that I never play a stale one.
12. As a player mid-Daily at UTC midnight, I want my board to stay on the Daily I started until I finish it or leave it, so that the rollover never takes my game away.
13. As a player who started a Daily on its day and finishes it after midnight, I want it to count as played on its day, so that a late-night game keeps my streak.
14. As a player mid-Blitz-run at UTC midnight, I want the run to carry on, so that the day change never resets a run.

### Error panel

15. As a player who is offline, I want each screen that needs the server to say "You're offline. Portdle needs a connection to load puzzles.", so that I know why nothing loads.
16. As a player online when the server does not answer, I want "Portdle's server isn't answering. Try again in a moment.", so that I know the problem is not my connection.
17. As a player on the error panel, I want a "Try again" button, so that I can retry when I choose.
18. As a player on the error panel, I want Portdle to retry when my connection comes back and when I return to the tab, so that it recovers without my help.
19. As a player on the error panel, I want the nav to stay, so that I can still reach History.
20. As a player offline, I want History to show my saved Dailies with number, date, category, and result, so that my record is still there; I want the entry name and port back once online.
21. As a signed-in player, I want sync to behave as it does today, with no new error messages, so that the panel speaks only about loading puzzles.

### Catalog from the server

22. As a player, I want Blitz and the Codex to load the catalog from the server, so that the owner's fixes reach me without a redeploy.
23. As a player, I want a retired entry never to be a Daily answer, a Blitz prompt, or a miss identification, so that a retired entry leaves play.
24. As a player who has seen a retired entry, I want it to stay in my Codex and to resolve in my History, so that nothing I earned disappears.
25. As a player who has never seen a retired entry, I want it hidden from my Codex, so that I am not asked to collect something I can no longer meet.

### Puzzle number and share

26. As a player, I want each UTC day to have one puzzle number shared by the three Daily categories, #1 being 2026-09-09, so that I can talk about "#22" with other players.
27. As a player, I want the puzzle number on the Daily screen, next to the date, so that I know which Daily I am playing.
28. As a player, I want the share line to read `Portdle #22 · Mixed · 3/6`, so that my share looks like other Wordle-style shares.
29. As a player who played late, I want my share line to end with `· late`, so that I do not pass off a late play as an on-day one.
30. As a player, I want the puzzle number on each History row and each Archive row, so that I can find a Daily by number.

### Global result stats

31. As a player who finished a Daily, I want to see how many signed-in players finished it on-day, its solve rate, and its guess distribution (percent won in 1 to 6 tries, plus percent lost), so that I can compare my result.
32. As a player, I want my own result highlighted in the distribution, so that I can find myself.
33. As a player, I want the global stats only after I finish, so that they never hint at the answer.
34. As a signed-out player, I want to see the global stats after I finish, so that I get the comparison without an account.
35. As a signed-in player, I want my on-day result (a Daily I started on its day) counted in the global stats, so that I am part of the total.
36. As a player, I want the player count always visible, so that I know how much a percentage is worth, even with one player.
37. As a player after a late play, I want the on-day global stats with my result highlighted and the note "Late play, not counted", so that I can compare without being counted.
38. As a player, I want the privacy page to say that Daily results count, without names, in public per-Daily totals, so that I know what is shared.

### Archive

39. As a player, I want an Archive screen listing every past Daily from #1 to yesterday in all three categories, with number and date and no answers, so that I can find Dailies I missed.
40. As a player, I want to reach the Archive from a link on the Daily screen and at the top of History's Daily segment, so that the nav stays at four items.
41. As a player, I want to play a past Daily from the Archive, so that I can catch up.
42. As a player, I want a finished Daily in the Archive to show its result and open its read-only finished board, so that I can look back at it.
43. As a player who started a Daily on its day and left it unfinished, I want to finish it from the Archive and have it count as on-day, so that finishing late does not punish a Daily I started in time.
44. As a player, I want a late play to count in Played, Win %, and the histogram of my stats, so that everything I played shows in my totals.
45. As a player, I want a late play never to extend or repair a streak, so that streaks mean "played on the day".
46. As a player, I want the Archive to show the error panel when the server cannot be reached, so that it never shows a partial list.

### History

47. As a player, I want History's Daily segment to list only Dailies I finished, with their answers, so that History is my record, not a list of spoilers.
48. As a player, I want a late play to appear in History after I finish it, so that my record is complete.

### Stats and streaks

49. As a player, I want my stats always rebuilt from my saved Dailies, so that they are never out of step with my record.
50. As a player with an unfinished on-day Daily, I want my current streak to count as broken until I win it, and to join the days around it again once I do, so that the streak reflects my record.
51. As a returning player after the update, I want my stats rebuilt from my saved Dailies on first load, so that the change of rules never double-counts a day.

### Switch-over of local data

52. As a returning player, I want my saved Dailies on or before the switch-over day kept and marked as on-day, so that nothing I played is lost.
53. As a player with an old tab left open past the switch-over, I want records that tab saved against the old future order discarded, so that no result points at the wrong answer.
54. As a signed-in player, I want the backend to reject such records too, so that a wrong answer never reaches my account or the global stats.
55. As a signed-in player, I want the `late` mark of each Daily to sync, so that every device agrees on which plays were late.
56. As a signed-in player who played the same Daily on two devices, one on its day and one late, I want the on-day mark to win, so that a Daily I started in time stays on-day.

### Owner

57. As the owner, I want to add, fix, retire, and re-flag entries in the Supabase dashboard, so that I change Dailies without a commit or a redeploy.
58. As the owner, I want every Daily to change only through the catalog and the Schedule Action, never by hand-picked days, so that the Schedule rules always hold.
59. As the owner, I want the database to reject any change to a Schedule row dated on or before the frozen-through day (today, or the switch-over day if later), so that a mistake in the dashboard cannot rewrite a past Daily.
60. As the owner, I want the database to reject a change to the name or port of an entry that a past Daily used, so that old results and shares stay true.
61. As the owner, I want the database to reject deleting an entry, so that no History row or Codex card loses its entry.
62. As the owner, I want per-entry rules (port 0 to 65535, a known transport, a non-empty name) enforced by the database, so that the dashboard cannot store a broken entry.
63. As the owner, I want the Schedule Action to run every day at 00:05 UTC and on demand after a catalog edit, keeping seven days ahead, so that the Schedule never runs out.
64. As the owner, I want the Action to fail with no writes when the catalog breaks a whole-catalog rule, so that a bad edit never produces a bad Schedule.
65. As the owner, I want the Action to connect with a role that can only read the catalog and the Schedule and write the Schedule, so that a leaked Action secret cannot touch player data.
66. As the owner, I want future orders shuffled with a secret seed, so that the code alone cannot predict a future Daily.
67. As the owner, I want the keep-alive ping to stay, so that the free project does not pause.
68. As the owner, I want a short runbook for editing entries, running the Action, and fixing a real mistake in a past answer, so that I do not have to rediscover the steps.

### Development and tests

69. As a developer, I want `pnpm dev` to run against a local Supabase stack with the imported catalog and a Schedule filled through today + 7, so that I develop offline with the real rules.
70. As a developer, I want `pnpm dev` with no running stack to show the error panel, so that the server-only behavior is visible.
71. As a developer, I want CI to run the SQL tests on every PR against a local stack, so that a migration mistake fails the PR.
72. As a developer, I want a Playwright end-to-end suite in CI against the local stack, signed out and signed in, so that the real read and write paths are tested.
73. As a developer, I want CI to run the Schedule generator once with the dedicated role, so that the database write path is tested.

## Implementation Decisions

### Terms used in this spec

- **Switch-over day**: the UTC day the backend Schedule first goes live, fixed at release as one constant. Every artifact that holds it (the import migration, the `late` migration's delete and `CHECK`, the Schedule and entry triggers through the frozen-through day, and the client build) is generated from that one constant in the repository, and all of them are regenerated together if the release moves. Every Daily on or before it keeps the answer the committed schedule gave it.
- **Server's UTC date**: every database rule that depends on the day (row-level security, triggers, the current Dailies function, the global stats view) computes it as the current time at time zone UTC, cast to a date, never from the session time zone.
- **Server today**: the UTC date the server returns with the current Dailies. It is the only "today" the client uses for Dailies.
- **Frozen through**: the later of the server's UTC date and the switch-over day. No Schedule row dated on or before it can change or go away. It matters on the local stack and in CI, where the current date is before the switch-over day and the imported rows lie in the future; on the live project it equals the server's UTC date, since the migrations are applied on the switch-over day.

### Architecture

- **Server only** (#169, #172): the catalog and the Schedule live in Postgres on the existing Supabase project. The client has no bundled catalog, no bundled Schedule, and no stored copy of either (it keeps them in memory only). The catalog JSON files and the committed schedule files leave the repository in the same ticket that generates the import migration from them, after it does so. Spec 4's constraints stay: free tier, managed, no servers of our own, no Edge Functions, GitHub Pages frontend, sign-in optional.
- **Wordle model** (#171): the client receives today's answer when the Daily loads, checks guesses, computes marks, names misses, and shows the reveal as today. There is no per-guess server check.
- **`Remote` gains the public reads**: loading the catalog, loading the current Dailies (server today plus the three entry ids), loading past Schedule rows, and reading one Daily's global stats. These reads need no sign-in. The current-Dailies read is a POST call to the function, so no browser or proxy cache can return a stale server today. The Supabase adapter serves them with plain REST calls and the public anon key, without the Supabase client library, which stays lazy for sign-in, sync, and the Leaderboards tab as Spec 4 decided (owner decision in spec review). The fake `Remote` in tests serves them from fixtures.
- **No backend configured**: a build without the Supabase URL and anon key still gets no account features (account menu and Leaderboards tab hidden, as in Spec 4), and every catalog read fails, so the catalog screens show the error panel.
- **A new ADR, 0003**, records that the Daily, the Archive, Blitz, and the Codex depend on the backend; that offline Blitz and Codex are dropped; that the site no longer works with no backend; and which statements of Spec 4 and ADRs 0001 and 0002 it supersedes (see Further Notes).

### Backend schema

The SQL lives as ordered migration files. The owner applies them to the live project by hand, as in Spec 4.

- **Entries table** (#172, #177): one row per catalog entry, with the fields a catalog entry has today (id, catalog kind, name, aliases, port, transport, description, blurb, answer-eligible, retired, sources). The id is permanent. `CHECK` constraints: port 0 to 65535, transport one of the known values, catalog kind one of the known values, non-empty name. `anon` and `authenticated` may read; the migration explicitly revokes Supabase's default insert, update, and delete privileges from them, so nobody writes except the owner's dashboard roles. A trigger rejects every delete, for any role. A second trigger rejects a change to `name` or `port` of an entry that a Schedule row dated on or before the frozen-through day uses. `retired`, `answer-eligible`, and text fields stay editable on every entry.
- **Schedule table** (#173, #177): one row per Daily category and UTC day, holding the entry id (a foreign key to the entries table) and the start day of the cycle the row belongs to, so the generator can rebuild cycles exactly. Row-level security lets `anon` and `authenticated` read only rows dated on or before the server's UTC date; a separate policy lets the generator role read every row. Triggers reject any insert, update, or delete by a role other than the generator's role, and any update or delete of a row dated on or before the frozen-through day, whatever the role. The migration revokes Supabase's default write privileges from `anon` and `authenticated`. An insert of a past day that has no row yet is allowed (owner decision in spec review): the primary key stops it from replacing a row, and no player can have played a day that had no row.
- **Current Dailies function**: one SQL function returns the server's current time, its UTC date, and the three Schedule rows for that date. `anon` and `authenticated` may execute it. The client asks for the current Dailies through it and never computes "today" itself. When a category has no row for that date (the Action has not run for more than seven days), the read counts as failed and the client shows the error panel's server message until the next Action run fills the day.
- **One-time import migration**: inserts the whole catalog and every Schedule row from 2026-09-09 through the switch-over day, taken from the committed files: each cycle's day index from the epoch becomes a date, and each row stores its cycle's start day. It runs before the migration that creates the Schedule and entry triggers, so the triggers need no exception. If the release moves to another day, it is regenerated with the other switch-over artifacts before the owner applies it.
- **Generator role** (#173): a migration creates a Postgres login role that can read the entries and the Schedule and write the Schedule, and nothing else: select on both tables, and insert, update, and delete on the Schedule, with row-level security policies for the role on every command. The Schedule triggers identify it by `current_user`, so their trigger functions run as `SECURITY INVOKER`. The migration creates the role with no password, so no secret is in the repository. The owner sets the live password by hand in the SQL editor and stores it only as a repository secret; the dev and CI setup step sets a fixed local password on the local stack. UNVERIFIED: Supabase's connection pooler accepts a custom login role on the Free plan (user `role.projectref`). The Action connects through the pooler in session mode (port 5432), because GitHub runners reach the database only over IPv4 and the generator writes in one transaction; the owner's check uses that mode. The first ticket that creates the role hands the owner a check, before any later ticket builds on the role; if the check fails, the question goes back to the owner and the tickets that depend on the role wait. There is no fallback to the service key.
- **`dailies.late`** (#176, #178, #179): a boolean column with no default. The migration deletes existing rows dated after the switch-over day (applied on the switch-over day, such rows can only come from a wrong device clock and point at the old order) and sets `false` on the rest. The owner applies it on the switch-over day, never earlier. A `CHECK` rejects a row with a null `late` dated after the switch-over day. A null `late` on or before the switch-over day reads as on-day everywhere.
- **Global stats view** (#175, #176): one read-only view with owner rights over `dailies`, readable by `anon` and `authenticated`, like the leaderboard views. For each Daily category and day it returns the number of players who finished, the number of wins, the number of wins in each of 1 to 6 tries (the length of the guess list), and the number of losses (by status). It counts only finished rows (`won` or `lost`), only rows where `late is not true` (a null `late` counts as on-day), and only rows dated on or before the server's UTC date. It is computed on every read; there is no cache table and no minimum player count. The client computes the percentages. Each account counts once per Daily through the existing key. `late` is client-reported, like every result (#119).

### Schedule Action and generator

- **The Daily freeze workflow becomes the Schedule Action** (#173): it runs daily at 00:05 UTC and by hand. It connects to Postgres as the generator role, reads the catalog and the Schedule, runs the existing TypeScript generator, and writes the result. It no longer commits to the repository or starts CI, so it drops its repository write permissions and its CI trigger step. Its keep-alive job stays as it is; it never used `identity.json`. The repository is private, so GitHub's 60-day pause of scheduled workflows in inactive public repositories does not apply; if the repository becomes public, the Action needs another source of activity. A failed run relies on GitHub's failure email; the seven days of buffer give time to react.
- **Generator rules stay** (#173): A2 (freeze through today; a new or retired answer-eligible entry re-shuffles into the current cycle's future tail only), coverage through the frozen-through day + 7, and same-day distinctness across the three Daily categories. Stored rows are the source of truth: the generator rebuilds cycles from the stored rows and never changes a stored row dated on or before the frozen-through day. Each category's rows form one unbroken range of days from 2026-09-09, because the import is unbroken, no row on or before the frozen-through day can be deleted, and the generator always writes an unbroken range. For each category, the generator plans from the day after the earlier of its last stored day and the frozen-through day. Days up to the frozen-through day are missing days, and it inserts them; days after it replace the stored rows. It does all of this in one transaction. A2's "today" is the frozen-through day.
- **Whole-catalog rules** (#177): answer pool floors, the blurb and crowding rules, and the other catalog validation stay in the generator. An invalid catalog fails the run with no writes. Accepted gap: clients read the catalog directly, so an edit that breaks a whole-catalog rule reaches players before the Action fails.
- **Secret seed** (#171, #173): every shuffle the generator makes (new cycles and A2 tails) mixes in a secret kept as a repository secret, so the code alone cannot compute a future order. Losing the secret changes no stored answer.
- **Re-shuffle of the exposed future** (#171): the import stops at the switch-over day, so the first generator run after it fills the rest of each current cycle from the day after the switch-over day. It uses the cycle's unused entries from the current answer-eligible pool (A2's rule for added and retired entries), shuffled with the secret seed. Each cycle still uses each entry once. No special step is needed; after that, normal runs follow A2.
- **`identity.json` and its test are deleted** (#177); the triggers replace them.
- **Owner runbook** (#177): a short owner document explaining how to edit entries in the Table Editor, how to run the Action by hand (also the fix after a long Action outage, since it fills missing days), and how to disable and re-enable a trigger on purpose, as the SQL editor's table-owner role, to fix a real mistake in a past answer.

### Client: loading and "today"

- **App start**: the client loads the whole catalog and the current Dailies, both through `Remote`. The Daily, the Archive, and Blitz wait for both; the Codex waits only for the catalog. Until then they show a loading state; after a failed first read they show the error panel. A read that fails or does not answer within 10 seconds counts as failed.
- **Server today** (#171, #178): the client keeps the server today from the last current-Dailies read and uses it for the Daily date, the Archive range, the puzzle number, the stats fold (on the Daily screen and on Archive boards), Blitz's exclusion of today's answers, and the `late` mark. The device clock only schedules the midnight read.
- **New day detection** (#178): the client asks for the current Dailies again when the tab regains focus, with its own 30-second throttle that follows Spec 4's focus-pull rule (separate from the sync pull's throttle), and when a timer fires at the next UTC midnight. The client sets the timer after every successful read, replacing any pending timer, never adding a second one, for the time left until the next UTC midnight by the server's current time from that read (owner decision in spec review), so a wrong device clock does not move it. The server's answer always wins; the timer never decides the date.
- **No remount on a new day**: a change of server today no longer rebuilds the router. The device-clock day state and its focus and visibility listeners leave the app shell and stop being an input to router creation; server today reaches the screens through app state that the router does not depend on. Only this trigger goes; the remount used by the account flows (device progress choice, account deletion) stays. Each screen uses the new server today the next time it mounts, except as below. An Archive board open across midnight is unaffected, since it shows a past day. The sync module keeps its own focus and visibility listeners.
- **A Daily in progress at rollover** (#178): a Daily screen with at least one committed try that is not finished stays on its Daily until the player finishes or leaves it. A finished Daily's Reveal also stays until the player leaves. A Daily screen with no committed try moves to the new Daily at once. Leaving means another route or another Daily category; on return the Daily screen shows the new day, and the old Daily is in the Archive.
- **Retry** (#178): a retry reloads every read the screen needs: the catalog and the current Dailies, plus the past Schedule rows on the Archive. While the panel shows, a tab focus is a retry, not a focus read. It happens on the "Try again" button, on the browser `online` event, and on tab focus. The 30-second focus throttle counts only from the last successful read, so while the error panel shows, every focus retries. There is no retry timer.

### Error panel

- **One shared panel** (#178) inside each catalog screen (the Daily, the Archive, Blitz, and the Codex) in place of its content. The shell and the nav stay.
- **Only when nothing is loaded**: a catalog screen shows the panel only while a read it needs has not yet succeeded. The Daily, the Archive, and Blitz need the catalog and the current Dailies; the Codex needs only the catalog. The Archive also needs the past Schedule rows, so a failed past-rows read shows the panel on the Archive; History never shows the panel and shows rows without names instead. A failed focus, midnight, or retry read after a successful load changes nothing on screen; the loaded screens keep working (stories 4 and 12), and the next trigger tries again. The focus and midnight reads ask only for the current Dailies (#178); a retry, which runs only while the panel shows, reloads the catalog as well. A successful read replaces what it loaded; a screen already mounted keeps the data it mounted with and uses the new data on its next mount, except the Daily screen's rollover rule below.
- **Copy by cause**: when `navigator.onLine` is false, "You're offline. Portdle needs a connection to load puzzles."; otherwise "Portdle's server isn't answering. Try again in a moment." Both have a "Try again" button.
- **Blitz tabs** (owner decision in spec review): on Blitz the panel replaces only the Play tab's content. The Play / Leaderboards tabs stay, and the Leaderboards tab works as before with its own inline error.
- **Scope**: the panel covers only catalog and Schedule reads. Spec 4 sync stays silent, and the Leaderboards tab keeps its inline error.
- **History offline**: History shows saved Dailies with puzzle number, date, category, and result at once; entry name and port fill in when the catalog and past-rows reads succeed. History retries those reads on mount, on the `online` event, and on tab focus.

### Daily records, `late`, and stats

- **The `late` mark** (#176 as amended by #178, #179): a Daily record gains a `late` field. It is set when the first try is committed: `late` is true when the server today at that moment is after the Daily's day. It never changes after that. A Daily started on its day is on-day whenever it finishes. The client uses the last server today it received: a player offline past UTC midnight whose first try goes on the Daily still on screen gets an on-day mark, because the client cannot learn the new day (#178 accepted comparing against the last server today returned). A signed-out player's records keep their `late` mark locally, and it syncs at sign-in with the rest of the record.
- **Merge** (#117, extended): the existing Daily merge picks the record; `late` merges separately as "on-day wins" (late only if both sides are late, a null `late` counting as on-day), so the merge stays commutative and idempotent. The sync push and pull carry `late`.
- **Stats are never stored** (#178, #179): the stored `stats:*`, `lastPlayed:*`, and `lastSeenUtc` keys are removed, with every path that reads or writes them: the day-change streak gap run by the shell, the Daily screen's step-by-step stats and last-seen writes on a finish, the sync module's stats rebuild after a pull, and their `Persist` accessors. Every screen that shows stats folds them from the Daily records with server today. The device clock no longer gives "today" to the app shell. The sync module no longer needs a "today" at all, because its only use was the stats rebuild. Stats show only with the Reveal, which exists only after a successful current-Dailies read, so no screen needs server today before that read. History needs none either: it lists finished records by their own dates.
- **Fold rules**: a finished record adds to Played, wins, and the histogram whether late or not. Only on-day records count for streaks: the streak logic ignores every late record, finished or not, so a late record never extends, repairs, or breaks a streak, and a day with only a late record is a gap. A Daily started on its day and finished after midnight keeps `late: false`, so it counts for streaks. These rules replace the current streak-gap function; they do not extend it. An unfinished on-day record dated before server today breaks the current streak until it is won; today's unfinished Daily does not break it, as today.
- **Local switch-over** (#179): at every app start, the client removes the stored stats keys if present, sets `late: false` on any local Daily record dated on or before the switch-over day that has no `late`, and deletes any local Daily record dated after the switch-over day that has no `late` (with any pending push bookkeeping for it). The step is idempotent, so it needs no version marker. Local keys keep the `portdle:v1` prefix.
- **Old tabs** (#179): an old tab left open past the switch-over pushes `dailies` rows without `late`; the database rejects those dated after the switch-over day, which stops that tab's whole push (its Codex, Best, and run rows included) until it reloads; the tab retries on each focus meanwhile. After reload, the new client discards the bad record and pushes the rest. This is an accepted cost.

### Puzzle number and share

- **Puzzle number** (#174): UTC days since 2026-09-09 plus one, computed from the date; no database column. Shown as `#` plus the plain number, no thousands separator (`#22`, `#1000`).
- **Where**: the Daily screen next to the date, each History row next to the date, and each Archive row.
- **Share line** (#174, #176): `Portdle #22 · Mixed · 3/6` (a loss keeps `X/6`), followed by the grid as today; a late play adds ` · late` after the tries.

### Global stats with the Reveal

- **When** (#175): only after the player finishes that Daily, below the Reveal on the Daily screen and on an Archive board, including when a finished board is opened again. A Daily the player has not finished shows no stats. A signed-out player sees them too.
- **What**: number of players, solve rate, and guess distribution (percent won in 1 to 6 tries, plus percent lost), with the bar of the player's own result highlighted, also after a late play that the counts do not include. After a late play, the note "Late play, not counted". Account deletion removes an account's rows, so past totals can shrink; this is accepted.
- **Read**: for a signed-in player, the global stats block first pushes pending changes, as opening the Leaderboards tab does, so the just-finished on-day result is counted. The block shows a loading state and a one-line error when the read fails, like the Leaderboards tab; it does not use the error panel.
- **Privacy page** (#175): gains one sentence saying Daily results also count, without names, in public per-Daily totals.

### Archive

- **A new Archive screen** (#176) at its own address (the Archive list, and one board address per Daily category and date), reached from a link on the Daily screen and a link at the top of History's Daily segment. The nav stays at four items; on Archive addresses the Daily nav item is the current one.
- **List**: every Daily from #1 (2026-09-09) to the day before server today that has a Schedule row, in all three categories, with puzzle number and date and no answer. A day with no row (after an Action outage, until the next run fills it) is not listed. A finished Daily shows its result.
- **Play**: choosing a Daily opens its board at its own address. An unplayed or unfinished Daily is playable; a finished one opens read-only with its Reveal. The board, reveal, share, and global stats behave as on the Daily screen, with the `late` rule above, keyed by the Daily's own date (its record, share line, stats, and puzzle number). The Archive board is a play surface.
- **Answers**: the Archive and History read past Schedule rows (today's included) through `Remote`; row-level security guarantees none is in the future. The read fetches page by page, ordered by day and then Daily category, until every row has arrived, as the Spec 4 sync pull does, because the REST API returns at most 1,000 rows per request and three categories pass that in under a year.

### History

- **Daily segment lists only finished Dailies** (#176), from the local records, newest first, each with puzzle number, date, category, result, and the entry name and port from the past Schedule rows and the catalog. Each row opens that Daily's read-only board at its Archive address.

### Catalog on the client

- **Retired entries** (#172): never a Daily answer, a Blitz prompt, or a miss identification; they still resolve in History and the Codex. The Codex hides retired entries the player has not seen and keeps seen ones.
- **Answers resolve by id in the whole catalog**: a Daily's answer (today's, a past one in History or the Archive) is found by its entry id among all entries, whatever the Daily category, catalog kind, or `retired` flag. #177 keeps catalog kind editable on a past answer, so a lookup limited to the category's catalog kind could lose a past answer.
- **Blitz** keeps leaving today's three Daily answers out of its prompts, using the current Dailies from the server.

### Development and CI

- **Local stack** (#180): `pnpm dev` uses the Supabase CLI local stack (`supabase start`, Docker), which applies the migrations (the import migration brings the catalog and the Schedule through the switch-over day) and a seed file. A dev setup step, part of the `pnpm dev` command, then runs the generator once as the generator role with a dev secret, which fills the Schedule from the switch-over day through today + 7. The dev data is never synced with the live project. The ticket that builds the local stack creates its configuration file; the configuration enables email and password sign-in with one seeded test user whose display name is already confirmed; the live project keeps it off. The app gains no email sign-in UI or method: a signed-in end-to-end test signs in by calling the local auth API directly and stores the returned session under the Supabase client's storage key before the app loads, so the app starts as a device with a stored sign-in. Nothing test-only ships in the production bundle.
- **CI** (#180): one job installs the Supabase CLI, starts the local stack, runs the generator once as the generator role (which fills the Schedule, as in dev), runs every SQL test file with `psql` and errors stopping the run, and runs the Playwright end-to-end suite against a build that uses the local stack's URL and anon key. The existing checks (lint, typecheck, unit tests, build) stay. The schedule `--check` step goes away with the committed schedule files. The owner still applies migrations to the live project by hand.
- **SQL test audit** (#180): every Spec 4 test file already raises on failure (`assert` or `raise exception`) and prints a notice only on success, so none needs a rewrite. `row-sync-cleanup.sql` is an owner cleanup script, not a test, and CI does not run it. New SQL tests follow the same pattern and leave no rows behind by rolling back or deleting only what the triggers allow (an entry can never be deleted). The existing tests insert `dailies` rows without `late` dated before the switch-over day, which the `CHECK` allows.

### Owner steps at release

The switch-over day is the release day. The owner does these by hand, in order, on that day and never earlier (the pooler check passed in the first ticket; if it did not, the release waits for the owner's answer): apply the new migrations to the live project; set the role's password; store the role's connection details and the secret seed as repository secrets; merge the release; run the Schedule Action once by hand, which fills the Schedule after the switch-over day with the secret seed. The ticket that ships the release hands the owner this checklist.

## Testing Decisions

- Good tests exercise behavior through the highest seam and assert what the player sees, the local store's contents, or the fake account's rows, never internal calls.
- **Engines (pure unit tests)**, beside the existing ones: the fold with late and on-day records (streak gaps, late records counting only in totals, an unfinished on-day record breaking the streak until won); the `late` merge (commutative, idempotent, on-day wins); the puzzle number; the share line (on-day, late, lost); the generator on stored rows (cycles rebuilt from rows, nothing on or before today rewritten, the secret seed changing the order, the first run after the import filling each cycle's tail with each entry once per cycle, missing past days inserted, whole-catalog failures writing nothing); the local switch-over step (keep and mark, discard, idempotent). Prior art: `merge.test.ts`, `stats.test.ts`, `share.test.ts`, `schedule-gen.test.ts`.
- **App-level tests** with `memoryStore` and the fake `Remote` serving catalog and Schedule fixtures: the Daily from the current Dailies read; the error panel (both messages, Try again, `online` and focus retries, a reload while offline mid-game, nav and History still reachable); a new server today on focus and at the midnight timer, with a Daily in progress staying and an untouched one moving; the Archive list, a late play, an on-day finish of an unfinished Daily, and the read-only finished board; History listing only finished Dailies and offline rows without names; global stats after finishing (signed out, signed in after a push, late note, loading and error); retired entries in the Codex and Blitz. Prior art: the existing App-level suites for the Daily, History, Blitz, and the Codex, and the fake `Remote` from Spec 4.
- **Sync tests**: `late` pushed and pulled, a pulled null `late` on or before the switch-over day read as on-day, and no stats written after a pull. Prior art: the Spec 4 sync module tests.
- **SQL tests** (new files, same pattern as Spec 4, run in CI): row-level security hiding future Schedule rows from `anon`; the current Dailies function; the Schedule triggers (past rows frozen for every role, writes only by the generator role); the entry triggers (no delete, frozen name and port of past answers, text fields still editable); the `CHECK` constraints; the `dailies.late` check; the global stats view (finished only, late skipped, future skipped, counts per try); the generator role's grants.
- **End-to-end (Playwright, local stack)** (#180): signed out, load and finish the Daily; the error panel and its recovery with the stack stopped; an Archive late play and its History row. Signed in (local email sign-in): `late` syncs; global stats appear after a finish. The midnight rollover is not in E2E, because server today comes from the database clock; unit tests cover it.

## Out of Scope

- Friends, following, and any social feature (carried over from Spec 4).
- Paid or self-hosted infrastructure, Edge Functions, and any server of our own; `pg_cron` and `pg_net` (their Free availability is unverified).
- A per-guess server check, any cache of answers or the catalog, and a bundled fallback.
- An admin screen; hand-picked future Dailies.
- Running the Schedule Action from a database event.
- Score validation, replay, and rate limiting; results stay client-reported (#119).
- Named per-player Daily rankings; global stats are totals without names.
- Realtime subscriptions and any repeating poll; the midnight read is one timer per day.
- A minimum player count for global stats.
- CI against the live project, and syncing the dev seed with the live project.
- Changes to Spec 4's sync error handling and the Leaderboards inline error.

## Further Notes

### Supersedes

- v1 design §3, "Playable archive" out of scope (`2026-09-08-portdle-design.md`, also the ticket specs of #10, #12, #14) → the Archive with late plays (#176).
- v1 design §3, "Global histograms" out of scope → the per-Daily global guess distribution (#175).
- Spec 4, "Email and password" out of scope → enabled only in the local stack for E2E (#180); the live project keeps it off.
- Spec 4, stories 1 and 27 and "No `Remote`, no account features" as far as they promise a site that works with no backend or offline play with no message → the Daily, the Archive, Blitz, and the Codex need the backend (#169, #172). Account features without a backend stay hidden.
- Spec 4, "a UTC day change still rebuilds the router" → a new server today no longer remounts screens, so a theme pulled from the account now applies only at the next app load.
- Spec 4, stats and last played stored and rebuilt after a pull → stats are never stored; every screen folds them.
- ADR 0001 and ADR 0002, as far as they assume the catalog and the Schedule come from the bundle and the game works offline → ADR 0003. Their rule that player state lives in localStorage stays.

### Boundaries with earlier out-of-scope items (not superseded)

- Spec 4, "Any sync status indicator, sync error message, or retry button": the error panel and "Try again" cover only catalog and Schedule reads; sync errors stay silent.
- Spec 4, "There is no online/offline listener" (sync): sync still has none; the new `online` listener only retries the catalog and Schedule reads behind the error panel.
- Spec 4, "Realtime subscriptions and polling": retries happen only on focus and `online`, plus one read at UTC midnight; there is no repeating timer.
- Spec 4, "Daily leaderboards (streaks or solve counts)": global stats are totals without names, not a ranking of players.
- Spec 4, "Score validation, replay, rate limiting": global stats count client-reported results.
- Spec 4, "Edge Functions, and any server of our own": the Schedule runs in a GitHub Action.
- v1 design, "Changing a frozen-prefix entry's `name` or `port`": still forbidden, now enforced by a trigger instead of `identity.json`.

### Glossary

`CONTEXT.md` changes with this spec:

- Adds **Puzzle number** (one number per UTC day shared by the three Daily categories, #1 = 2026-09-09), **Archive** (the screen listing every past Daily, where a missed or unfinished one can be played), **Late play** (a Daily whose first try was committed after its day; it counts in personal totals, not in streaks or global stats), **Global stats** (the per-Daily totals of on-day results of signed-in players, without names), and **Error panel** (the shared panel a catalog screen shows when the catalog or the Schedule cannot be loaded).
- Changes **Streak** to "consecutive UTC days with a won on-day Daily in one category", and **Play surface** to include the Archive board. Global stats' guess distribution is a separate term from the personal Stats histogram.
- Changes **History** to "every Daily the player finished in one segment, every saved run in the other", and moves "archive" from its _Avoid_ list to its own term.
- Changes **Schedule** to "the rows in the backend saying which entry is the Daily on which UTC day", and **Catalog kind** to no longer name a JSON file.
- Changes the intro line: the catalog and the Dailies come from the hosted backend; signing in stays optional.
- Switch-over day and server today are spec terms, not domain terms.

### Author calls accepted by the owner before writing (2026-09-30)

- The Schedule table has one row per Daily category and day, with the entry id and the cycle's start day.
- One SQL function returns server today and today's three rows; past rows come from a table read limited by row-level security; History and the Archive read all visible past rows in one read. (Refined in spec review: the read pages through the rows, 1,000 per request.)
- `late` merges across devices as "on-day wins", separately from the record choice.
- The one-time re-shuffle of the exposed future is a separate generator step run once at the switch-over. (Replaced in spec review: the first generator run after the import does it, because the generator now fills from the last stored row.)
- The Schedule triggers also reject inserts dated on or before server today. (Overturned by the owner in spec review: the generator may insert a missing past day; updates and deletes stay rejected.)
- With no backend configured, catalog screens show the error panel; account features stay hidden.
- The global stats view returns counts; the client computes percentages.
- The new ADR is 0003.
- The pooler check for the generator role is an owner step in the first ticket that creates the role.
- `lastSeenUtc` and the day-change streak gap are removed (confirmed against the code: their only use is the step-by-step stats).
- The SQL test audit found no test to rewrite; CI stops on the first error and skips the cleanup script.

### Author calls made while writing (accepted by the owner at the spec gate, 2026-09-30)

- App start loads the catalog and the current Dailies in parallel; catalog screens show a loading state until both arrive.
- A new server today no longer rebuilds the router; a Daily screen with no committed try moves to the new Daily at once, and a finished Daily's Reveal stays until the player leaves.
- A Blitz run in progress at UTC midnight carries on (story 14): no remount, and it keeps the answers it excluded at its start.
- Schedule rows are frozen through the later of server today and the switch-over day, so the imported rows stay safe on the local stack and in CI, where the current date is before the switch-over day.
- The `late` migration deletes existing `dailies` rows dated after the switch-over day.
- The global stats view is readable before a player finishes; only the client waits until the finish. Accepted, like the answer being readable in developer tools (#171).
- A day with a missing Schedule row shows the error panel's server message.
- A failed background re-read keeps the loaded screens; the error panel shows only while nothing is loaded. A mounted screen keeps the data it mounted with.
- The seed file holds only the local test user; the catalog and the Schedule come from the import migration and a generator run.
- The generator replaces every Schedule row after the frozen-through day, and inserts any missing earlier day, in one transaction.
- The local switch-over step runs at every app start and is idempotent, with no version marker; it also drops pending push bookkeeping for discarded records.
- The global stats block uses a loading state and a one-line error like the Leaderboards tab, not the error panel; for a signed-in player it pushes pending changes before reading.
- The Archive board has its own address per Daily category and date.
- "Global stats" and "Error panel" join the glossary.
- The owner's release steps are one checklist handed over by the release ticket.
- Reading today's answer in the browser developer tools stays accepted (#171).
- The generator role also reads the Schedule, which it needs to rebuild cycles (#173 named only catalog reads).
- The entries table also checks catalog kind (#177 listed port, transport, and name).
- The glossary also changes Schedule, Catalog kind, Streak, Play surface, and the intro line.
- The current-Dailies focus read has its own 30-second throttle; it counts only from the last successful read, so every focus retries while the panel shows.
- The import migration is regenerated with the other switch-over artifacts if the release moves.
- A2's "today" and the coverage rule use the frozen-through day; the generator plans from the earlier of the last stored day and the frozen-through day; each category's rows stay one unbroken range.
- Today's unfinished Daily does not break the streak; late records are ignored by streaks entirely.
- A null `late` on or before the switch-over day reads as on-day in the view, the merge, and the fold.
- The catalog JSON files leave the repository, and CI drops the schedule `--check` step.
- Stats are never stored (Spec 4's stored stats superseded).
- The Archive hides a day with no Schedule row.
- History rows show names from the past rows, newest first, and link to the Archive board.
- The dev generator run uses a dev secret; CI stops on the first SQL error.
- Signed-in end-to-end tests store a session from the local auth API; no test-only code ships.
- The Codex waits only for the catalog; the Daily, the Archive, and Blitz also wait for the current Dailies.
- A read that fails or does not answer within 10 seconds counts as failed.
- On Archive addresses the Daily nav item is current.
- A no-backend build shows the server message ("Portdle's server isn't answering"), the second of #178's two messages.

### Primary sources

Map #169 and its closed tickets #170 to #180; research on branch `research/daily-serving` (`docs/research/daily-serving.md`). Never merge that branch.
