# Spec: Fuzzy search

Spec for #49. Tracker: https://github.com/mquesada02/portdle/issues/49

## Problem Statement

In Blitz's inverted orientation, the Search panel only matches the start of a name or alias. Typing "sql" finds nothing, because neither "PostgreSQL" nor "MySQL" starts with "sql", so a player who remembers a fragment of a name gets no matches. A small typo like "postgers" also finds nothing, because it is not a prefix of "PostgreSQL" either. The player is forced to spell the start of the name exactly right before the Search panel shows anything.

## Solution

Search in the inverted orientation becomes fuzzy: a fragment anywhere in a name, or a small typo, is now enough to find a match. "sql" lists PostgreSQL and MySQL; "postgers" still finds PostgreSQL, ranked first; aliases still match, so "postgres" finds PostgreSQL; nonsense like "zzzz" lists nothing and the Search panel still shows "No matches." The engine's search index and search function do the ranking with the `uFuzzy` library behind their existing exported shape, so the `Typeahead` component that renders the Search panel, and the Blitz page that uses `Typeahead`, do not change at all. What does not change: results are still name-only, still capped at 20 matches, and description and blurb still never match — only how the best match is found and ordered changes.

## User Stories

### Fuzzy search

1. As a player, I want "sql" to list PostgreSQL and MySQL (and MSSQL too, if it is ever added to the catalog), so that a fragment inside a name is enough to find the match.
2. As a player, I want a small typo like "postgers" to still find PostgreSQL, so that speed does not punish spelling.
3. As a player, I want aliases to keep matching, so that "postgres" still finds PostgreSQL.
4. As a player, I want the best matches first, so that the match I mean is at the top.
5. As a player, I want nonsense like "zzzz" to list nothing and show "No matches.", so that the list never fills with junk.
6. As a player, I want the list still capped at 20 matches and showing names only, so that ports are never leaked.
7. As a player, I want an empty or whitespace-only query to list nothing, so that the Search panel never dumps the whole catalog.

### Maintainer

8. As a maintainer, I want the fuzzy search behind the exported shape of the existing search index and search function, so that the Blitz page and the `Typeahead` component do not change and do not learn a library.
9. As a maintainer, I want every ranking claim in the search tests pinned to literal queries and names, so that a library upgrade that reorders results fails a test instead of silently changing behavior.
10. As a maintainer, I want description and blurb text to never be indexed or matched, so that search results can never leak that content.
11. As a maintainer, I want the existing prefix-only search tests replaced by tests of the new fuzzy behavior, so that the test suite documents what search actually does now.

## Implementation Decisions

### Fuzzy search

- The search index is built once per catalog, as it is today. Its haystack per entry is the entry's name plus each of its aliases; description and blurb are never included, so they can never match.
- Matching and ranking are delegated to the `uFuzzy` library (npm package `@leeoniya/ufuzzy`), added as the sole new dependency, pinned the same way every other dependency in this repo is pinned. It has no dependencies of its own.
- The library is configured for single-error typo tolerance per search term: one substitution, transposition, insertion, or deletion is allowed. This configuration is chosen only so that the literal test cases in Testing Decisions pass — it is not tuned against any other input, and no other rationale drives it.
- An entry's rank is its best (nearest-to-top) rank across its name and its aliases, as the library orders them. Entries are ordered by that rank, best first; entries with an equal rank are ordered by name using the same locale comparison the current implementation uses. The result list is capped at 20 entries.
- An empty query, or a query that is only whitespace, produces no results, matching today's behavior.
- The result each hit carries is unchanged: an id and a display name only — never a port, description, or blurb. This is the same public shape `searchNames` already returns.
- The exported shape of the search module — its build-index function, its search function, and the type of the index and of a search hit — stays exactly as it is today, so every caller (the `Typeahead` component and, through it, the Blitz page) needs no change of any kind.
- This supersedes the v1 design spec's prefix-index search section.

## Testing Decisions

A good test asserts what a player sees or what a pure function returns, using literal query strings and literal expected ids, names, or visible text. It does not assert `uFuzzy`'s internal ranks, info objects, or any other library internal, and it does not recompute expected values the way the code does. Expected strings are literals from this spec.

1. **Engine seam.** Prior art: the existing search test file. Test the search module's build-index and search functions. "sql" returns PostgreSQL and MySQL, and nothing unrelated (no MSSQL case, since no such entry exists in the catalogs at this time); "postgers" (a typo) returns PostgreSQL, ranked first; "postgres" (an alias of PostgreSQL) returns PostgreSQL; "zzzz" returns nothing; an empty query and a whitespace-only query both return nothing; a query matching more than 20 entries returns exactly 20; a query built from a fragment of an entry's description text never matches that entry, proving description is not indexed. Existing tests that assert the old prefix-only ranking (name-prefix before alias-prefix) are removed or rewritten to assert the fuzzy behavior above instead.
2. **App seam.** Prior art: the existing Blitz test file's own current search-related tests. Rewrite the one test that exercises the old prefix-only wording to fit fuzzy matching; every other existing Blitz test — including the empty-query and no-hits "No matches." tests — is unaffected and keeps passing unchanged, since neither asserts prefix-specific ranking.

No snapshot tests, no visual regression, no Playwright. This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` all passing, in addition to the coverage above. `gen:schedule --check` is listed because ticket #49's own acceptance criteria requires it, even though this ticket touches no catalog or schedule data.

## Out of Scope

- Daily digit marks, the tracker strip, the share line grid, Blitz Best's "Best n" fallback, and Help removal — separate tickets under the same parent spec
- A hand-rolled fuzzy matcher — the parent spec rules this out; `uFuzzy` is the one exception made to "no new dependencies"
- Any change to `Typeahead` or the Blitz page's rendering, props, or behavior
- Debounce timing, the Search panel's visual styling, and its accessible names
- Adding MSSQL or any other entry to either catalog
- Search outside the inverted Blitz orientation (default orientation and the Daily do not use this search)

## Further Notes

- Primary source: `docs/superpowers/specs/2026-09-10-daily-digit-feedback.md` (issue #44), section "Fuzzy search (Blitz, inverted orientation)", User Stories 20–25 and 34–35, and its Testing Decisions engine-seam Search bullet.
- Glossary: `CONTEXT.md` at the repo root defines Search panel. Use that word in tests and code; avoid "dropdown"/"autocomplete"/"suggestions" for it.
- Product and architecture authority remains the daily digit feedback spec (issue #44) and the v1 design spec; this ticket is one slice of the parent spec's Fuzzy search decision.
- This spec supersedes the v1 design spec's (`docs/superpowers/specs/2026-09-08-portdle-design.md`, section 7.3) prefix-match description only: the "any token starts with the query" match rule and the name-prefix-then-alias-prefix sort. That section's cap of 20, name-only results, and description/blurb never indexed all carry forward unchanged.
- Library choice: an earlier draft of this spec chose `fuzzysort`, but that library only matches an in-order subsequence of a name and cannot match "postgers" against "PostgreSQL" or its alias "postgres" (the two transpose a letter pair, which subsequence matching can never bridge, at any threshold). `uFuzzy` was chosen instead after a throwaway spike confirmed, against the real catalogs, that its single-error typo tolerance (one substitution, transposition, insertion, or deletion) satisfies every literal test case in this spec, including "postgers". The parent spec (issue #44) was updated to name `uFuzzy` in its Fuzzy search decision and its Further Notes' Author calls line, to keep the authority trail honest.
- Author calls not covered by the parent spec or ticket #49, listed so they can be overruled: ticket #49's own title and acceptance criteria still literally name `fuzzysort` (v4) and a "score threshold" — that ticket was not edited as part of this pivot, only this spec and the parent spec (issue #44) were. This spec knowingly overrides those two literal mentions with `uFuzzy` and its single-error typo-tolerance configuration, for the reason given in the Library choice note above.
