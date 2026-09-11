# Spec: Daily digit feedback, fuzzy search, Help removal

Spec for the deducible Daily and three fixes. Tracker: https://github.com/mquesada02/portdle/issues/44

## Problem Statement

A player who does not already know the port has no way to close in on it. After a miss the board says which service the typed port belongs to, and nothing else. Six tries against a four or five digit number with no direction feels impossible, and the player stops after a day or two. Three smaller things get in the way too: in Blitz's inverted orientation, searching "sql" finds nothing because search only matches the start of a name, so PostgreSQL and MySQL never show; the Blitz end card reads "Best —" after a first run even though a best was just saved; and the nav carries a Help item that duplicates the "How to play" button next to it.

## Solution

The Daily becomes deducible the way Wordle is. Every committed row shows a mark per digit: placed (right digit, right position, rendered green), present (the digit exists elsewhere in the port, rendered yellow), or absent (rendered gray), with Wordle's rule for repeated digits. A display-only tracker strip under the board shows the best-known mark for each digit 0 to 9. Miss identification stays, so knowing the service still wins faster than deducing. The share line becomes a grid of one row per try and one square per digit. Blitz keeps one-shot rounds with no marks. Inverted search becomes fuzzy through a small library, so "sql" finds PostgreSQL and MySQL and a typo still finds the right row. The Blitz end card always shows a number for Best. The Help nav item and the Help page go away; the How-to dialog is the only help surface, and the nav has three items.

## User Stories

### Marks on the board

1. As a player, I want each digit of a committed row marked placed, shown green, when it is the right digit in the right place, so that I can lock in what I know.
2. As a player, I want a digit marked present, shown yellow, when it exists in the port but not at that position, so that I can move it next try.
3. As a player, I want a digit marked absent, shown gray, when it is not in the port at all, so that I stop trying it.
4. As a player who types a digit twice, I want the marks to follow Wordle's repeated-letter rule, so that two present marks never promise two copies that are not there.
5. As a player, I want a winning row to be all placed, so that the finish reads the same as Wordle.
6. As a player, I want the row caption (identified service name or "Not in this catalog.") kept on the row as today, so that knowledge still helps alongside deduction.
7. As a player, I want a leading zero I typed to be marked like any other digit against the port padded to the slot count, so that the marks and my typed row agree.
8. As a colorblind player, I want each mark to be readable without color, through a text state on each tile that assistive tech reads and a visible difference beyond hue, so that the deduction is not color-only.
9. As a player on a reload, I want every committed row to show the same marks as when I played it, so that refreshing costs nothing.
10. As a player, I want the marks to show only on the Daily, so that Blitz stays a one-shot knowledge test.

### Tracker strip

11. As a player, I want a row of the digits 0 to 9 under the board, so that I can see at a glance which digits are dead, present, or placed.
12. As a player, I want each tracker digit to show its best-known mark across all my rows, placed over present over absent, so that a digit never looks worse than the board proved.
13. As a player, I want untried digits in the strip to look neutral, so that unknown is distinct from absent.
14. As a player, I want the strip to be display-only, so that I do not tap it expecting input.
15. As a player, I want the strip hidden once the Daily is finished, so that the reveal is the focus.

### Share line

16. As a player, I want the share header to read `Portdle · Mixed · 2026-09-10 · 3/6` as today, so that shares stay recognizable.
17. As a player, I want one row of squares per committed try with one square per digit showing its mark (placed, present, or absent), so that the share tells the deduction story.
18. As a player who lost, I want six rows and `X/6`, so that a loss reads honestly.
19. As a player, I want the share to leak only the digit count, never the name or the port, so that friends can still play.

### Fuzzy search (Blitz, inverted orientation)

20. As a player, I want "sql" to list PostgreSQL, MySQL, and MSSQL, so that a fragment inside a name is enough.
21. As a player, I want a small typo like "postgers" to still find PostgreSQL, so that speed does not punish spelling.
22. As a player, I want aliases to keep matching, so that "postgres" still finds PostgreSQL.
23. As a player, I want the best matches first, so that the row I mean is at the top.
24. As a player, I want nonsense like "zzzz" to list nothing and show "No matches.", so that the list never fills with junk.
25. As a player, I want the list still capped at 20 rows and showing names only, so that ports are never leaked.

### Blitz Best

26. As a player finishing my first Blitz run, I want the end card to read `Best n` with my score, so that the card never shows a dash.
27. As a player, I want `Best n` to be the higher of my stored best and this run, so that the number is always right.
28. As a player, I want "New best" when this run beats my stored best, or when it is my first run with a score above zero, so that a first success is celebrated.

### Help removal

29. As a player, I want the nav to have exactly Daily, Blitz, and History, so that the tab bar is roomier and nothing is duplicated.
30. As a player, I want the "How to play" button in the top bar to remain the way to reread the rules, so that help is still one tap away.
31. As a player who bookmarked the old Help address, I want it to land on the Daily, so that the link is not a dead end.

### Maintainer

32. As a maintainer, I want per-digit marks computed by a pure engine function from the typed digits and the answer's digits, so that persistence does not change.
33. As a maintainer, I want the share grid built by the existing share formatter from the same marks, so that UI and share never disagree.
34. As a maintainer, I want the fuzzy search behind the existing search index and search functions, so that the Blitz page and its tests do not learn a library.
35. As a maintainer, I want every ranking claim in the search tests pinned to literal queries and names, so that a library upgrade that reorders results fails a test.
36. As a maintainer, I want the v1 design spec's search section and routes table noted as superseded in this spec, so that the authority trail stays honest.

## Implementation Decisions

### Marks

- A mark is `placed`, `present`, or `absent`. A pure engine function takes the typed digit string and the answer's port padded to the same length and returns one mark per position. Rule, Wordle's: first pass marks every position where the digits are equal as placed and consumes that answer digit; second pass, left to right, marks a digit present if an unconsumed copy remains in the answer and consumes it, else absent. Ports with leading zeros in the padded form are treated like any digit.
- The committed guess record in persistence does not change. Marks are derived at render from the stored port and the answer, and by the share formatter the same way.
- Tiles render placed as green, present as yellow, absent as the current miss gray. Each tile exposes its mark as text for assistive tech, in the form "digit, mark" (for example "2, placed"), and present tiles carry a visible secondary cue besides hue. The board, rows, captions, pop and shake motion, and try counter are otherwise unchanged. Blitz in the default orientation never computes or shows marks.
- Winning row: all placed. The reveal, stats, and Share keep their behavior; the share text changes as below.

### Tracker strip

- A row of the digits 0 to 9 under the board, visible while the Daily is playing, hidden once won or lost. Display only: not focusable, not a control.
- Each digit's state is the best mark it received in any committed row, placed over present over absent, or unknown when never typed. Colors match the tiles; unknown is neutral. Each digit exposes "digit, mark" as text for assistive tech, or "digit, unknown" when never typed.

### Share line

- The header line is unchanged. Below it, one line per committed try, one square per digit: 🟩 placed, 🟨 present, ⬜ absent. A win ends on the all-green row. A loss shows all six rows and `X/6` in the header. The formatter takes the committed rows' marks; it no longer takes a bare count. This supersedes the v1 design spec's share format.

### Fuzzy search

- Search in the inverted orientation of Blitz uses the `uFuzzy` library (`@leeoniya/ufuzzy`) behind the existing search index and search function. Keys are the entry name and its aliases. Results are ordered by the library's best rank per entry, ties broken by name, capped at 20, still name-only. Single-error typo tolerance (one substitution, transposition, insertion, or deletion) is configured; the exact configuration is whatever makes the literal test cases below pass and is not otherwise tuned. Empty or whitespace query lists nothing. Description and blurb are never indexed.
- This supersedes the v1 design spec's prefix-index search section.
- Adding the dependency is the one exception to "no new dependencies" made by this spec; it has no dependencies of its own.

### Blitz Best

- On run end the end card shows `Best n` where n is the higher of the stored best and this run's score. "New best" shows when this run's score is higher than the stored best, or when no best was stored and the score is above zero. The card derives the number from the stored best and the run's score at render time, so it never depends on the write having happened; the write still occurs on run end as today.

### Help removal

- The nav has three items: Daily, Blitz, History. The Help route and Help page are removed; the old address redirects to the Daily. The "How to play" button in the top bar keeps opening the How-to dialog. This supersedes the v1 design spec's routes table for `/help`.

## Testing Decisions

A good test exercises a public seam with literal inputs and asserts what a player sees or what a pure function returns. It does not read class names, colors, or library internals. Expected values are literals from this spec.

1. **Engine seam** (pure functions, prior art: the existing guess, share, and search test files).
   - Marks: `2233` vs `3322` gives present, present, present, present; `1230` vs `1200` gives placed, placed, absent, placed... each case written out as digits in, marks out, including a repeated digit where only one copy exists (second copy absent), a winning row (all placed), and a padded leading zero.
   - Share: a won game in three with given rows produces the exact three-line grid; a lost game produces six rows and `X/6`; the header is unchanged.
   - Search: "sql" returns PostgreSQL and MySQL (and MSSQL if present in the catalog) and nothing unrelated; "postgers" returns PostgreSQL first; "postgres" (alias) returns PostgreSQL; "zzzz" returns nothing; empty returns nothing; a query matching more than 20 entries returns 20; description text never matches.
2. **App seam** (render the app with a memory store, memory history, injected day; prior art: the Mixed Daily, Blitz, and shell test files).
   - A committed miss row shows tiles with accessible text for their marks; the tracker strip shows the expected state per digit after two known rows; the strip is absent after a win or loss.
   - Share after a win puts the grid text on the clipboard.
   - Blitz: first run's end card reads `Best n` with the run's score and shows "New best" when the score is above zero; a lower second run keeps the higher best and shows no badge.
   - Shell: exactly three nav links; the "How to play" button still opens the dialog named "How-to"; visiting the old Help address lands on the Daily.
   - Tests that assert the old prefix-only search behavior and the Help page are removed or rewritten to the new behavior.

## Out of Scope

- Blitz arena, setup dialog, orientation info, round log, Blitz history, History split, Codex (issue #42)
- Content: descriptions and sources for every entry (issue #43)
- Marks in Blitz (default orientation)
- Higher/lower hints or any hint beyond marks and miss identification
- Changes to persistence keys or the schedule
- A hand-rolled fuzzy matcher

## Further Notes

- Author calls not covered by the interview, listed so they can be overruled: the library is `uFuzzy` (`@leeoniya/ufuzzy`; tiny, no dependencies, keys for name and aliases, single-error typo tolerance); search ties are broken by name; the tracker strip hides after the Daily ends; the old Help address redirects to the Daily rather than 404ing; tiles and tracker digits expose their mark as text for assistive tech in the form "digit, mark" (tracker digits never typed read "digit, unknown"), and present tiles carry a visible cue besides hue, so marks are not color-only.
- Supersedes, in the UI redesign spec: the "no yellow or partial-hint state" design-language rule (marks add present and its yellow rendering), the end card's "Best —" fallback (a number always shows), the four-item nav and the Help page.
- Glossary: `CONTEXT.md` gains Mark and Tracker strip; How-to becomes the only help surface; Nav drops to three items.
