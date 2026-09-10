# Spec: UI redesign

Spec for the UI redesign. Tracker: https://github.com/mquesada02/portdle/issues/22

## Problem Statement

A player who opens Portdle today sees raw, unstyled HTML on every screen. Nav is a row of underlined words. Buttons and inputs have no borders or backgrounds because the CSS reset strips them, so the port input on the Daily screen is invisible: the player clicks the decorative digit slots, nothing focuses, and they cannot type. How-to renders as a block of text at the bottom of the page instead of a dialog. Nothing signals correct versus miss, tries left, or where to look after a win. Blitz setup is three rows of bare radio buttons. History is one line per row. The game engine works, but the player cannot tell, and on a phone the layout is worse. The site is unusable.

## Solution

Portdle gets one responsive, Wordle-cousin design across every screen, built with the existing Tailwind setup and no UI kit. The shell has a top bar with the wordmark, a How-to button, and the theme toggle, plus a four-item nav (Daily, Blitz, History, Help) that renders as a bottom tab bar on phones and as top-bar links on wider screens. The Daily screen has a Daily switcher for Mixed, Protocols, and Applications, a board that grows one row per committed try under a `n / 6` try counter, and one input per digit so typing works everywhere. A miss that matches a catalog entry shows a miss popover with that entry's description and sources. Finishing a Daily draws a divider, fades in and lifts the reveal, stats, and Share, and scrolls to it. Blitz setup uses pill radio groups, the run shows a HUD with hearts, score, and a countdown, and the Search panel sits inline under the inverted search input. History groups rows by date. Help shows the rules as a page. Motion is minimal and respects reduced motion. Engine, persistence, routes, and game rules do not change. The prototype that settled the look lives on branch `prototype/ui` at commit `fd70684`.

## User Stories

### Shell and navigation

1. As a player, I want a top bar with the Portdle wordmark, so that I always know what site I am on and can return to the Daily with one tap.
2. As a player, I want the top bar to stay visible while I scroll, so that the theme toggle and How-to button are always reachable.
3. As a player, I want a nav with exactly four items, Daily, Blitz, History, and Help, so that the main surfaces fit on a phone without hiding anything.
4. As a phone player, I want the nav as a tab bar fixed to the bottom of the screen with an icon and a label per item, so that I can switch surfaces with my thumb.
5. As a phone player, I want the tab bar to respect the device safe area, so that the home indicator does not cover the labels.
6. As a phone player, I want page content to end above the tab bar, so that the last row, the Share button, or the Play again button is never hidden behind it.
7. As a desktop player, I want the nav as links inside the top bar, so that the screen does not waste a bottom strip.
8. As a player, I want the current nav item highlighted, so that I can see which surface I am on.
9. As a player on Protocols or Applications, I want the Daily nav item highlighted, so that the three Dailies read as one surface.
10. As a keyboard player, I want to Tab through the wordmark, nav items, How-to button, and theme toggle in order, so that I can move around without a pointer.
11. As a player, I want the theme toggle to keep its current behavior (follow system until clicked, then light or dark persists), so that nothing I already chose is lost.
12. As a player, I want a How-to button in the top bar, so that I can reread the rules without leaving the screen.
13. As a player, I want the "Progress may not save." notice styled as a small visible banner, so that I notice it without it blocking play.

### How-to and Help

14. As a first-time player on any route, I want How-to to open as a real modal dialog centered on the screen with a dimmed backdrop, so that I read the rules before anything else.
15. As a player, I want the How-to dialog to trap focus and close on Escape, on the Got it button, or on a backdrop click, so that it behaves like every other dialog I know.
16. As a player, I want any of those dismissals to mark How-to as seen, so that it does not reopen on the next visit.
17. As a player, I want the How-to button in the top bar to open the same dialog later, so that the rules are one tap away.
18. As a player, I want the Help page to show the same rules as How-to in a readable card, so that a deep link to Help is useful.
19. As a screen reader user, I want the dialog to have the accessible name "How-to" and a single heading, so that it announces properly.

### Daily screen

20. As a player, I want a Daily switcher above the board with Mixed, Protocols, and Applications, so that I can move between today's three Dailies without the main nav.
21. As a player, I want the current Daily category marked in the switcher, so that I know which catalog I am guessing in.
22. As a player, I want the service name as the single large heading with a small "Which port is" caption above it, so that the question is obvious.
23. As a player, I want a try counter reading `0 / 6` at the top right of the board that counts committed tries, so that I always know how many tries I have used.
24. As a player, I want the board to start with only the active row, so that the screen is not full of empty slots before I have guessed.
25. As a player, I want each committed try to become a row of tiles above the active row, so that the board grows as I play.
26. As a player, I want a miss row's tiles in gray and a correct row's tiles in green, so that the result is visible without reading.
27. As a player, I want no yellow or partial-hint tile state, so that the board never leaks digit positions.
28. As a player, I want the digits in tiles and slots in a monospace font, so that ports line up and read as numbers.
29. As a player, I want a miss that matches an entry in this Daily's catalog to show that entry's name next to the row, so that I learn what the port I typed belongs to.
30. As a player, I want a miss that matches nothing to show "Not in this catalog." next to the row, so that I know the port is not one of the answers.
31. As a player, I want row captions to wrap instead of truncating with an ellipsis, so that "Not in this catalog." and long names stay readable.
32. As a player on a screen narrower than the small breakpoint, I want row captions under their row, centered, so that a five-digit board still has room for the caption.
33. As a player on a screen at least the small breakpoint wide, I want row captions beside their row, so that the board reads left to right.
34. As a player, I want new tiles to pop briefly when a row commits, so that the commit registers.
35. As a player, I want the active row to shake on an invalid or duplicate guess, so that the rejection is felt as well as read.
36. As a player, I want an inline message under the board for "Not enough digits.", "Not a valid port.", and "Already guessed.", so that I know why a guess was not committed.
37. As a player, I want an already-finished Daily to open on the reveal with no active row, so that reload and revisit look the same as the moment I finished.
38. As a player who reloads mid-game, I want my committed rows restored and the active row ready, so that refresh costs nothing.
39. As a player on an uncovered date, I want a styled "Puzzle unavailable" state with a link to Help, so that the failure case is not raw text.

### Digit slots

40. As a player, I want one input per digit of the answer, so that I can see how many digits the port has and where I am typing.
41. As a player, I want the first empty slot focused when the Daily loads and after How-to closes, so that I can start typing immediately.
42. As a player, I want typing a digit to fill the current slot and move focus to the next one, so that entering a port is a single burst of keystrokes.
43. As a player, I want Backspace on a filled slot to remove that digit and shift later digits left, and Backspace on an empty slot to remove the previous digit and move back, so that fixing a typo is natural.
44. As a player, I want Left and Right arrows to move between the first slot and the first empty slot, so that I can edit a middle digit.
45. As a player, I want typing over a filled slot to replace that digit, so that I do not have to delete first.
46. As a player, I want pasting a number to fill the slots from the current one, so that I can paste a port from elsewhere.
47. As a player, I want non-digit keys ignored, so that stray characters never land in a slot.
48. As a player, I want Enter in any slot to submit, so that I do not need the Submit button.
49. As a player, I want a Submit button as well, so that tap-only play works.
50. As a phone player, I want the numeric keyboard to open when a slot is focused, so that I do not switch keyboards by hand.
51. As a player, I want clicking a slot beyond my typed digits to focus the first empty slot instead, so that I cannot leave a gap.
52. As a player, I want the focused slot outlined and filled slots visibly different from empty ones, so that I can see the caret position without a caret.
53. As a screen reader user, I want the slots grouped under the label "Port digits" with each slot named "Digit n of N", so that the row announces clearly.
54. As a player, I want an invalid or duplicate guess to keep my digits in place after the shake, so that I can fix one digit rather than retype.

### Miss popover

55. As a player, I want the name of a catalog miss to look tappable, so that I know there is more behind it.
56. As a desktop player, I want hovering the name to open the miss popover under it with the entry's name, port, description, and sources, so that I learn about the service I typed.
57. As a desktop player, I want to move the mouse from the name into the popover without it closing, so that I can open a source.
58. As a phone player, I want tapping the name to open the popover and tapping it again or tapping outside to close it, so that hover-only content is not lost on touch.
59. As a keyboard player, I want focusing the name to open the popover and Escape to close it, so that the content is reachable without a mouse.
60. As a player, I want a source to open in a new tab, so that I do not lose my board.
61. As a player, I want the popover to fit within the screen on a phone, so that it never needs horizontal scrolling.
62. As a player, I want no popover on "Not in this catalog.", so that a plain caption is not mistaken for a control.
63. As a player, I want the popover to omit the sources section when an entry has no sources yet, so that curation can land later without an empty section.

### Reveal, stats, and share

64. As a player, I want a divider to draw across the screen and the reveal to fade in and rise slightly when I win or lose, so that the end of the game is marked.
65. As a player, I want the page to scroll smoothly to the reveal when I finish, so that I do not hunt for it below the board.
66. As a player who reloads a finished Daily, I want no scroll, so that the page opens where I expect.
67. As a player, I want the reveal to say "Solved" on a win and "The answer was" on a loss, so that the outcome is stated.
68. As a player, I want the port shown large in monospace with a transport badge (TCP, UDP, or TCP/UDP) and the description, so that the answer and its context are the focus.
69. As a player, I want personal stats as four numbers, Played, Win %, Streak, Best streak, so that my stats are visible at a glance.
70. As a player, I want the histogram, headed "Guess distribution", with a bar per try count and the winning try highlighted, so that I see how today compares.
71. As a player, I want a full-width Share button that reads "Copied!" briefly after a successful copy, so that I know the share line is on the clipboard.
72. As a player whose clipboard is blocked, I want the share line shown in a selectable text area, so that I can copy it by hand.
73. As a player, I want the share line unchanged (category, date, tries, squares), so that shares from before and after the redesign look the same.

### Blitz

74. As a player, I want Blitz setup with three pill groups for category, orientation, and mode and a large Start button, so that starting a run is three taps.
75. As a player, I want the selected pill filled and the others outlined, so that the current choice is obvious.
76. As a keyboard player, I want the pills to remain native radio groups underneath, so that arrow keys move within a group.
77. As a player, I want the empty-pool error styled as an inline notice under Start, so that the reason is readable.
78. As a player, I want a HUD row during a run with three hearts for lives, the score, and a `m:ss` countdown, so that the run state is one glance.
79. As a player in Survival, I want no countdown shown, so that the HUD does not promise a timer that does not exist.
80. As a player, I want a spent life shown as an empty heart, so that losing a life is visible.
81. As a player, I want the prompt (service name in Default, port in Inverted) large and centered, so that the entry being asked about is the focus.
82. As a player in Inverted on a crowded port, I want the blurb under the port, so that the hint is where I look.
83. As a player in Default, I want the same digit slots as the Daily, so that both modes feel the same.
84. As a player in Inverted, I want the search input and the Search panel inline below it, so that the list never fights the phone keyboard.
85. As a player in Inverted, I want results to show names only, so that ports are never leaked in the list.
86. As a player in Inverted, I want the highlighted row visible and Enter or click to pick it, so that keyboard and pointer both work.
87. As a player in Inverted, I want "No matches." only after I have typed something, so that the empty box does not nag.
88. As a player, I want the miss message ("{name} is {port}", "Wrong service, same port.", or the identified name) inline under the input, so that I learn without a modal.
89. As a player, I want an end card with "Time's up" or "Out of lives", the score large, the stored best, and a "New best" mark when I beat it, so that the run ends with a result.
90. As a player, I want a Play again button on the end card that returns to setup, so that the loop is one tap.
91. As a player, I want the Blitz heading to stay "Blitz" on setup and end screens, so that the surface stays named.

### History and Help

92. As a player, I want History grouped by date, newest first, with the date as a heading, so that a day's three answers read together.
93. As a player, I want each History row to show a category badge, the name, and the port in monospace, so that rows scan quickly.
94. As a player, I want History to stay read-only with no links to past Dailies, so that it remains an archive, not a playable list.
95. As a player, I want Help as a card with the numbered rules, so that it reads as a page rather than a leftover list.

### Theme, motion, and accessibility

96. As a player, I want light and dark themes to cover every new surface (tiles, pills, popover, dialog, tab bar), so that no element is unreadable in either theme.
97. As a player with reduced motion, I want tile pop, row shake, divider draw, reveal fade, and smooth scroll disabled, so that the app respects my setting.
98. As a player, I want every interactive element to have a visible focus ring, so that keyboard navigation is trackable.
99. As a player, I want one `h1` per screen, so that the page structure is clear.
100. As a player, I want status messages in live regions, so that assistive tech reads rejections and results.
101. As a phone player at 375px, I want no horizontal scrolling on any screen, so that the layout fits.

### Maintainer

102. As a maintainer, I want catalog entries to accept an optional `sources` list of label and URL pairs, so that the miss popover can show sources.
103. As a maintainer, I want catalog validation to reject a source with an empty label or a non-https URL, so that bad sources fail CI.
104. As a maintainer, I want `sources` treated as flavor, editable at any time, so that adding sources never touches the frozen prefix rules.
105. As a maintainer, I want the redesign to keep the existing accessible names where behavior did not change, so that the current tests keep passing with minimal edits.
106. As a maintainer, I want jsdom test scaffolding for the native dialog and scrolling, so that UI tests run without a browser.
107. As a maintainer, I want the shell to avoid CSS that makes an ancestor the containing block for the fixed tab bar, so that the tab bar cannot silently jump to the top again.
108. As a maintainer, I want the v1 design spec's no-UI-kit and no-state-library rule kept and no web font added, so that the dependency list stays as it is.

## Implementation Decisions

### Design language

- Wordle cousin, quiet shell. Palette is Tailwind zinc for surfaces and text, emerald for correct tiles and the Share button, zinc mid-tones for miss tiles. There is no yellow or partial-hint state anywhere; the engine only knows correct and miss.
- Digits, ports, timers, and the try counter use the system monospace stack. Everything else uses the system sans stack. No web fonts.
- Dark theme continues to use the existing `dark` class on `html`. Every new element defines both light and dark colors.
- Layout is one centered column. The Daily column is narrow (28rem) on phones and slightly wider (32rem) from the small breakpoint so row captions fit beside the board. Other screens use the same column.
- One responsive design. Breakpoint differences are limited to nav placement, caption placement on the Daily board, and spacing. The medium breakpoint (768px) switches the nav; the small breakpoint (640px) switches caption placement.

### Shell

- The top bar is sticky. Left: wordmark (a two-by-two mark plus "Portdle") linking to the Daily. Right: a "How to play" icon button that opens the How-to dialog, then the existing theme toggle with the accessible name "Toggle color theme".
- One `nav` element with the accessible name "Main" holds the four items Daily, Blitz, History, Help. Below the medium breakpoint it is fixed to the bottom of the viewport, four equal columns, icon over label, with bottom padding equal to the device safe-area inset. At the medium breakpoint and up it sits inline in the top bar as text links with a filled pill on the active item.
- The Daily item is active on any of the three Daily routes, so a tab is always lit on Protocols and Applications. Each other item is active on its own route. (The prototype used exact match for Daily only because its switcher was in-memory state, not routes.)
- The top bar must not use `backdrop-filter`, `filter`, or `transform`. Any of these on an ancestor makes it the containing block for the fixed tab bar, which then renders inside the top bar. The prototype hit this bug.
- Page content carries bottom padding on phones that clears the tab bar.
- The "Progress may not save." notice becomes one shared styled notice used wherever pages render it today.

### How-to and Help

- How-to is a native `dialog` element opened with `showModal`. It opens on first visit (How-to not yet seen) and from the top-bar button. Its accessible name is "How-to" via its heading. The close button is "Got it". Escape and a click on the backdrop also close it. Every close path writes How-to seen. Closing returns focus to the element focused before the dialog opened, which is native dialog behavior, so on the Daily the slot regains focus.
- Help renders the same rules in a card with a numbered list under the `h1` "Help".

### Daily screen

- The Daily switcher is a row of three links (Mixed, Protocols, Applications) styled as a segmented row with the current one underlined and marked via `aria-current`. Routes do not change.
- The heading is the service name. A small uppercase caption "Which port is" sits above it.
- The try counter is a monospace `n / 6` right-aligned above the board, where `n` is the number of committed tries.
- The board renders one row per committed try, in order, followed by the active row while the status is playing. It never renders empty placeholder rows. When the status is won or lost there is no active row.
- Committed rows are tiles: one tile per digit, port padded to the answer's digit length, green for correct, gray for miss. Tiles pop on mount (timings in Motion).
- The row caption is: the miss popover trigger when the miss identified an entry; the text "Not in this catalog." when it did not; nothing for a correct row. Captions wrap and never truncate. Below the small breakpoint the caption is centered under its row; at the small breakpoint and up it sits in a column to the right of the tiles, with a matching empty column on the left so the board stays centered.
- Messages for invalid and duplicate guesses go in an `aria-live="polite"` paragraph under the board: "Not enough digits." when fewer digits than slots, "Not a valid port." otherwise for invalid, "Already guessed." for duplicate. The active row shakes on both. Digits are kept, not cleared.
- The Submit button keeps the accessible name "Submit".
- "Puzzle unavailable" is a styled empty state with the `h1` "Puzzle unavailable" and a link to Help.

### Digit slots

- The slot control is one text input per digit inside a `fieldset` whose visually hidden legend is "Port digits". Each input is named "Digit n of N", uses numeric input mode, and has autocomplete set to one-time-code. The control keeps its current props: length, value string, change callback, submit callback. It gains a shake key. Callers stay the same.
- The value is always a contiguous prefix of digits. Behavior, settled by the prototype except the last row, which the prototype missed and this spec requires:

  | Action | Result |
  |---|---|
  | Digit key or soft-keyboard digit on slot `i` | Replace position `i`, keep later digits, focus `i + 1` (or stay on the last slot) |
  | Paste of text on slot `i` | Non-digits stripped, digits written from position `i`, truncated to length, focus after the last written digit |
  | Backspace on a filled slot | Remove that digit, later digits shift left, focus stays |
  | Backspace on an empty slot | Remove the previous digit, focus moves back |
  | Left / Right | Move focus, bounded by the first slot and the first empty slot |
  | Enter | Submit |
  | Any other key | Ignored |
  | Focus lands on a slot beyond the first empty one | Focus is redirected to the first empty slot |
  | Mount | The slot at the current value length is focused |
  | Shake key changes | The row plays the shake animation and focus stays on (or returns to) the slot that had it |

- Slot visuals: each slot is a bordered, rounded input; filled slots have a stronger border, the focused slot has a dark border and a soft ring, the caret is hidden.

### Miss popover

- The trigger is a button with the entry name, dotted underline, small gray text. The popover panel is a positioned element under the trigger, 16rem wide, with the name, the port in monospace, the description, and each source as an anchor that opens in a new tab with `rel="noreferrer"`, or no sources block when the entry has none.
- State model from the prototype: `pinned`, `hovered`, and `focused` booleans; the panel is open when any is true. Mouse enter on the trigger or the panel sets `hovered`; mouse leave starts a 150ms timer that clears it, cancelled by re-entering either. Focus on the trigger sets `focused`; blur clears it. Click toggles `pinned`. Escape clears all three. A pointer-down outside the trigger and panel clears `pinned` and `hovered`.
- Below the small breakpoint the panel is centered under the trigger; at the small breakpoint and up its right edge aligns with the right edge of the trigger, as in the prototype. It stacks in front of later rows.
- Only Daily miss rows have the popover. Blitz and History do not.

### Reveal, stats, and share

- The reveal renders under the board when the status is won or lost: a 1px divider that scales in from the center, then a block that fades and rises (timings in Motion). The block holds the outcome caption ("Solved" or "The answer was"), the port large in monospace, a transport badge, the description, the four stats (Played, Win %, Streak, Best streak), the histogram, and the Share button.
- The histogram is six bars scaled to the largest count, count printed inside, the winning try's bar green on a win.
- Smooth scroll to the bottom fires 250ms after the reveal mounts, only when the Daily was finished during this page session. A reload of a finished Daily does not scroll. Under reduced motion the scroll is instant and there is no delay.
- Share keeps its behavior and accessible name "Share". After a successful copy the label reads "Copied!" for 1.5 seconds. The clipboard fallback textarea stays.

### Blitz

- Setup keeps its three `fieldset` groups ("Daily category", "Orientation", "Mode") and their radio names. Radios are visually hidden; their labels render as pills, the checked one filled. Start is a large primary button. The empty-pool error is a styled inline notice.
- The run HUD is one row: three heart icons with an accessible label "Lives: n" (filled for remaining, outlined for spent), the score, and the remaining time as `m:ss` in monospace. Survival renders no time element.
- The prompt is the name or the port as the `h1`, centered, with the blurb beneath it in Inverted when present. Default uses the same slot control as the Daily. Inverted uses the existing combobox named "Service name" with the Search panel rendered inline below it: a listbox of up to 20 name-only rows, scrollable when they exceed the panel height, highlighted row styled, "No matches." only when the query is non-empty and there are no hits.
- The end card shows the `h1` "Blitz", "Time's up" or "Out of lives", the score large, "Best n" (or "Best —"), a "New best" badge when the run's score exceeded the stored best at run end, and a "Play again" button.

### History and Help

- History rows are grouped by date, newest first. The outer list keeps the accessible name "History" via the heading. Each group has a date heading and an inner list of rows: category badge, name, port in monospace. No links.

### Catalog schema

- A catalog entry gains an optional `sources` list. Each source is a label and a URL. Validation adds an `invalid-source` issue when a label is empty or a URL does not start with `https://`. The check runs inside the existing catalog validation, so `gen:schedule --check` and CI enforce it. `sources` is flavor and may change at any time, like description and blurb. Populating sources across the catalogs is its own ticket; until then most entries have none.

### Motion

- Durations as accepted in the prototype: tile pop 150ms with a 40ms stagger per tile, row shake 300ms, divider draw 300ms, reveal rise 300ms after a 250ms delay. Keyframes for pop, shake, draw, and rise live in the global stylesheet as small classes. The existing reduced-motion rule already zeroes all animations; the scroll behavior checks the media query directly.

### Test scaffolding

- A Vitest setup file stubs `HTMLDialogElement.prototype.showModal` and `close` to toggle the `open` attribute, and stubs `window.scrollTo`. A few lines, no library. jsdom 30 implements neither.

## Testing Decisions

A good test renders the app through its public seam and asserts what a player can see or do: roles, accessible names, visible text, focus, and persisted keys through the injected store. It does not assert class names, CSS, animation timing, or component internals, and it does not recompute expected values the way the code does. Expected strings are literals from this spec.

Two seams, both existing:

1. **App seam.** Render `App` with a memory store, a memory history at a route, and an injected `utcToday`. Prior art: the shell, Mixed Daily, Blitz, and History test files, plus the shared helpers for the memory store and `matchMedia` stub. Cover:
   - Shell: four nav links named Daily, Blitz, History, Help, all focusable; Daily link active on the three Daily routes; "How to play" button opens a dialog named "How-to"; first visit opens it; Got it, Escape, and backdrop click each close it and write How-to seen; theme toggle behavior unchanged.
   - Daily: heading is the name; a group named "Port digits" with N inputs named "Digit n of N"; the first slot has focus on load and again after Got it closes How-to; typing digits advances focus; Backspace behavior; paste fills; Enter submits; incomplete submit shows "Not enough digits." and commits nothing; duplicate shows "Already guessed."; the try counter reads `0 / 6` then `1 / 6`; a catalog miss renders a button with the entry name and a miss that matches nothing renders "Not in this catalog." text; hovering, focusing, and clicking the miss button open and close the panel per the state model, and the panel contains the description and source anchors when present; the reveal, stats, histogram, and Share appear on won and lost; "Copied!" after copy; finished Daily on reload shows no slots and no scroll call; "Puzzle unavailable" with a Help link.
   - Blitz: pills remain radios with their existing names; HUD shows "Lives: 3", score, and `1:00` for Sprint, no time for Survival; slots in Default; combobox plus inline listbox in Inverted, "No matches." only after typing; end card shows "Time's up" or "Out of lives", best, "New best" when beaten; Play again returns to setup. Existing Blitz behaviors stay covered by the existing tests with names updated only where this spec renames them.
   - History: date headings newest first; rows under the right date; list named "History"; no links; today's row rules unchanged.
   - Tests that must change by decision: the nav has four links, so the shell test that expects six drops "Mixed", "Protocols", and "Applications" from the nav and expects "Daily" instead; "Protocols" and "Applications" remain links inside the Daily switcher on Daily routes only; the single "Port digits" textbox becomes N "Digit n of N" textboxes; History assertions move from a flat list to grouped lists. Every other accessible name keeps its current value.

2. **Catalog validation seam.** Call the catalog validator with entries that have valid sources, an empty label, and an `http://` URL, and assert the `invalid-source` issue. Prior art: the existing catalog validation tests for blurbs and duplicate names.

No snapshot tests, no visual regression, no Playwright. The prototype screenshots at 375px and 1024px were the visual check; the spec records the decisions they settled.

## Out of Scope

- A stats modal after finishing (kept inline in v1; revisit later)
- An on-screen keypad
- Separate desktop and phone designs, or a phone-only nav that hides items
- Miss popover in Blitz or History
- Populating `sources` across the catalogs (own ticket; the schema and validation land here)
- Any new game feature, rule change, engine change, persistence key, or route
- A control to return the theme to system
- Web fonts, a UI kit, a state library, a component library, Playwright
- Changes to the share line format

## Further Notes

- Primary source: branch `prototype/ui`, commit `fd70684`. Variant A won. The prototype carries its own copy of the slots, popover, and shell; the implementation rewrites them properly with tests and must not merge the prototype files.
- Author calls not covered by the interview or the prototype, listed so they can be overruled: the Daily nav item is active on all three Daily routes; source validation requires a non-empty label and an `https://` URL; hearts carry the accessible label "Lives: n" with spent lives outlined; the Submit button keeps the name "Submit" (the prototype said "Enter"); the History outer list keeps the name "History"; the miss popover is Daily-only; no web font is added; focus returns to the slot after How-to closes, via native dialog focus restoration.
- Glossary: `CONTEXT.md` at the repo root defines Shell, Top bar, Nav, Tab bar, Daily switcher, Board, Row, Tile, Slot, Try counter, Miss popover, Reveal, Stats, Share line, How-to, HUD, Search panel, End card, Source. Use those words in tickets, tests, and code.
- Product and architecture authority remains the v1 design spec; this spec changes only section 9 (UI) and adds the `sources` field to the entry schema in section 5.
- The typing bug is fixed as a side effect of the slot control: the old design kept a single input under decorative slots, and the CSS reset made it invisible. The new control has no decorative slots; the inputs are the slots.
