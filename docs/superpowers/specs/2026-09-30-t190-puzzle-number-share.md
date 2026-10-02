# Ticket spec: Puzzle number and share line

Spec for #190. Tracker: https://github.com/mquesada02/portdle/issues/190. Parent: Spec 5 (Dailies from the backend), https://github.com/mquesada02/portdle/issues/181 (`docs/superpowers/specs/2026-09-30-spec5-dailies-backend.md`, "Puzzle number and share"). Map: https://github.com/mquesada02/portdle/issues/169. Base branch: `spec5`.

## Problem Statement

A Daily has no public number, so players cannot say "#22" to each other. The share line names the date (`Portdle · Mixed · 2026-09-09 · 3/6`), which looks unlike other Wordle-style shares, and it cannot say that a play was late.

## Solution

Each UTC day gets one puzzle number, computed from the date. The Daily screen shows it with the date. The share line becomes `Portdle #22 · Mixed · 3/6`, with ` · late` after the tries for a late play.

## User Stories

1. As a player, I want each UTC day to have one puzzle number shared by the three Daily categories, #1 being 2026-09-09 (spec story 26).
2. As a player, I want the puzzle number on the Daily screen next to the date (story 27).
3. As a player, I want the share line to read `Portdle #22 · Mixed · 3/6`, and `X/6` after a loss (story 28).
4. As a player who played late, I want my share line to end with `· late` (story 29).

## Implementation Decisions

- **Puzzle number**: new `src/engine/puzzle-number.ts` exports `PUZZLE_EPOCH = "2026-09-09"` and `puzzleNumber(date: string): number`, which is `utcDayIndex(date, PUZZLE_EPOCH) + 1`. It is its own constant, not `SCHEDULE_EPOCH`, because the public number and the generator's start day are different concepts. No database column. The caller formats it as `#` plus the plain number (`#22`, `#1000`, no separator). Callers pass only dates on or after the epoch; an earlier date gives 0 or a negative number, and no code guards it.
- **Share line**: `formatShare` input gains `late: boolean` and keeps `date`, from which it takes the number. The first line is `Portdle #<n> · <Category label> · <tries>` plus ` · late` when `late` is true. A late loss reads `Portdle #22 · Mixed · X/6 · late`. The caller passes the Daily's own date, never today's. The date no longer appears in the line. The blank line and the grid are unchanged.
- **Reveal**: `DailyReveal` (`src/ui/daily-reveal.tsx`) passes `late: board.late === true` (an absent `late` reads as on-day). Its `utcToday` prop already carries the Daily's own date; the name stays.
- **Daily screen**: `DailyBoard` (`src/ui/daily-page.tsx`) shows one muted line above "Which port is", inside the header: `#24 · 2026-10-02` (puzzle number, the Daily's own UTC date `date`), with the classes of the try counter, `font-mono text-xs text-zinc-500` (owner answer, 2026-10-02).
- **Out of scope**: History and Archive row numbers belong to #191 (its acceptance: "History lists finished Dailies only, with puzzle number"). The Daily screen plays only today's Daily until #191, so `late` is false there in practice; the share line still honours it.

## Testing Decisions

- `src/engine/puzzle-number.test.ts`: #1 on 2026-09-09; #2 on 2026-09-10; #22 on 2026-09-30; a four-digit number has no separator; a month boundary.
- `src/engine/share.test.ts` (rewritten for the new line): won on try 3, won on try 1, loss `X/6`, a sixth-try win reads `6/6`, category labels, and late for a win and for a loss.
- `src/ui/daily-reveal.test.tsx` and `src/ui/mixed-daily.test.tsx`: expected share text uses the number; one Reveal test with a late record copies the line ending ` · late`; one Reveal test with `late` absent copies a line without ` · late`; one Daily screen test sees `#<n> · <date>` in the header, with `<date>` the fixture's `UTC_TODAY` and `<n>` computed by `puzzleNumber`, not hard-coded. Every existing expected share string changes; `puzzleNumber` of a pre-epoch date has no test.
- Prior art: `share.test.ts`, `utc.test.ts`.

## Out of Scope

- Puzzle number on History and Archive rows (#191).
- Global stats (#192), the new-day-from-server behaviour (#188).
- Any database change.

## Further Notes

- Owner answer, 2026-10-02: the header line is `#24 · 2026-10-02` form, muted, in mono, above "Which port is". The Daily screen showed no date before this ticket.
- `formatShare` keeps `date` as its input and derives the number inside it, so the caller never computes the number for the line.
- #188 later feeds the Daily's date from the server; this ticket uses the `date` prop the board already receives.

## Acceptance Criteria

- [ ] Puzzle number computed from the date, `#` plus the plain number
- [ ] Shown on the Daily screen next to the date
- [ ] Share line format for won, lost (`X/6`), and late
- [ ] Engine tests for the number and the share line
