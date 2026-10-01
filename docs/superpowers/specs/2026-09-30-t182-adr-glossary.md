# Spec: ADR 0003 and glossary changes

Spec for #182. Tracker: https://github.com/mquesada02/portdle/issues/182. Parent: Spec 5, #181 (map #169). Not blocked. Base branch: `spec5`. Docs only: no code changes.

## Problem Statement

Spec 5 moves the Daily and the catalog to the backend. Until the docs say so, a reader of ADR 0001 and ADR 0002 can take "all player state in localStorage" and "localStorage stays the local store" as a promise of a game that works offline from the bundle. Neither ADR states where the catalog or the Schedule come from. `CONTEXT.md` still says Portdle is a static SPA with a JSON catalog and a committed Schedule, and it has no words for Puzzle number, Archive, Late play, Global stats, or Error panel. Later Spec 5 tickets would name these ideas in their own way.

## Solution

Two doc changes, both taken from Spec 5 with no new decisions:

1. A new ADR 0003 records that the Daily, the Archive, Blitz, and the Codex depend on the backend, and names each statement it supersedes.
2. `CONTEXT.md` gains Spec 5's five terms and changes six existing entries.

## User Stories

1. As a developer, I want ADR 0003 to say the Daily, the Archive, Blitz, and the Codex depend on the backend, so that I do not plan an offline path for them.
2. As a developer, I want ADR 0003 to say offline Blitz and Codex are dropped, so that I do not rebuild them.
3. As a developer, I want ADR 0003 to say the site no longer works with no backend, so that a no-backend build is known to show the error panel.
4. As a developer, I want ADR 0003 to say account features stay hidden with no backend, so that I keep Spec 4's rule for them.
5. As a developer, I want ADR 0003 to list each superseded statement of Spec 5's Supersedes list, so that I know which old statements are no longer true.
6. As a developer, I want ADR 0003 to say that player state still lives in localStorage, so that I do not move it.
7. As a developer reading ADR 0001 or ADR 0002, I want ADR 0003 to say it supersedes only their assumed bundle and offline reading and keeps their localStorage rule, so that I know which parts stand.
8. As a developer, I want `CONTEXT.md` to define Puzzle number, Archive, Late play, Global stats, and Error panel, so that tickets, code, and tests share one vocabulary.
9. As a developer, I want Late play defined as a Daily whose first try was committed after its day, so that I know the rule for a late play in one line.
10. As a developer, I want Global stats kept separate from Stats, so that the two histograms are not confused.
11. As a developer, I want Streak to say "won on-day Daily", so that a late play is known not to count.
12. As a developer, I want Play surface to include the Archive board, so that the glossary matches the new screen.
13. As a developer, I want Schedule and Catalog kind to stop naming files, so that they match the backend.
14. As a developer, I want History to say it lists only finished Dailies, and "archive" to leave its Avoid list, so that the word has one meaning.
15. As a developer, I want the intro line to say the catalog and the Dailies come from the hosted backend, so that the first line of the glossary is true.

## Implementation Decisions

- **New ADR** `docs/adr/0003-dailies-need-the-backend.md`. Format (owner decision, 2026-09-30): a short title heading, one intro paragraph, a bulleted "Supersedes" list with one line per item, and one sentence that keeps the localStorage rule. Plain prose. The intro paragraph links to ADR 0001, ADR 0002, and Spec 5.
- **Intro paragraph** says, from Spec 5 (Architecture, Solution): the catalog and the Schedule live in Postgres on the Supabase project; the client has no bundled catalog, no bundled Schedule, and no stored copy of either; the Daily, the Archive, Blitz, and the Codex need the backend; offline Blitz and Codex are dropped; the site no longer works with no backend: with no backend, with a paused project, or when offline, these screens show the Error panel while nothing is loaded (a Daily already loaded keeps working if the network drops), while History still shows saved results; a build with no backend configured still hides the account features.
- **Kept rule** (one sentence): player state still lives in localStorage behind the synchronous storage seam, as ADR 0001 and ADR 0002 decided; ADR 0003 changes only where the catalog and the Schedule come from.
- **Supersedes list**, one line each, in the order of Spec 5, Further Notes, "Supersedes":
  1. v1 design §3, "Playable archive" out of scope (`2026-09-08-portdle-design.md`, also the ticket specs of #10, #12, #14) → the Archive with late plays.
  2. v1 design §3, "Global histograms" out of scope → the per-Daily global guess distribution.
  3. Spec 4, "Email and password" out of scope → enabled only in the local stack for end-to-end tests; the live project keeps it off.
  4. Spec 4, stories 1 and 27 and "No `Remote`, no account features", as far as they promise a site that works with no backend or offline play with no message → the Daily, the Archive, Blitz, and the Codex need the backend. Account features without a backend stay hidden.
  5. Spec 4, "a UTC day change still rebuilds the router" → a new server today no longer remounts screens, so a theme pulled from the account now applies only at the next app load.
  6. Spec 4, stats and last played stored and rebuilt after a pull → stats are never stored; every screen folds them.
  7. ADR 0001 and ADR 0002, as far as they assume the catalog and the Schedule come from the bundle and the game works offline → this ADR. Neither ADR states this assumption; the ADR line states, in one clause, that neither ADR says it, and ADR 0003 keeps their localStorage rule.
- ADR 0001 and ADR 0002 are not edited: an ADR is a record, and the new ADR carries the amendment (ADR 0002 precedent).
- **Glossary: five new terms.** `CONTEXT.md` keeps its format: bold term, one-line definition, italic `_Avoid_` line only where Spec 5 gives one (it gives none for the new terms). Definitions come from Spec 5, Further Notes, "Glossary":
  - **Puzzle number**: the public number of a UTC day, shared by the three Daily categories; #1 is 2026-09-09.
  - **Archive**: the screen listing every past Daily, where a missed or unfinished one can be played.
  - **Late play**: a Daily whose first try was committed after its day. It counts in the player's played, win percentage, and histogram, not in Streaks or Global stats.
  - **Global stats**: the per-Daily totals of on-day results of signed-in players, without names. Not the Stats histogram, which is personal.
  - **Error panel**: the shared panel the Daily, the Archive, the Blitz Play tab, and the Codex show in place of their content while the catalog or the Schedule has not loaded. History never shows it.
- **Placement**: Puzzle number, Late play, and Global stats go in `### Game` (Puzzle number after Daily, Late play after Streak, Global stats after Leaderboard window). Archive goes in `### Screen` after Segment. Error panel goes in `### Screen` after Sort toggle.
- **Glossary: six changed entries**, in Spec 5's words where it gives them (the intro line and Catalog kind are my wording of Spec 5's gist):
  - **Streak**: "Consecutive UTC days with a won on-day Daily in one category."
  - **Play surface**: "A screen where a guess is committed: the Daily board, an Archive board, or a Blitz run. The arena, History, the Archive list, and the Codex are not play surfaces." (The Archive list is not a play surface: an author call, listed below.)
  - **History**: "The record screen: every Daily the player finished in one segment, every saved run in the other." Its `_Avoid_` line becomes "Log, past games" (the word "archive" leaves it).
  - **Schedule**: "The rows in the backend saying which entry is the Daily on which UTC day."
  - **Catalog kind**: "Which group an entry belongs to: `protocol` or `application`." (No JSON file is named.)
  - **Intro line**: "Wordle-like daily game for network ports, plus a timed Blitz mode. Static SPA; the catalog and the Dailies come from a hosted backend, and signing in is optional and adds sync and leaderboards."
- **Nothing else changes.** Daily, Share line, Reveal, Stats, Best, Nav, and every other entry keep their text. Switch-over day and server today stay spec terms, not domain terms. No code, no other doc, no edit to ADR 0001 or ADR 0002.

## Testing Decisions

Docs only, so no Vitest tests. The seam is a read of the diff against Spec 5:

- ADR 0003 names all seven Supersedes items, the kept localStorage rule, and the dropped offline Blitz and Codex.
- `CONTEXT.md` has each of the five new terms once; the six changed entries match the wording above; "archive" is absent from History's Avoid list.
- `git diff --stat spec5` shows only `CONTEXT.md`, the new ADR, and this ticket spec.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` still pass (CI).
- Prior art: the ticket spec of #130 and its check.

## Out of Scope

- Any code change.
- Editing ADR 0001, ADR 0002, or Spec 4.
- Glossary entries for the switch-over day, server today, the generator role, or other implementation names.
- Changing Daily, Share line, Reveal, Stats, or Best.
- New decisions: each fact comes from Spec 5.

## Further Notes

- Undecided author calls, listed so they can be overruled:
  - The file name `0003-dailies-need-the-backend.md`.
  - The ADR links to Spec 5, as ADR 0002 links to Spec 4.
  - The Archive list is not a Play surface; only an Archive board is. Spec 5 names only the board.
  - Late play's definition names played, win percentage, and the histogram instead of Spec 5's "personal totals", because the Stats entry also holds streaks.
  - Supersedes item 7 stays conditional ("as far as") as in Spec 5, because neither ADR 0001 nor ADR 0002 states that the catalog and the Schedule come from the bundle or that the game works offline.
  - The ADR format (heading, intro paragraph, Supersedes list) differs from the single paragraph of ADR 0001 and ADR 0002; this is the owner's decision of 2026-09-30.
  - The Mixed entry ("Not its own catalog file") stays as it is; Spec 5 does not list it.
  - The Catalog kind text says "group", my wording for "no longer names a JSON file".
  - The intro line is my wording of Spec 5's gist: "the catalog and the Dailies come from the hosted backend; signing in stays optional".
  - The new terms carry no `_Avoid_` line, because Spec 5 proposes none.
  - Archive, Error panel, and Late play are placed as listed above; the order inside a group is not a decision of Spec 5.
  - Share line stays unchanged in the glossary, though its text now carries the puzzle number; Spec 5's glossary section does not change it.
- Sources: Spec 5 (Further Notes: Supersedes, Glossary; Architecture) and the acceptance criteria of #182.
