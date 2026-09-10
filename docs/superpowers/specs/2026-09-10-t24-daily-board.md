# Spec: Daily board and slots

Spec for #24. Tracker: https://github.com/mquesada02/portdle/issues/24

## Problem Statement

A player on the Daily screen cannot type a guess: the CSS reset makes the real input invisible behind decorative slots, so clicking a slot focuses nothing. There is no Daily switcher on the screen itself, no try counter, and every row — committed or not — renders as plain unstyled text with no color, no monospace alignment, and no sense of how many tries remain. An invalid or duplicate guess gives no felt response, and an uncovered date falls back to raw text instead of a real empty state.

## Solution

The Daily screen gets a Daily switcher (Mixed, Protocols, Applications) above the board, marking the current category. The service name renders as the page's `h1` under a small "Which port is" caption, with a monospace `n / 6` try counter above the board. The board renders one tile row per committed try — green for a correct try, gray for a miss — followed by a single active row of one input per digit while the Daily is still playing; it never shows empty placeholder rows, and no active row appears once the Daily is won or lost. A committed miss row carries a caption naming the matched catalog entry, or "Not in this catalog." when nothing matched; captions wrap, sit centered under the row on narrow screens, and sit beside the row from the small breakpoint up. Tiles pop in over 150ms with a 40ms stagger per tile when a row commits. The digit-slot control is rewritten as one real input per digit — fixing the typing bug — with focus advancing as the player types, editing and paste support, and a shake on rejection that keeps the digits in place. Rejections and messages appear in a live region below the board. An uncovered date renders a styled "Puzzle unavailable" state with a link to Help. The reveal, stats, histogram, and Share keep rendering exactly as they do today.

## User Stories

### Daily switcher

1. As a player, I want a Daily switcher above the board with Mixed, Protocols, and Applications, so that I can move between today's three Dailies without the main nav.
2. As a player, I want the current Daily category marked in the switcher, so that I know which catalog I am guessing in.
3. As a player, I want the switcher's routes to stay exactly as they are today, so that links and bookmarks keep working.

### Try counter and heading

4. As a player, I want the service name as the single large heading with a small "Which port is" caption above it, so that the question is obvious.
5. As a player, I want a try counter reading `n / 6` right-aligned above the board that counts committed tries, so that I always know how many tries I have used.

### Board and rows

6. As a player, I want the board to start with only the active row, so that the screen is not full of empty slots before I have guessed.
7. As a player, I want each committed try to become a row of tiles above the active row, so that the board grows as I play.
8. As a player, I want a miss row's tiles in gray and a correct row's tiles in green, so that the result is visible without reading.
9. As a player, I want no yellow or partial-hint tile state, so that the board never leaks digit positions.
10. As a player, I want the digits in tiles and slots in a monospace font, so that ports line up and read as numbers.
11. As a player, I want a miss that matches an entry in this Daily's catalog to show that entry's name next to the row, so that I learn what the port I typed belongs to.
12. As a player, I want a miss that matches nothing to show "Not in this catalog." next to the row, so that I know the port is not one of the answers.
13. As a player, I want row captions to wrap instead of truncating with an ellipsis, so that "Not in this catalog." and long names stay readable.
14. As a player on a screen narrower than the small breakpoint, I want row captions under their row, centered, so that a five-digit board still has room for the caption.
15. As a player on a screen at least the small breakpoint wide, I want row captions beside their row, so that the board reads left to right.
16. As a player, I want new tiles to pop briefly when a row commits, so that the commit registers.
17. As a player, I want the active row to shake on an invalid or duplicate guess, so that the rejection is felt as well as read.
18. As a player, I want an inline message under the board for "Not enough digits.", "Not a valid port.", and "Already guessed.", so that I know why a guess was not committed.
19. As a player, I want an already-finished Daily to open on the reveal with no active row, so that reload and revisit look the same as the moment I finished.
20. As a player who reloads mid-game, I want my committed rows restored and the active row ready, so that refresh costs nothing.
21. As a player on an uncovered date, I want a styled "Puzzle unavailable" state with a link to Help, so that the failure case is not raw text.

### Digit slots

22. As a player, I want one input per digit of the answer, so that I can see how many digits the port has and where I am typing.
23. As a player, I want the first empty slot focused when the Daily loads and after How-to closes, so that I can start typing immediately.
24. As a player, I want typing a digit to fill the current slot and move focus to the next one, so that entering a port is a single burst of keystrokes.
25. As a player, I want Backspace on a filled slot to remove that digit and shift later digits left, and Backspace on an empty slot to remove the previous digit and move back, so that fixing a typo is natural.
26. As a player, I want Left and Right arrows to move between the first slot and the first empty slot, so that I can edit a middle digit.
27. As a player, I want typing over a filled slot to replace that digit, so that I do not have to delete first.
28. As a player, I want pasting a number to fill the slots from the current one, so that I can paste a port from elsewhere.
29. As a player, I want non-digit keys ignored, so that stray characters never land in a slot.
30. As a player, I want Enter in any slot to submit, so that I do not need the Submit button.
31. As a player, I want a Submit button as well, so that tap-only play works.
32. As a phone player, I want the numeric keyboard to open when a slot is focused, so that I do not switch keyboards by hand.
33. As a player, I want clicking a slot beyond my typed digits to focus the first empty slot instead, so that I cannot leave a gap.
34. As a player, I want the focused slot outlined and filled slots visibly different from empty ones, so that I can see the caret position without a caret.
35. As a screen reader user, I want the slots grouped under the label "Port digits" with each slot named "Digit n of N", so that the row announces clearly.
36. As a player, I want an invalid or duplicate guess to keep my digits in place after the shake, so that I can fix one digit rather than retype.

### Maintainer

37. As a maintainer, I want the redesign to keep the existing accessible names where behavior did not change, so that the current tests keep passing with minimal edits.
38. As a maintainer, I want the jsdom dialog stub extended to move focus into the dialog on open and restore the previously focused element on close, so that the first-slot-focus behavior is verifiable without a real browser.
39. As a maintainer, I want the Mixed Daily tests updated for the new slot inputs, counter, captions, and messages while every other existing behavior test (persist on first commit, refresh restore, streak isolation, win/lose, share) stays green, so that the redesign does not regress existing play.
40. As a maintainer, I want the digit-slot control to stay a single shared control that Blitz's Default orientation also uses, so that both surfaces stay in sync without duplicated logic.

## Implementation Decisions

### Design language

- The Daily column is narrow (28rem) on phones and slightly wider (32rem) from the small breakpoint (640px) so row captions fit beside the board, matching the shell's centered-column layout.
- Digits in tiles and slots and the try counter use the system monospace stack; the rest of the screen uses the system sans stack. No web fonts.

### Daily switcher

- The Daily switcher is a row of three links (Mixed, Protocols, Applications) styled as a segmented row with the current one underlined and marked via `aria-current`. Routes do not change.

### Board and rows

- The heading is the service name. A small uppercase caption "Which port is" sits above it. The try counter is a monospace `n / 6` right-aligned above the board, where `n` is the number of committed tries.
- The board renders one row per committed try, in order, followed by the active row while the status is playing. It never renders empty placeholder rows. When the status is won or lost there is no active row.
- Committed rows are tiles: one tile per digit, port padded to the answer's digit length, green for correct, gray for miss. Tiles pop on mount over 150ms, each tile staggered 40ms after the previous.
- The row caption is: the identified entry's name as plain text when a miss matched a catalog entry; the text "Not in this catalog." when it did not; nothing for a correct row. This ticket renders the name as plain text only — the interactive popover trigger belongs to the miss popover ticket. Captions wrap and never truncate. Below the small breakpoint the caption is centered under its row; at the small breakpoint and up it sits in a column to the right of the tiles, with a matching empty column on the left so the board stays centered.
- Messages for invalid and duplicate guesses go in an `aria-live="polite"` paragraph under the board: "Not enough digits." when fewer digits were entered than the answer's length, "Not a valid port." otherwise for invalid, "Already guessed." for duplicate. Distinguishing "Not enough digits." from "Not a valid port." is decided at the Daily screen itself, not inside the invalid/duplicate/miss message text shared with Blitz, because that shared text is unchanged by this ticket and Blitz's own message set does not gain "Not enough digits.". The active row plays a 300ms shake on both. Digits are kept, not cleared.
- The Submit button keeps the accessible name "Submit".
- "Puzzle unavailable" is a styled empty state with the `h1` "Puzzle unavailable" and a link to Help.

### Digit slots

- The slot control is one text input per digit inside a `fieldset` whose visually hidden legend is "Port digits". Each input is named "Digit n of N", uses numeric input mode, and has autocomplete set to one-time-code. The control keeps its current props — length, the value as a digit string, a change callback, a submit callback, and the existing disabled flag — and gains a shake key. Callers stay the same.
- The value is always a contiguous prefix of digits. Behavior, settled by the prototype except the last row, which the prototype missed and this ticket requires:

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
- Blitz's Default orientation keeps using this same control with no caller changes. Blitz's own visual restyle is a later ticket's work.

### Test scaffolding

- The jsdom dialog stub is extended so opening the dialog captures the currently focused element and moves focus into the dialog, and closing it restores focus to the captured element — enough of real native `<dialog>` behavior to verify that the first slot regains focus after How-to closes.

## Testing Decisions

A good test renders the app through its public seam and asserts what a player can see or do: roles, accessible names, visible text, focus, and persisted keys through the injected store. It does not assert class names, CSS, animation timing, or component internals, and it does not recompute expected values the way the code does. Expected strings are literals from this spec.

Test seam is fixed to the one already in use: the **App seam**. Render `App` with a memory store, a memory history at a route, and an injected `utcToday`. Prior art: the existing Mixed Daily, Blitz, and shell test files, plus the shared helpers for the memory store and `matchMedia` stub. Cover:

- The Daily switcher renders three links, the current route's link marked `aria-current`, the other two routing to the other two Dailies; the switcher and its Protocols and Applications links appear only on the three Daily routes.
- The heading is the service name; a group named "Port digits" holds N inputs named "Digit n of N" where N is the answer's digit length.
- The first slot has focus on load, and again after the Got it button closes How-to.
- Typing digits advances focus; Backspace on a filled slot removes and shifts, Backspace on an empty slot removes the previous digit and moves back; paste fills from the current slot; typing over a filled slot replaces it; Enter and the Submit button both submit.
- An incomplete guess shows "Not enough digits." and commits nothing; an otherwise invalid guess shows "Not a valid port."; a duplicate shows "Already guessed." and does not spend an extra try.
- The try counter reads `0 / 6` then `1 / 6` after a committed try.
- A catalog miss shows the identified entry's name as row text; a miss matching nothing shows "Not in this catalog." text.
- The board never renders empty placeholder rows.
- A won or lost Daily shows no active row and no "Port digits" group.
- Reloading an in-progress Daily restores its committed rows with the active row ready; reloading a finished Daily shows no slots.
- An uncovered date shows the "Puzzle unavailable" heading with a link to Help.
- Existing behavior stays covered: persisting on the first committed try, restoring on refresh, streak and stats isolation between categories, win and lose freezing the board, and the share text.

Blitz's existing test file needs a mechanical update only: its local helper that reaches into the "Port digits" group currently expects a single textbox and now must target the first of the N slots, matching the shared control's new shape. No Blitz behavior, rendering, or other accessible name changes, and every existing Blitz test keeps passing.

No snapshot tests, no visual regression, no Playwright. This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all passing, in addition to the App-seam coverage above.

## Out of Scope

- The miss popover: the trigger button, hover/focus/click open-and-close behavior, and the popover panel itself. This ticket's miss caption is plain text.
- The reveal, stats, histogram, and Share rendering and their motion (divider draw, fade and rise, scroll-to-reveal). The reveal keeps its current plain rendering, called the same way it is today.
- Blitz's own visual restyle (pills, HUD, inline Search panel). Only the shared digit-slot control's shake key and the mechanical Blitz test-helper fix land here.
- Any new game feature, rule change, engine change, persistence key, or route.
- The main nav, top bar, How-to dialog, and Help page beyond the jsdom scaffolding extension needed to test focus restoration.

## Further Notes

- Primary source: `docs/superpowers/specs/2026-09-10-ui-redesign.md` (issue #22), sections Design language, Daily screen, Digit slots, Motion, and Testing Decisions. Prototype reference: branch `prototype/ui`, commit `fd70684` — illustrative only, never merged. The prototype's slot control did not refocus after a shake; this ticket requires it (the last row of the slot table).
- Glossary: `CONTEXT.md` at the repo root defines Entry, Daily category, Daily switcher, Board, Row, Tile, Slot, Try counter, Daily, Miss identification, Try. Use those words in tests and code; avoid "Item"/"record"/"service row" for Entry, "Category tabs"/"sub-nav" for Daily switcher, "grid"/"game area" for Board, "cell"/"field"/"box" for Slot, "box"/"square" for Tile, "Progress"/"attempts" for Try counter, "hint"/"feedback" for Miss identification, "Attempt"/"turn"/"life" for Try, "Mode"/"game type"/"section" for Daily category, and "Puzzle of the day"/"challenge" for Daily.
- Product and architecture authority remains the v1 design spec and the UI redesign spec; this ticket is one slice of that spec's Daily screen and Digit slots decisions.
- Author calls not covered by the parent spec or the ticket body, listed so they can be overruled: the miss caption renders as plain text in this ticket, with the popover trigger deferred entirely to the miss popover ticket; the "Not enough digits." versus "Not a valid port." split is decided at the Daily screen rather than in the shared message text, to avoid changing Blitz's messages; the digit-slot control's props keep the existing disabled flag alongside the four the parent spec listed, since dropping it would be the one caller change "callers stay the same" rules out; the jsdom dialog stub gains real focus-trap-and-restore behavior rather than staying a bare attribute toggle.
