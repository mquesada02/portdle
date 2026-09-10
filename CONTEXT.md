# Portdle

Wordle-like daily game for network ports, plus a timed Blitz mode. Static SPA, no backend.

## Language

### Game

**Entry**:
One catalog row: a named service with one port number.
_Avoid_: Item, record, service row

**Catalog kind**:
Which JSON file an entry lives in: `protocol` or `application`.

**Daily category**:
A game surface a Daily is played on: `mixed`, `protocols`, or `applications`.
_Avoid_: Mode, game type, section

**Mixed**:
The union of both catalog kinds. Not its own catalog file.

**Daily**:
One puzzle per UTC date per Daily category. Three Dailies exist per day.
_Avoid_: Puzzle of the day, challenge

**Blitz**:
The timed, lives-based practice mode. Separate from Daily.
_Avoid_: Speed run, practice, arcade

**Orientation**:
Which way a guess goes: `default` (name to port) or `inverted` (port to name).
_Avoid_: Direction, skill

**Blitz mode**:
The Blitz ruleset: `sprint` (1 min), `marathon` (5 min), or `survival` (lives only).

**Answer-eligible**:
An entry that may be a Daily or Blitz target.

**Miss-only**:
An entry used only to name a wrong guess. Never a target.

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
Committed JSON saying which entry is the Daily on which UTC day.

**Streak**:
Consecutive UTC days with a won Daily in one category.

**Best**:
The highest Blitz score stored for one category, orientation, and Blitz mode.
_Avoid_: High score, record

**Source**:
A curated reference link for an entry, such as an RFC, the IANA registry, or vendor docs.
_Avoid_: Link, citation, reference

### Screen

**Shell**:
The persistent frame around every screen: top bar plus nav.
_Avoid_: Layout, chrome, frame

**Top bar**:
The strip at the top of the shell holding the wordmark and the theme toggle.
_Avoid_: Header, app bar

**Nav**:
The four-item navigation: Daily, Blitz, History, Help. Renders as a tab bar on phone and as top-bar links on desktop.
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

**Try counter**:
The `n / 6` readout above the board showing committed tries.
_Avoid_: Progress, attempts

**Miss popover**:
The small panel on a miss identification showing that entry's description and sources.
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
The first-visit rules dialog. Help shows the same rules as a page.
_Avoid_: Tutorial, onboarding, intro

**HUD**:
The Blitz run readout: lives, score, remaining time.
_Avoid_: Status bar, scoreboard

**Search panel**:
The inline list of name matches under the inverted Blitz input.
_Avoid_: Dropdown, autocomplete, suggestions

**End card**:
The block shown when a Blitz run ends: why it ended, score, best.
_Avoid_: Results screen, game over, summary
