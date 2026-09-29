# Spec: ADR 0002 and glossary updates

Spec for #130. Tracker: https://github.com/mquesada02/portdle/issues/130. Parent: Spec 4, #127 (map #114). Not blocked. Docs only: no code changes.

## Problem Statement

Spec 4 amends ADR 0001 and adds a vocabulary the code, tickets, and tests will use. Until the docs say so, ADR 0001 still tells a reader that a later backend "brings its own client cache", that the storage seam becomes async, and that a second migration is coming. `CONTEXT.md` still says Portdle has "no backend", and it has no words for Account, Sync, or Leaderboard. Later Spec 4 tickets would name these ideas in their own way.

## Solution

Two doc changes, both taken from Spec 4 with no new decisions:

1. A new ADR 0002 records that localStorage stays the local store and the storage seam stays synchronous.
2. `CONTEXT.md` gains Spec 4's terms and updates three existing entries.

## User Stories

1. As a developer, I want ADR 0002 to say Supabase ships no offline cache, so that I do not plan a client cache the backend will not bring.
2. As a developer, I want ADR 0002 to say localStorage stays the local store and every screen keeps reading it, so that I know where the source of truth for a screen is.
3. As a developer, I want ADR 0002 to say `Persist` stays synchronous, so that I do not turn the storage seam async.
4. As a developer, I want ADR 0002 to say there is no second migration, so that I do not plan a move to IndexedDB.
5. As a developer, I want ADR 0002 to say the one-time import of local data stands as the first sign-in import, so that I know ADR 0001's import promise still holds.
6. As a developer reading ADR 0001, I want ADR 0002 to name exactly which ADR 0001 statements it supersedes, so that I know which parts of ADR 0001 are still true.
7. As a developer, I want `CONTEXT.md` to define Account, Sign-in, Linked identity, Sync, Preferences, Display name, Seeded display name, Normalized display name, Name confirm, Account menu, Account deletion, Leaderboard, Leaderboard window, Leaderboards tab, and Time to score, so that tickets, code, and tests share one vocabulary.
8. As a developer, I want Leaderboard defined as one Daily category, Orientation, and Blitz mode ranked across players, so that "18 leaderboards" is exact.
9. As a developer, I want Leaderboard window defined as All-time, Weekly, or Today, so that the window is not confused with the Leaderboard.
10. As a developer, I want the glossary to say "Leaderboard" is never shortened to "board", so that the Daily's Board stays unambiguous.
11. As a developer, I want the Leaderboards tab noted as its own term and not a Segment, so that History's Segments keep their meaning.
12. As a developer, I want the intro line to stop saying "no backend", so that the first line of the glossary is true.
13. As a developer, I want Top bar to name the person icon beside How-to and the theme toggle, so that the glossary matches the shell.
14. As a developer, I want Arena to be the Play tab of the Blitz screen, so that the arena still has one name after the Blitz screen gets tabs.

## Implementation Decisions

- **New ADR** `docs/adr/0002-localstorage-stays-local-store.md`, in ADR 0001's format: a short title heading and one dense paragraph, plain prose. It links to ADR 0001 and to Spec 4. It records five facts from Spec 4 (Architecture, Further Notes "Supersedes"):
  - Supabase ships no offline client cache.
  - localStorage stays the local store and every screen keeps reading it; sync layers on top of it.
  - `Persist` stays synchronous. It gains only what sync needs: sync bookkeeping keys (including the last-synced account id), listing the dates that have a stored Daily for a category, and clearing every Portdle key; `KeyValueStore` and `memoryStore` gain key removal and key listing for that.
  - There is no second migration.
  - The one-time import stands as the first sign-in import.
- The ADR states which ADR 0001 sentences it supersedes ("a later backend brings its own client cache" and "makes the seam async") and which stands ("imports localStorage once"). ADR 0001 itself is not edited: an ADR is a record, and the new ADR carries the amendment.
- **Glossary terms.** `CONTEXT.md` keeps its format: bold term, one-line definition, italic `_Avoid_` line where Spec 4 or the vocabulary gives a clear synonym to avoid. Placement:
  - A new `### Account` group before `### Screen` holds Account, Sign-in, Linked identity, Sync, Preferences, Display name, Seeded display name, Normalized display name, Name confirm, Account menu, and Account deletion.
  - Leaderboard, Leaderboard window, and Time to score go in `### Game`, beside Best and Run.
  - Leaderboards tab goes in `### Screen`, beside Segment, with the note that it is not a Segment.
- **Definitions come from Spec 4** (the `_Avoid_` lines are the author's call). One line each, in Spec 4's words:
  - Account: a player's optional sign-in identity on the backend, holding synced progress and one Display name.
  - Sign-in: entering an Account with Google or GitHub.
  - Linked identity: one provider login of an Account. The same verified email under Google and GitHub gives two linked identities of one Account; different emails give two Accounts.
  - Sync: the quiet exchange of changes between a device's local copy and its Account. It never disturbs the screen.
  - Preferences: the theme, the How-to seen flag, and the Codex sort, each synced on its own.
  - Display name: the name other players see on leaderboards. 1 to 30 characters with at least one non-whitespace character; letters in any script, digits, spaces, apostrophes, hyphens, and periods.
  - Seeded display name: the Display name an Account starts with, taken from the provider (GitHub username or Google account name) and normalized.
  - Normalized display name: a provider name with disallowed characters stripped and cut to 30 characters, or "Player" if nothing is left.
  - Name confirm: the full-page step after a first sign-in where the player confirms the Display name before it is public.
  - Account menu: the menu the person icon opens: sign-in choices when signed out; name edit, Sign out, and Delete account when signed in.
  - Account deletion: removes the Account and everything of it on the backend, leaderboard rows included, and clears the device the player deleted from.
  - Leaderboard: one Daily category, Orientation, and Blitz mode ranked across players. Never shortened to "board". Avoid: Board.
  - Leaderboard window: the time span a Leaderboard is viewed in: All-time, Weekly (since Monday 00:00 UTC), or Today (since 00:00 UTC today). Avoid: Daily (reserved for the puzzle).
  - Leaderboards tab: the tab beside Play on the Blitz screen that shows Leaderboards. Its own term, not a Segment.
  - Time to score: the milliseconds from a run's start to the commit of the last correct answer that produced its final score. Breaks ties between equal scores.
- **Existing entries.**
  - Intro line: "Wordle-like daily game for network ports, plus a timed Blitz mode. Static SPA; signing in is optional and adds sync and leaderboards through a hosted backend."
  - Top bar: "The strip at the top of the shell holding the wordmark, the How-to button, the theme toggle, and the person icon that opens the Account menu."
  - Arena: "The Play tab of the Blitz screen at rest: the New run button, the last run, and the bests."
- `Remote`, the sync module, the merge engines, and the account row do not enter the glossary (Spec 4, Further Notes).
- **Nothing else changes.** Best, Nav, Segment, and every other entry keep their text. No code, no other doc, no ADR 0001 edit.

## Testing Decisions

Docs only, so no Vitest tests. The check is reading the diff against Spec 4:

- Every term in Spec 4's Further Notes glossary bullet appears once in `CONTEXT.md`, and none of the excluded implementation names does.
- The three updated entries match Spec 4's wording.
- ADR 0002 names all five facts and the two superseded phrases.
- `git diff --stat` shows only `CONTEXT.md`, the new ADR, and this spec.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` still pass.

## Out of Scope

- Any code change, including `Persist`, `Remote`, sync, and UI.
- Editing ADR 0001.
- Glossary entries for `Remote`, the sync module, merge engines, or the account row.
- Changing the Best entry to mention time to score.
- New decisions: each fact comes from Spec 4.

## Further Notes

- Undecided author calls, listed so they can be overruled:
  - The ADR links to ADR 0001 and Spec 4, which ADR 0001's format does not do.
  - The file name `0002-localstorage-stays-local-store.md`.
  - The account terms sit in a new `### Account` group rather than in `### Screen` or `### Game`.
  - The Top bar entry names the How-to button as well as the person icon, because the current entry already omits it.
  - Wording of the `_Avoid_` lines for the new terms.
- Sources: Spec 4 (Architecture, Further Notes) and the ticket's acceptance criteria.
