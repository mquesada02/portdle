# Spec: Accounts, sync, and leaderboards (Spec 4)

Spec for the Backend effort that ADR 0001 deferred. Map: https://github.com/mquesada02/portdle/issues/114. Every decision below comes from the map's closed child tickets (#115 to #126); each ticket's resolution comment holds the full rationale.

## Problem Statement

A Portdle player's progress lives only in the browser they played in. Streaks, stats, Blitz runs, Bests, and the Codex stay on one device: a player who plays the Daily on a phone in the morning and on a laptop in the evening has two separate histories, two sets of streaks, and two Codexes, and clearing site data erases everything. A Blitz Best is also invisible to anyone else, so there is no way to see how a score compares with other players.

## Solution

Signing in stays optional. A player who never signs in plays exactly as today, with everything on the device.

A player who wants more signs in with Google or GitHub from a person icon in the top bar. On first sign-in they confirm the display name that other players will see, then everything already on the device joins their account. From then on, each device they sign in on keeps its own local copy and quietly exchanges changes with the account: after each thing they do, and whenever they open or come back to Portdle. Merging never loses progress: a Codex entry never goes down, a Best never goes down, a finished Daily beats an unfinished one, and stats and streaks are rebuilt from the merged Dailies. Sync never shows up in the UI; if it fails, play carries on and the next trigger tries again.

The Blitz screen gains a Leaderboards tab beside the arena. Anyone, signed in or not, can browse 18 leaderboards (one per Daily category, Orientation, and Blitz mode), each over three windows: All-time, Weekly (since Monday 00:00 UTC), and Today (since 00:00 UTC today). Each shows the top 100 players by their best score in that window (their best run played in it for Weekly and Today, their Best for All-time), faster time to score breaking ties, with the viewer's own row pinned below when they are outside the top 100.

From the same account menu a player can edit their display name, sign out (local data stays), or delete their account, which removes everything on the backend, their leaderboard rows included, and clears the device they deleted from.

## User Stories

### Playing without an account

1. As a player who never signs in, I want Daily, Blitz, History, and the Codex to work exactly as they do today, so that the backend costs me nothing.
2. As a player who never signs in, I want my data to stay only on my device, so that nothing about my play leaves my browser unless I choose to sign in.
3. As a player who never signs in, I want to browse the leaderboards, so that I can see how scores compare before deciding to sign in.
4. As a player on a build with no backend configured, I want the account menu and the Leaderboards tab to be absent, so that nothing on screen points at a service that is not there.

### Signing in

5. As a player, I want a person icon in the top bar, next to the How-to button and the theme toggle, so that I can find sign-in without it crowding the game.
6. As a player, I want to sign in with Google or GitHub, so that I can use an account I already have.
7. As a player, I want the Google button above the GitHub button, so that the order is the same every time.
8. As a player, I want signing in to return me to Portdle, so that I can carry on playing.
9. As a player with a GitHub account that has at least one verified email, I want sign-in to work even if I hide my email on GitHub, so that my GitHub privacy choices do not lock me out.
10. As a player who signs in with Google on one device and GitHub on another under the same verified email, I want both to reach the same account, so that my progress follows me.
11. As a player who signs in with Google and GitHub under different verified emails, I want each to remain its own account, so that no account is ever joined to one it does not own.

### Name confirm

12. As a player signing in for the first time, I want to see the display name Portdle will show on the leaderboards before it is public, so that my real name never appears without my knowing.
13. As a GitHub player signing in for the first time, I want my GitHub username filled in as my seeded display name, so that I can accept it in one tap.
14. As a Google player signing in for the first time, I want my Google account name filled in as my seeded display name, so that I can change it if I would rather not use my real name.
15. As a player whose provider name is too long or has characters Portdle does not allow, I want the seeded display name already normalized, so that I never see an error for a name I did not type.
16. As a player whose provider gives no usable name, I want the seeded display name to be "Player", so that the field is never empty.
17. As a player on the name confirm, I want to edit the seeded display name and see an inline error if my name breaks the rules, so that I fix it before continuing.
18. As a player, I want nothing about me on any leaderboard until I have confirmed my name, so that the name confirm is a real gate.
19. As a player, I want the name confirm to appear only once per account, so that later sign-ins go straight through.

### First sign-in import

20. As a player with local progress, I want everything on my device to join my account at first sign-in, so that I do not start over.
21. As a player signing in on a second device that already has its own local progress, I want both devices' progress merged into the account, so that nothing from either device is lost.
22. As a player, I want the import to follow the same merge rules as every later sync, so that the result does not depend on which device signed in first.
23. As a player signing in on a device whose local progress was last synced with a different account, I want to choose between adding this device's progress to my account and starting from my account only, so that someone else's progress never lands in my account or on the leaderboards under my name.

### Sync

24. As a signed-in player, I want each thing I do (a Daily try, a finished Blitz run, a Codex change, a preferences change) to reach my account shortly afterwards, so that my other devices see it.
25. As a signed-in player, I want changes from my other devices to arrive when I open Portdle or come back to its tab, so that I see my latest progress.
26. As a signed-in player, I want a sync to never interrupt what I am doing on screen, so that a Blitz run or a half-typed Daily try is never reset.
27. As a signed-in player who is offline or whose sync fails, I want play to carry on exactly as normal with no message, so that the backend never gets in my way.
28. As a signed-in player, I want a failed sync to be retried by my next action or my next return to the tab, so that I never need a retry button.
29. As a signed-in player, I want my Codex to keep the highest state any device reached for each entry, so that a Correct never goes back to Missed or Identified.
30. As a signed-in player, I want the Codex's fresh flags to stay on each device, so that opening the Codex on my phone does not use up my laptop's fresh-card pop (the one-time animation a newly seen Codex entry plays, from Spec 3) before I have seen it there.
31. As a signed-in player, I want my Best for each Daily category, Orientation, and Blitz mode to be the highest score any device reached, with the faster time to score winning a tie, so that a Best never goes down.
32. As a signed-in player, I want my Blitz runs from every device combined, keeping the newest 50, so that my run history is complete but bounded like today.
33. As a signed-in player who played the same Daily on two devices, I want the finished Daily to beat the unfinished one, a win to beat a loss, and fewer tries to beat more, so that the account keeps my best result for that day.
34. As a signed-in player who has the same Daily unfinished on two devices, I want the one with more tries committed to win, so that the more advanced Daily survives.
35. As a signed-in player, I want my stats and streaks rebuilt from my merged Dailies, so that they never double-count a day or invent a streak.
36. As a signed-in player, I want my theme, my How-to seen flag, and my Codex sort to follow me, each preference on its own, so that changing one on one device never undoes a newer change of another.

### Time to score

37. As a Blitz player, I want each run to record how long it took to reach its final score, so that equal scores can be ranked fairly.
38. As a Blitz player, I want a tie with my current Best at a faster time to score to become my new Best, so that improving my speed counts.
39. As a Blitz player with runs from before this change, I want those runs and Bests to keep working without a time, so that nothing old is lost.

### Leaderboards

40. As a player, I want a Play and a Leaderboards tab at the top of the Blitz screen, so that leaderboards sit next to my Bests without a fifth nav item.
41. As a player, I want the Play tab to be the arena exactly as it is now, so that starting a run is as quick as now.
42. As a player, I want to pick a leaderboard by window (All-time, Weekly, Today), Daily category, Orientation, and Blitz mode with rows of pill buttons, so that every one of the 18 leaderboards in each window is one tap away.
43. As a player, I want each leaderboard to list the top 100 players with rank, display name, and score, so that I can see who leads.
44. As a player, I want equal scores ordered by faster time to score, so that ties are broken fairly.
45. As a signed-in player outside the top 100, I want my own row pinned below the list with my rank, so that I always see where I stand.
46. As a signed-in player inside the top 100, I want my row marked as mine, so that I can find it.
47. As a player, I want the Weekly window to rank each player's best run played since Monday 00:00 UTC, and the Today window their best run played since 00:00 UTC today, so that each window starts fresh.
48. As a player, I want the All-time window to rank each player's Best, so that a long-standing Best still counts.
49. As a player, I want a player to appear on a leaderboard only once they have a run for it inside that window with a score above zero (for All-time, a Best above zero also counts), so that empty rows never pad the list.
50. As a player, I want the leaderboard to show a plain message when it cannot load, so that I know the empty list is not the real leaderboard.
51. As a player, I want an empty leaderboard to say nobody has played it yet, so that an empty list is not mistaken for a failure.

### Account menu

52. As a signed-in player, I want the person icon to open a menu showing my display name, so that I know which account I am on.
53. As a signed-in player, I want to edit my display name in place with a pencil, so that renaming is quick.
54. As a signed-in player typing a new name, I want an inline error and a disabled save when it breaks the rules, so that the app never silently changes what I typed.
55. As a signed-in player, I want my new name on the leaderboards the next time they load, so that renaming takes effect everywhere.
56. As a signed-in player, I want to sign out from the menu and keep everything on this device, so that I can keep playing unsynced and sign back in later.

### Display name rules

57. As a player, I want display names of 1 to 30 characters with at least one letter or digit, so that every leaderboard row has a readable name that fits a phone.
58. As an international player, I want letters in any script allowed, plus digits, spaces, apostrophes, hyphens, and periods, so that my real name is allowed.
59. As a player reading a leaderboard, I want emoji and control characters rejected, so that no row breaks the layout or hides invisible text.
60. As a player reading a leaderboard, I want the rules enforced by the backend too, so that nobody can bypass the app to publish an invalid name.

### Account deletion

61. As a signed-in player, I want a Delete account action in the account menu that asks me to confirm in a dialog, so that I cannot delete by accident.
62. As a player deleting my account, I want everything of mine on the backend removed, leaderboard rows included, so that nothing of me stays public.
63. As a player deleting my account, I want this device's local data cleared too, so that deleting my account clears everything on the device I asked from, not just the backend.
64. As a player with another device still signed in to a deleted account, I want that device to sign itself out on its next sync and keep its local data, so that it becomes an ordinary signed-out device.

### Privacy

65. As a signed-in player, I want my Codex, runs, Bests, Dailies, and preferences readable only by me, so that only my leaderboard rows are public.
66. As a player on a shared device, I want signing out to leave local data in place, so that signing out never destroys progress.

### Operations

67. As the owner, I want the backend to run on Supabase's free tier with no servers or Edge Functions to run, so that Portdle costs nothing.
68. As the owner, I want a daily ping to keep the free project from pausing after a week without activity, so that players never meet a paused backend.
69. As the owner, I want that ping to be unable to fail the Daily freeze, so that the schedule keeps freezing even when the backend is down.
70. As the owner, I want the database schema, row-level security policies, display name rule, and delete function kept as SQL in the repo, so that the backend can be rebuilt from source.

## Implementation Decisions

### Architecture

- **Supabase, free tier** (#120): Supabase Auth for sign-in, Postgres with row-level security for data, and its REST API for access. No Edge Functions and no server of our own: every server-side rule is declarative SQL (tables, row-level security policies, CHECK constraints, triggers, views, and one SQL function for deletion).
- **localStorage stays the local store** (#120). Supabase ships no offline client cache, so the device's own data remains the source every screen reads, and sync layers on top of it. This amends ADR 0001, which assumed the backend would bring its own client cache and that the storage seam would turn async: the storage seam (`Persist` over a `KeyValueStore`) stays synchronous, every existing read and write stays where it is, and there is no second migration. `Persist` gains only what sync needs: reading and writing the sync bookkeeping keys (including the id of the account this device last synced with), listing the dates that have a stored Daily for a category, and clearing every Portdle key (for account deletion and for the device progress choice "Start from your account only"). Clearing needs key removal and key listing, so `KeyValueStore` and `memoryStore` gain both. A new ADR records this.
- **One new seam, `Remote`.** Everything that talks to the backend goes through one interface, injected into the app beside `Persist`. It covers: the current sign-in state (signed out, or an account id with its display name and whether the name is confirmed), starting a Google or GitHub sign-in, signing out, confirming and changing the display name, pulling the account's synced rows, pushing changed rows, reading one leaderboard page with the viewer's own row, and deleting the account. The app ships one implementation, a Supabase adapter; tests use an in-memory fake, the same way `memoryStore` fakes localStorage.
- **No `Remote`, no account features.** The Supabase URL and public anon key come from build-time configuration. When they are absent (local development without them, the test default), the app gets no `Remote`: the account menu and the Leaderboards tab are not rendered and local play is untouched.
- **Load the backend client lazily.** The Supabase client library loads only when needed (the page loads with a sign-in result or error in its URL after a provider redirect, the device holds a stored sign-in, the account menu opens, or the Leaderboards tab opens); the stored sign-in check reads the client's stored sign-in key directly, without loading the library, so a signed-out player who never opens either pays no bundle cost at startup.

### Sync module

- A new sync module owns sync and depends only on `Persist`, `Remote`, and an injected clock (which gives the current time as well as timers; `onAccount` reports every account read the module makes, and replays the latest to a late listener). It exposes: start (on app load, when the player is signed in), a pull again (when the tab becomes visible or regains focus), a notification that a local write happened (`Persist` calls a registered listener after each successful write, so no screen calls sync itself), sign-in completion, sign-out, and account deletion. It never touches React state.
- **Merge is a commutative join** (#117): every rule below is order-independent and idempotent, and lives in the merge engines, pure functions next to the existing Codex, stats, and Blitz engines.
  - **Codex**: per entry, the higher state wins (Identified < Missed < Correct). The `fresh` flag is never synced; merging keeps the local flag as it is, and an entry that first arrives from the account arrives not fresh.
  - **Bests**: per `category|orientation|mode` key, the higher score wins; on an equal score, the faster time to score wins; a Best without a time loses to an equal score with one; two equal scores without times are equal.
  - **Runs**: union by `endedAt`, keep the newest 50 by `endedAt`, stored newest first as the local list is today (so Last run stays the newest run).
  - **Daily** (per Daily category and UTC date): finished beats unfinished (status playing); between two finished, won beats lost; between two wins, fewer tries wins; between two unfinished, more tries wins; two losses always tie on tries (a loss uses all six); any exact tie, two losses included, breaks by comparing the guesses as text, so the result is deterministic.
  - **Preferences** (#122): theme, How-to seen flag, and Codex sort each sync, each merged on its own by last write wins, where recency is a per-preference server timestamp set by a database trigger, so recency is push time, not edit time.
  - **Stats, streaks, and last played** are never synced (#117). After every pull that changed any Daily, the sync module rebuilds each Daily category's stats and last played by folding the merged Dailies in date order with the same functions the Daily screen uses today, and writes them back through `Persist`. Before each finished Daily, the fold applies the same streak gap the Daily screen applies (a last played date before the previous day, or an unfinished previous day, resets the current streak); after the last Daily, it applies the streak gap up to the current UTC day (an unfinished Daily yesterday, or a last played date before yesterday, resets the current streak), so the result matches what the incremental updates plus the day-change gap give today.
  - **Last seen UTC day, the Codex `fresh` flags, and sync bookkeeping** are local only.
- **Push** (#123): after every local write through `Persist`, debounced by 1.5 seconds, the sync module pushes the rows that changed since the last successful push. It tracks changed rows in local bookkeeping keys, so a push is a set of row upserts, never a whole snapshot. Writes the sync module makes itself (pulls, the stats rebuild, the device clear) never count as local changes; only writes from the player's own actions mark a row as changed, and only when its synced value actually changes, so the Codex screen's fresh-flag clear (the fresh flag is not synced) marks nothing. Preferences are pushed only when they changed locally, so pushing one preference never stamps the others as newer. On a pull, a preference with a local change not yet pushed keeps its local value and is pushed next, which stamps it newest; a preference with no pending change takes the account's value.
- **Pull** (#123): on app open and whenever the tab becomes visible or regains focus (the same events the app already listens to for the UTC day), the sync module pulls the account's rows, merges them into the local store, and pushes back any row where the merged value differs from the account's copy. This read-merge-write-back loop is how two devices that pushed at the same time converge: neither device's local value ever goes down, so the next pull on either side repairs any row the other overwrote. A pull triggered by the tab becoming visible or regaining focus is skipped when the last successful pull finished less than 30 seconds ago (owner decision, 2026-09-30), or when a pull is already running, unless a row waits to be pushed; app open, sign-in completion, and the device progress choice always pull, and a failed pull does not count as a successful one.
- **Never disturb the screen** (#123, story 26): a pull writes merged data into the local store only. It does not remount routes or reset component state. Each screen shows merged data the next time it mounts (the next navigation or the next Daily switcher change). If a pull merged a finished Daily for the date on screen, the board shows it on the player's next submit, which does not count as a try, or on the next mount. Every write path must read the stored value at the moment it writes rather than a copy taken at mount, so a write made after a pull cannot overwrite merged data with a stale copy. The existing write paths re-read the store just before writing (the Blitz Best, Daily, and stats writes included), with one exception: the Codex screen clears the fresh flags by writing back the Codex it read at mount, and must re-read at write time instead. A preference write is not a read-then-merge like the Codex, Best, or Daily writes; it stores a new value the player picked (the theme toggle writes the opposite of the theme on screen), so it needs no re-read. Across devices, preferences still merge by last write wins, as above. New write paths keep the same pattern. Because a pull does not remount the shell, a theme pulled from the account shows the next time the shell mounts (the next app load, or a UTC day change, which already rebuilds the router).
- **Failures are silent** (#123): a failed push or pull is dropped with no UI and no retry loop; the next write or the next open, visibility, or focus (past the 30-second pull throttle, unless a row waits to be pushed) is the retry. There is no online/offline listener.
- **First sign-in** (#117, #124): after sign-in returns, if the account's display name is not confirmed, the app shows the name confirm first. Nothing is pushed until the name is confirmed. Once it is, the sync module runs a full pull, merge, and push of every local Codex, Best, run, and Daily row, plus each preference with a pending local change (on a device that never synced, every preference stored on it); this is the one-time import. Every later sign-in runs the same pull, merge, and push, so progress made while signed out reaches the account. A preference with no local change takes the account's value and is not pushed.
- **Another account's device** (owner decision during spec review): the device remembers the account it last synced with. When a different account signs in and the device holds any Daily, run, Best, or Codex row, the app asks first, before the name confirm and before anything is pushed: "Add this device's progress to your account" imports the device's Codex, Best, run, and Daily rows as above, but the account's preferences win, including over preference changes made on this device while signed out that were never pushed (those pending changes of the previous account are dropped when the player picks Add; the same account's own pending changes still follow the rule above); preferences are not progress; "Start from your account only" clears the device (every Portdle key, as account deletion does), pulls, and then remounts the app, so the screen, the theme, and the How-to dialog start from the pulled data with nothing left from the cleared device. This choice and account deletion are the only times sync or account handling remounts the app; a UTC day change still rebuilds the router, as it does today. A device that never synced with any account imports without asking. Both dialogs follow from stored state, not from the redirect: on every app load with a stored sign-in, a pending device progress choice shows first, then an unconfirmed name shows the name confirm, and nothing is pushed while either is pending.
- **Display name on other devices**: every pull also reads the sign-in state again, so the account menu shows a display name changed on another device after the next pull. App open makes exactly one such read: the account menu takes its first sign-in state from the sync module's read instead of reading the account itself (owner decision, 2026-09-30).
- **Account gone** (#124): when a pull or push reports that the account no longer exists, the device signs out as if the player had chosen sign out, keeping its local data. The Supabase adapter recognizes this when the auth service refuses the device's stored sign-in because its user no longer exists.

### Time to score

- A Blitz run records its **time to score**: the milliseconds from the run's start to the commit of the last correct answer that produced its final score; a run that scores zero stores zero. The Blitz engine takes the elapsed time from an injected monotonic clock, not from wall-clock time, and stores it on the run.
- A Best becomes a score plus an optional time to score, and a run's time to score is optional too. Stored Bests (a bare score) and runs from before this change read as having no time; no key is renamed and no data is migrated.
- A run replaces the stored Best when its score is higher, or equal with a faster time to score than a Best that has one, or equal to a Best that has no time (a new run always has a time, so this is the untimed-Best case of the merge rule). The end card's New best badge shows whenever a run with a score above zero replaces the stored Best, a faster tie included (owner decision during spec review).

### Backend schema

The SQL lives in the repo as ordered migration files and is applied to the Supabase project by the owner. Every private table references the account id with `on delete cascade`.

- **Account row**: one row per account holding the display name and whether it is confirmed. The display name is not unique. It has a `CHECK` constraint: 1 to 30 characters, at least one letter or digit, only Unicode letters, digits, spaces, apostrophes, hyphens, and periods (#125). Readable and writable only by the account it belongs to; the leaderboard views are the only public path to a confirmed player's display name.
- **Private synced tables**, one row per synced value, except preferences, which have one row per account: Codex entries (per entry id), Bests (per key, score and time to score), runs (per `endedAt`, with Daily category, Orientation, Blitz mode, score, time to score, why it ended, and its round log), Dailies (per category and date), and preferences (one row per account with a value and a trigger-maintained timestamp per preference). Row-level security allows only the owning account to read and write its rows (#119, #124): the backend checks that the writer owns the row, never whether a score is plausible. Runs are not pruned on the backend; a pull reads the newest 50.
- **Leaderboards are three read-only views**, one per window (All-time, Weekly, Today), not a table the client writes. Each view reads the runs and Bests tables with the rights of the role that defines it (so it can read private tables a visitor cannot), computes its window start from the current UTC time (Weekly from Monday 00:00 UTC, Today from 00:00 UTC today), and returns one row per player per key: that player's best run whose end time falls inside the window, with a rank column. Only runs and Bests with a score above zero count; a zero score never creates a row. Rank orders by score descending, then time to score ascending, rows without a time after rows with one at the same score, then a stable order. The All-time view also counts the player's Best for that key, so a Best still ranks when its run never reached the backend (the device's 50-run cap dropped it before that device first signed in). The views expose only account id, confirmed display name, key, score, time to score, and rank, for accounts whose name is confirmed; anonymous and signed-in visitors may read them. A leaderboard read asks one view for a key's rows with rank up to 100 and, when the viewer is signed in, the viewer's own row with its rank.
- **Account deletion** is one `SECURITY DEFINER` SQL function callable by a signed-in account, deleting that account's auth user; the cascades remove every private row and the account row, and the view then no longer shows the player (#124).
- **Auth configuration**: Google and GitHub providers enabled; the GitHub provider's `email_optional` left off, so a GitHub account with no verified email cannot sign in (#121); automatic linking by verified email left on, manual linking off (#121), so a Google and a GitHub sign-in under the same verified email become two linked identities (one per provider) of one account; the redirect allow-list holds the exact site URL, not a wildcard (#120), so sign-in always returns the player to the site's root, not to the screen where sign-in started.
- **Seeded display name** (#121, #125): a trigger on account creation inserts the account row, which takes the GitHub username or the Google account name from the provider's metadata, normalized: disallowed characters stripped, cut to 30 characters, "Player" if nothing is left. The account row's confirmed flag stays off until the player completes the name confirm (#124).

### UI

- **Top bar**: a person icon button joins How-to and the theme toggle (#126). It opens the account menu. Signed out: "Sign in with Google" above "Sign in with GitHub". Signed in: the display name with a pencil that turns it into an inline field with save and cancel, Sign out, and Delete account.
- **Account action failures**: when starting a sign-in, confirming or changing the display name, or deleting the account fails, the dialog or menu shows a one-line error, nothing changes, and the player can try again. The name confirm stays open with Continue available. When the page loads after a provider redirect that carries an error (the player denied consent, or a GitHub account has no verified email), the app stays signed out, opens the account menu with a one-line error, and removes the error from the address.
- **Device progress choice**: a confirm dialog in the app's native dialog pattern with the two choices above and no other way out; it cannot be dismissed with Escape or a backdrop click.
- **Name confirm**: a full-page takeover modal using the native dialog element (the same mechanism as the setup dialog and How-to, not their compact card size), with no Escape or backdrop-click dismissal, shown after a first sign-in and before anything is pushed. It says the name is public on leaderboards, shows the normalized display name in an editable field with the rules as helper text and an inline error, and has one Continue button and a Sign out link beneath it, which signs out as the account menu does (local data stays) and closes the dialog. It cannot be dismissed without confirming a valid name; signing out is the only other way out.
- **Delete account**: a confirm dialog in the same native pattern, stating that the account, its synced data, and its leaderboard rows are removed and this device is cleared. Confirming calls the delete function; only after it succeeds does the app drop the client library's stored sign-in, clear the local store, remount, and open a signed-out Daily, so nothing on screen can write the cleared data back. The app then starts fresh, as on a first visit: the theme follows the system and the How-to dialog opens.
- **Blitz screen**: a Play / Leaderboards tab control under the heading (#126), shown only while the arena is idle; it is hidden during a run and on the end card, so a player cannot leave a run mid-play. Play is the existing arena. Leaderboards has a picker of three rows of pill buttons (window; Daily category; Orientation and Blitz mode) and the list: rank, display name, and score per row, the viewer's own row marked "You", and when the viewer is outside the top 100 their row pinned at the bottom of the list. The list shows a loading state, an error line when the read fails, and an empty line when nobody has played that leaderboard in that window.
- The leaderboard pills and the Play / Leaderboards tabs reuse the existing pill and segmented control styles; motion follows Spec 3 (the tab change is a switcher change).
- The display name rule (length and character set) is shared by the inline edit's validation, the name confirm's validation, and the seeded display name's normalization, matching the database `CHECK`.

### Operations

- **Keep-alive** (#120): the Daily freeze workflow gains a separate job that sends one cheap read to the Supabase REST API with the public anon key; it does not depend on the freeze job and the freeze job does not depend on it, so neither can fail the other. The URL and key come from repository configuration.
- **Owner setup** (the owner does this by hand, once): create the Supabase project; create a Google OAuth client and a GitHub OAuth app and enter them in Supabase; set the redirect URL; apply the migrations; put the URL and anon key into the build and workflow configuration. The first ticket that needs the project hands the owner this checklist.

## Testing Decisions

- Good tests exercise behavior through the highest seam and assert what a player or the account sees, never internal calls: render `App` with `memoryStore` and the fake `Remote`, act as the player, and assert the screen, the local store's contents, and the fake account's rows.
- **Merge engines**: pure unit tests per synced kind, beside the existing Codex, stats, and Blitz engine tests: each rule, commutativity (merge a then b equals b then a), idempotence (merging twice equals once), and the tie cases. The stats fold is tested against the incremental Daily results for the same sequence of days, streak gaps included.
- **Sync module**: tested with `memoryStore`, the fake `Remote`, and a fake clock: push after a write (debounced), only changed rows pushed, preferences pushed per preference, pull on start and on visibility and focus (throttled to one pull per 30 seconds unless a row waits to be pushed), two devices (two stores, one fake account) converging after concurrent writes, failures silent and retried by the next trigger, the one-time import after the name confirm, nothing pushed before it, the device progress choice when a different account signs in (add, or clear, pull, and remount, after which a guess on the Daily that was on screen does not bring back the cleared guesses), a later sign-in pushing progress made while signed out, a sign-in with an unchanged old theme not overwriting a newer theme from the account, a pending local preference surviving a pull, a pulled value never pushed back as a local change, and sign-out on "account gone".
- **Blitz time to score**: engine tests with an injected monotonic clock; Best replacement on equal score with faster time; Bests from before this change without a time.
- **UI**: App-level tests with the fake `Remote` for the account menu (signed out, signed in, rename with inline error), the name confirm (seeded display name, normalized display name, cannot skip), delete (dialog, local store cleared only after the delete succeeds, a failed delete leaving everything in place), the Leaderboards tab (picker, top list, pinned own row, "You" marker, loading, error, empty), and the absence of both when no `Remote` is given. Prior art: the existing App-level suites for Blitz, History, and the Codex, and the `stubViewTransitions` fake for injected browser behavior.
- **Not in Vitest**: the Supabase adapter and the SQL (row-level security, the name `CHECK`, the leaderboard views, the delete function, the seed trigger). They are verified against the real project by a hand-run smoke script: sign in, write, read back from a second signed-in browser, read the leaderboard anonymously, try a row of another account and an invalid name and see both refused, delete, see everything gone.

## Out of Scope

- Friends, following, and any social feature.
- Paid or self-hosted infrastructure, Edge Functions, and any server of our own.
- Daily leaderboards (streaks or solve counts); only Blitz Bests are ranked.
- Email magic link, email and password, passkeys, and any provider other than Google and GitHub (#118).
- Manual account linking across different emails.
- Score validation, replay, rate limiting, and any "unverified" marker (#119).
- Profanity filtering, reserved names, and reporting or removing names in the app; the owner can edit rows in the Supabase dashboard.
- Any sync status indicator, sync error message, or retry button.
- Realtime subscriptions and polling.
- Provider avatars.
- Supporting GitHub accounts with no verified email.

## Further Notes

- Glossary: `CONTEXT.md` gains **Account**, **Sign-in**, **Linked identity**, **Sync**, **Preferences** (the theme, How-to seen flag, and Codex sort, each synced on its own), **Display name**, **Seeded display name**, **Normalized display name**, **Name confirm**, **Account menu**, **Account deletion**, **Leaderboard**, **Leaderboard window**, **Leaderboards tab**, and **Time to score**. "Leaderboard" is never shortened to "board", which stays the Daily's stack of rows. A **Leaderboard** is one Daily category, Orientation, and Blitz mode ranked across players, viewed in one **Leaderboard window** (All-time, Weekly, or Today); this narrows #116's proposed wording, which put the window inside the Leaderboard, so "18 leaderboards" and "18 in each window" agree. `CONTEXT.md` also updates three existing entries: the intro line (Portdle is no longer "no backend"), **Top bar** (it holds the person icon beside How-to and the theme toggle), and **Arena** (the Play tab of the Blitz screen). The Leaderboards tab is its own term, not a Segment: Segments stay History's Daily and Blitz views. `Remote`, the sync module, the merge engines, and the account row are implementation names local to this spec, not domain terms, so `CONTEXT.md` does not gain them.
- Author calls not covered by the map's tickets, listed so they can be overruled:
  - Build-time configuration decides whether the app has a `Remote`; without it the account menu and the Leaderboards tab are not rendered.
  - The Supabase client loads lazily (on a provider redirect back to the site, when the device holds a stored sign-in, on opening the account menu, or on opening the Leaderboards tab).
  - A pull never remounts the screen; merged data shows on the next mount, and every write reads the stored value at write time, so the Codex screen's fresh-flag clear, the one write that uses its mount-time copy today, changes to re-read.
  - Push tracks changed rows in local bookkeeping keys and upserts rows; a pull writes back any row whose merged value differs from the account's.
  - Leaderboards are three views (one per window) over the runs and Bests tables, not a separate table, and the backend keeps every run while pulls read the newest 50; the All-time window also counts the stored Best so an old Best still ranks.
  - The name confirm cannot be dismissed without a valid name except by signing out, and nothing is pushed before it.
  - After sign-in the app returns to the site's root URL (the redirect allow-list holds one exact URL).
  - A Codex entry that first arrives from the account arrives not fresh on this device.
  - The account row is readable only by its own account, like the other synced tables; the privacy ticket's list of private tables did not name it, and its "everything else synced is private" is read as covering them, so the leaderboard views are the only public path to a display name.
  - The leaderboard shows a loading state, an error line, and an empty line (stories 50 and 51); no ticket decided these. The silent-failure rule covers a signed-in player's own sync, not this public read.
  - The Play / Leaderboards tab change uses Spec 3's switcher motion, extending a type Spec 3 defined only for the Daily switcher and the History segments.
  - Two lost Dailies for the same date always tie on tries (a loss uses all six); #117 named text comparison only for two wins and two unfinished, and the spec applies it to two losses too.
  - The inline display name edit has save and cancel buttons.
  - The name confirm is built on the native dialog element like the app's other modals, sized full-page; #124 and #126 decided the takeover and the gate, not the element.
  - The leaderboard picker has three rows (window; Daily category; Orientation and Blitz mode together), as in the approved prototype's screenshots; #126 listed the four choices without fixing a row count.
  - The existing UTC-day helper whose name says "sync" (it keeps streaks right across a UTC day change) is unrelated to Sync and keeps its name; the new module is named so the two cannot be confused.
  - The keep-alive ping runs as its own workflow job, not a continue-on-error step in the freeze job.
  - Preferences are stored as one row per account with one trigger-maintained timestamp per preference, not one row or table per preference.
  - A theme pulled from the account applies the next time the shell mounts (next app load or UTC day change), not right after the pull; a Codex sort pulled from the account applies the next time the Codex screen mounts.
  - The leaderboard views also leave out accounts whose name is not confirmed, as a second safeguard beside "nothing is pushed before the name confirm"; no ticket decided this check.
  - The display name in the account menu is read again from the account on every pull, so a rename made on another device shows after the next pull, not live; #125 left this timing open. App open makes exactly one such read, shared with the account menu.
  - The device progress choice comes before the name confirm, counts only Daily, run, Best, and Codex rows as progress (preferences alone do not trigger it), and cannot be dismissed without choosing.
  - A failed account action (sign-in start, name confirm, rename, delete) shows a one-line error and changes nothing; the silent-failure rule covers only background sync.
  - After account deletion the app starts as on a first visit (system theme, How-to dialog opens), because clearing every Portdle key also clears the preferences and the How-to seen flag.
  - At the first sign-in of a device that never synced, all of its stored preferences count as local changes and are pushed, so they can replace the account's preferences, as the import does for other rows.
  - Opening the Leaderboards tab first pushes any pending changes, so the run just played shows.
  - The person icon stays available during a run; a sign-in redirect or an account deletion during a run loses the run, as a page refresh does today.
  - If the How-to dialog is open when the device progress choice or the name confirm opens, the new dialog shows above it.
  - The account row stores a confirmed flag: the seed trigger sets it off, and only a completed name confirm turns it on; the tickets decided the gate, not how it is stored.
  - The seeded display name is set by a database trigger when the account is created, not by app code after sign-in; #121 and #125 decided the seeded value and its normalization, not the mechanism.
  - The sync module takes an injected clock, so the push delay is deterministic in tests, as the Blitz engine already takes one.
  - The viewer's own leaderboard row is labeled "You", as in the approved prototype; story 46 only asks for it to be marked.
  - Stats and streaks are rebuilt right after any pull that changed a Daily, not later when a screen mounts; #117 decided the fold, not when it runs.
  - The push delay is 1.5 seconds, inside the one-to-two-second range #123 gave as an example.
  - A device learns its account is gone when the auth service refuses its stored sign-in because the user no longer exists; #124 left the detection to this spec.
  - Time to score is an optional field added to stored Bests and runs under their existing keys; no key is renamed and nothing is migrated, so older values read as having no time (#116 decided only that they fall back to a stable order).
  - Time to score uses a monotonic clock and is stored in milliseconds; a run that scores zero has a time of zero.
  - The SQL is applied by the owner from the repo's migration files; it is checked by a hand-run smoke script, not by CI.
  - The delete dialog returns the player to a signed-out Daily.
  - A Best or leaderboard row with no time to score loses an equal-score tie to one that has a time; two untimed Bests with equal scores merge as equal, and two untimed leaderboard rows with equal scores keep a stable order (#116 settled only ties between two untimed entries).
  - Glossary sources: Linked identity, Seeded display name, and Normalized display name come from the account identity and display-name moderation tickets; Account menu, Leaderboards tab, Preferences, and Time to score are added while writing this spec.
- Owner decision during spec review: when a different account signs in on a device that last synced with another account, the player chooses between adding the device's progress and starting from the account only.
- Owner decisions during spec review: the Play / Leaderboards tab control shows only on the idle arena, never during a run or on the end card; only runs and Bests with a score above zero create a leaderboard row.
- Owner decision (2026-09-29): a display name needs at least one letter or digit (marks-only names are invalid); ZWJ and ZWNJ stay rejected.
- Owner decision (2026-09-30): On 'Add this device's progress', the account's preferences win, including over preference changes made on this device while signed out that were never pushed. Those pending changes from the previous user are dropped when Add is picked; the pending-change rule (#137) still applies to the same account's own changes. Preferences are not progress, so only Codex, Best, run, and Daily rows are added. 'Start from your account only' already clears everything.
- Owner decision during spec review: the New best badge shows for every run that replaces the Best, including a tie at a faster time to score.
- Owner decision (2026-09-30), after reviewing a HAR capture of the live site: app open reads the account once (the sync module's read, shared with the account menu), and a focus or visibility pull is skipped when the last successful pull finished less than 30 seconds ago; app open, sign-in completion, and the device progress choice always pull, and a failed pull does not count. The implementation also lets a focus through while a row waits to be pushed and skips it while a pull runs, so the paired visibility and focus events of one tab return make one pull.
- Owner decision during spec review: the third leaderboard window is labeled Today, not Daily (#116 and the prototype said daily), so it never reads as the Daily puzzle or as the out-of-scope Daily leaderboards.
- Supersedes, in ADR 0001: "a later backend brings its own client cache" and "makes the seam async". localStorage stays the local store and the seam stays synchronous; a new ADR documents it. The ADR's "imports localStorage once" stands, as the first sign-in import.
- Primary sources: map #114 and its closed tickets #115 to #126; research on branch `research/managed-free-tier-backends` (`docs/research/managed-free-tier-backends.md`); UI prototype on branch `prototype/backend-ui`, commit `f76c9bb` (Variant A). Never merge either branch.
