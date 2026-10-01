# Portdle

Wordle-like daily game for network ports, plus a timed Blitz mode. Static SPA; the catalog and the Dailies come from a hosted backend, and signing in is optional and adds sync and leaderboards.

## Language

### Game

**Entry**:
One catalog row: a named service with one port number.
_Avoid_: Item, record, service row

**Catalog kind**:
Which group an entry belongs to: `protocol` or `application`.

**Daily category**:
A game surface a Daily is played on: `mixed`, `protocols`, or `applications`.
_Avoid_: Mode, game type, section

**Mixed**:
The union of both catalog kinds. Not its own catalog kind.

**Daily**:
One puzzle per UTC date per Daily category. Three Dailies exist per day.
_Avoid_: Puzzle of the day, challenge

**Puzzle number**:
The public number of a UTC day, shared by the three Daily categories. #1 is 2026-09-09.

**Blitz**:
The timed, lives-based practice mode. Separate from Daily.
_Avoid_: Speed run, practice, arcade

**Orientation**:
Which way a guess goes: `default` (name to port) or `inverted` (port to name).
_Avoid_: Direction, skill

**Blitz mode**:
The Blitz ruleset: `sprint` (1 min), `marathon` (5 min), or `survival` (lives only).

**Answer-eligible**:
An entry that may be a Daily target or a Blitz prompt.

**Miss-only**:
An entry used only to name a wrong guess. Never a target or a prompt.

**Try**:
One committed Daily guess, correct or miss. A Daily allows six.
_Avoid_: Attempt, turn, life

**Life**:
One of three Blitz allowances. A miss spends one.
_Avoid_: Try, heart (the icon, not the concept)

**Miss identification**:
The service name shown for a wrong port when that port exists in the current catalog.
_Avoid_: Hint, feedback

**Schedule**:
The rows in the backend saying which entry is the Daily on which UTC day.

**Streak**:
Consecutive UTC days with a won on-day Daily in one category.

**Late play**:
A Daily whose first try was committed after its day. It counts in the player's played, win percentage, and histogram, not in Streaks or Global stats.

**Best**:
The highest Blitz score stored for one category, orientation, and Blitz mode, with its optional time to score. At an equal score, the faster time to score replaces the Best.
_Avoid_: High score, record

**Source**:
A curated reference link for an entry, such as an RFC, the IANA registry, or vendor docs.
_Avoid_: Link, citation, reference

**Run**:
One Blitz play from Start to its end, by lives or by time.
_Avoid_: Game, session, attempt

**Prompt**:
The entry a Blitz round asks about, shown as its name in default orientation or its port in inverted.
_Avoid_: Question, target (reserve for the Daily), item

**Leaderboard**:
One Daily category, Orientation, and Blitz mode ranked across players. Never shortened to "board", which stays the Daily's stack of rows.
_Avoid_: Board, scoreboard, ranking

**Leaderboard window**:
The time span a Leaderboard is viewed in: All-time, Weekly (since Monday 00:00 UTC), or Today (since 00:00 UTC today). A Leaderboard is viewed in one window, so there are 18 Leaderboards in each window.
_Avoid_: Daily (reserved for the puzzle)

**Global stats**:
The per-Daily totals of on-day results of signed-in players, without names. Not the Stats histogram, which is personal.

**Time to score**:
The milliseconds from a run's start to the commit of the last correct answer that produced its final score; a run that scores zero records zero. Runs and Bests from before this change have none. Breaks ties between equal scores.

**Round**:
One prompt inside a run and the committed answer to it. An invalid guess does not make a round.
_Avoid_: Item, question, turn

**Wrong answer**:
What the player answered on a missed round: the typed port, or the picked entry in inverted orientation.
_Avoid_: Mistake, error, guess (reserve for the act)

**Play surface**:
A screen where a guess is committed: the Daily board, an Archive board, or a Blitz run. The arena, History, the Archive list, and the Codex are not play surfaces.
_Avoid_: Game screen, play area

**Encounter**:
A moment on a play surface that shows the player an entry's name and port together, feeding the Codex.
_Avoid_: Discovery, unlock, event

**Unseen**:
The Codex state of an entry the player has never encountered.
_Avoid_: Locked, hidden, unknown

**Seen**:
Any Codex state above Unseen: Identified, Missed, or Correct. Never a synonym for Identified alone.
_Avoid_: Discovered, unlocked, found

**Identified**:
The Codex state of an entry revealed only by a miss identification or a wrong inverted pick, never asked as a target or prompt.
_Avoid_: Seen, spotted, glimpsed

**Missed**:
The Codex state of an entry that was asked as a Daily target or Blitz prompt and not guessed.
_Avoid_: Failed, lost, wrong

**Correct**:
The Codex state of an entry the player has guessed right at least once. The highest state; never downgrades.
_Avoid_: Solved, caught, won

### Account

**Account**:
A player's optional sign-in identity on the backend, holding synced progress and one Display name.

**Sign-in**:
Entering an Account with Google or GitHub.

**Linked identity**:
One provider's sign-in attached to an Account. The same verified email under Google and GitHub gives two Linked identities of one Account; different emails give two Accounts.

**Sync**:
The quiet exchange of changes between a device's local copy and its Account. It pulls on app open and on return to the tab, and it never disturbs the screen.
_Avoid_: Save, backup

**Preferences**:
The theme, the How-to seen flag, and the Codex sort, each synced on its own.

**Display name**:
The name other players see on Leaderboards. 1 to 30 characters with at least one letter or digit; letters in any script, digits, spaces, apostrophes, hyphens, and periods.

**Seeded display name**:
The Display name an Account starts with, taken from the provider (the GitHub username or the Google account name) and normalized.

**Normalized display name**:
A provider name with disallowed characters stripped and cut to 30 characters, or "Player" if no letter or digit is left.
_Avoid_: Sanitized, validated (reserved for the player-typed reject path)

**Name confirm**:
The full-page step after a first Sign-in where the player confirms the Display name before it is public.
_Avoid_: Onboarding, welcome screen

**Account menu**:
The menu the person icon opens: the two Sign-in choices when signed out; name edit, Sign out, and Delete account when signed in.

**Account deletion**:
Removes the Account and everything of it on the backend, Leaderboard rows included, and clears the device the player deleted from.
_Avoid_: Sign out, log out, delete data

### Screen

**Shell**:
The persistent frame around every screen: top bar plus nav.
_Avoid_: Layout, chrome, frame

**Top bar**:
The strip at the top of the shell holding the wordmark, the How-to button, the theme toggle, and the person icon that opens the Account menu.
_Avoid_: Header, app bar

**Nav**:
The four-item navigation: Daily, Blitz, History, Codex. Renders as a tab bar on phone and as top-bar links on desktop.
_Avoid_: Menu, sidebar

**Tab bar**:
The phone rendering of the nav, fixed to the bottom of the viewport.
_Avoid_: Bottom nav, footer

**Daily switcher**:
The segmented control on the Daily screen that picks the Daily category.
_Avoid_: Category tabs, sub-nav

**Board**:
The stack of rows on the Daily screen: one per committed try, plus the active row while playing. Never more than six.
_Avoid_: Grid, game area

**Row**:
One horizontal line of the board. Holds one committed try or the active input.

**Tile**:
One cell of a committed row, showing a single digit with its result color.
_Avoid_: Box, square (reserve "square" for the share line emoji)

**Slot**:
One cell of the active row, an input for a single digit.
_Avoid_: Cell, field, box

**Mark**:
The per-digit result on a committed row: placed (right digit, right position), present (digit elsewhere in the port), or absent.
_Avoid_: Color, hint, status, green/yellow/gray (colors are how marks render, not what they are)

**Tracker strip**:
The display-only 0 to 9 row under the board showing each digit's best-known mark across all committed rows.
_Avoid_: Keyboard, keypad, digit bar

**Try counter**:
The `n / 6` readout above the board showing committed tries.
_Avoid_: Progress, attempts

**Miss popover**:
The small panel on a miss identification or a seen Codex card showing that entry's description and sources.
_Avoid_: Tooltip, hint card, hover card

**Reveal**:
The block shown after a Daily ends: port, transport, description.
_Avoid_: Solution, answer card

**Stats**:
The personal numbers for one Daily category: played, win percentage, streaks, histogram.
_Avoid_: Statistics, profile

**Share line**:
The spoiler-free text copied to the clipboard after a Daily ends.
_Avoid_: Result, share card

**How-to**:
The rules dialog, opened on first visit and from the top bar. The only help surface.
_Avoid_: Tutorial, onboarding, intro, Help page

**HUD**:
The Blitz run readout: lives, round number, score, remaining time.
_Avoid_: Status bar, scoreboard

**Search panel**:
The inline list of name matches under the inverted Blitz input.
_Avoid_: Dropdown, autocomplete, suggestions

**End card**:
The block shown when a Blitz run ends: why it ended, score, best, and the full round log.
_Avoid_: Results screen, game over, summary

**Arena**:
The Play tab of the Blitz screen at rest: the New run button, the last run, and the bests.
_Avoid_: Lobby, home, dashboard

**Setup dialog**:
The modal opened from the arena that picks Daily category, Orientation, and Blitz mode before a run.
_Avoid_: Settings, options, form

**Round log**:
The list of committed rounds: the last three under the input during a run, all of them on the end card, in the arena's last run, and in History.
_Avoid_: Feed, ticker, history (inside a run)

**History**:
The record screen: every Daily the player finished in one segment, every saved run in the other.
_Avoid_: Log, past games

**History switcher**:
The segmented control at the top of History that picks the Daily or Blitz segment.
_Avoid_: Tabs, filter

**Leaderboards tab**:
The tab beside Play on the Blitz screen that shows Leaderboards. Its own term, not a Segment: Segments stay History's Daily and Blitz views.

**Segment**:
One of the two records History shows: Daily or Blitz. Each has its own address.
_Avoid_: Tab, view, page

**Archive**:
The screen listing every past Daily, where a missed or unfinished one can be played.

**Codex**:
The personal collection screen listing every catalog entry as a card with its Codex state.
_Avoid_: Pokedex, collection, gallery, encyclopedia

**Codex card**:
One entry on the Codex screen: `???` while Unseen; name, port, transport, and state once encountered.
_Avoid_: Tile (reserved for the board), item

**Sort toggle**:
The Name | Port control on the Codex that orders cards within each catalog kind.
_Avoid_: Filter, view switch

**Error panel**:
The shared panel the Daily, the Archive, the Blitz Play tab, and the Codex show in place of their content while the catalog or the Schedule has not loaded. History never shows it.
