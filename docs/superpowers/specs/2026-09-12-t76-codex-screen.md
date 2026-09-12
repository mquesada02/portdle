# Spec: Codex screen, Codex nav item, and the How-to line

Spec for #76. Tracker: https://github.com/mquesada02/portdle/issues/76

## Problem Statement

The Codex engine and its `codex` key have shipped (#73), and the miss popover knows how to sit off a grid trigger (#74), but nothing on screen reads either yet. A player who has met a dozen services through Daily and Blitz has no page that shows what they have collected: no `???` gaps to fill, no headline counting progress, no card that reveals a name, a port, and a state once earned. The nav still has only three items, and How-to's rules say nothing about the Codex existing at all.

## Solution

The nav gains a fourth item, "Codex", after History, with a book outline icon; the tab bar returns to four equal columns. A new route, `/codex`, renders the Codex screen: an `h1`, a headline counting seen and correct entries against the catalog's totals, a Name/Port sort toggle with no route behind it, and one card grid per catalog kind, Protocols first. A seen card shows name, port, transport, and a state label with a matching left-edge accent, and is a button that opens the extracted miss popover in `grid` placement. An unseen card is an inert `???` placeholder. The screen reads the Codex map once with its fresh flags intact to render the visit, then in the same mount clears every flag and writes the map back — a Codex visit is not a play surface, so it emits no encounter. A freshly-seen card plays the board's shared pop keyframe once on mount. How-to gains a seventh rule naming the Codex. No engine or persistence logic is reimplemented: grouping, sorting, counts, and the state machine all come from the already-merged `src/engine/codex.ts`; the popover's pin/hover/focus/Escape/outside-click model and its `grid` positioning come from the already-merged `MissPopover`.

## User Stories

### Nav and shell

1. As a player, I want a Codex nav item, last in the nav, with a book outline icon, so that the Codex is one tap away on phone and desktop.
2. As a player, I want the tab bar to return to four equal columns, so that the new item fits the same way the other three do.
3. As a player, I want the Codex nav item highlighted only on its own route, so that it behaves like Blitz and History already do.
4. As a screen reader user, I want the How-to dialog to mention the Codex in one line, "The Codex collects every service you meet.", so that the rules cover every surface.

### Codex headline and sort

5. As a player, I want a headline reading "Seen {n} / {total} · Correct {m}", so that I see progress at a glance, with totals coming from the catalog rather than a literal.
6. As a player, I want a Name | Port sort toggle, defaulting to Name, so that I can browse alphabetically or by port range.
7. As a player, I want my sort choice remembered across visits, so that the Codex opens the way I left it.
8. As a player, I want an invalid stored sort value to fall back to Name, so that corrupt data never breaks the screen.

### Codex groups and cards

9. As a player, I want the Codex to show every catalog entry as a card, grouped under "Protocols" and "Applications" headings, so that the Codex has a shape.
10. As a player, I want each group heading to carry its own seen count out of its total, so that I know which catalog to work on.
11. As a player, I want an entry I have never been shown to appear as a `???` card with no port and no transport, so that the Codex has gaps to fill.
12. As a player, I want an entry I have encountered to show its name, its port large, and its transport, so that the card is the reward I earned.
13. As a player, I want each seen card to carry one state, Correct, Missed, or Identified, shown by a matching left-edge accent color and by a text label, so that the state is readable without color.
14. As a player, I want unseen cards to keep their position in either sort, so that the Codex never reorders as I fill it.
15. As a player, I want the Codex grid to be two columns on a phone, three from the small breakpoint, and four from the medium breakpoint, so that the cards read well at any width.

### Popover and interaction

16. As a player, I want to tap a seen card to open the same popover a Daily miss identification uses, with the description and sources, so that the Codex teaches as well as counts.
17. As a keyboard player, I want to open a focused card's popover with Enter and close it with Escape, so that the Codex works without a pointer.
18. As a keyboard player, I want tabbing past a card to never open its popover, so that moving through the grid with a keyboard stays quiet.
19. As a player, I want clicking outside an open popover to close it, so that dismissing it works the way it does on the Daily board.
20. As a player, I want unseen cards to be inert and skipped by keyboard focus, so that nothing leaks and nothing is a dead stop.

### Motion and freshness

21. As a player, I want cards that became seen since my last Codex visit to pop once when the page opens, so that new finds are noticed.
22. As a player who prefers reduced motion, I want the Codex card pop to be skipped, so that the existing reduced-motion rule holds.
23. As a player, I want my next Codex visit to find no cards popping for entries I already saw last time, so that the pop always means "new since I last looked."

### Maintainer

24. As a maintainer, I want the Codex screen to read the stored map, grouping, sorting, and counts entirely through the existing Codex engine module and existing seam, so that no state machine, grouping, sorting, or count logic is duplicated in the UI.
25. As a maintainer, I want the Codex screen to be the miss popover's first production `grid`-placement caller with no change to the popover component itself, so that #74's extraction is validated as shipped.
26. As a maintainer, I want a Codex visit to write through the existing synchronous, validated persistence seam, and a write failure to raise the existing "Progress may not save." notice without blocking the view, so that storage failures never break browsing.
27. As a maintainer, I want the new `codexSort` key versioned under the existing prefix and validated on read, so that corrupt data in it never breaks another key.
28. As a maintainer, I want the existing three-nav-link Shell tests updated to four links with Codex last, so that the suite matches what the app now does.

## Implementation Decisions

### Codex engine reuse

- No change to `src/engine/codex.ts`. The Codex screen calls its existing exports only: `codexGroups({ map, protocols, applications, sort })` for the two ordered, per-kind card lists (already a stable partition that keeps unseen entries at their original catalog-array index in both sorts); `codexCounts({ map, protocols, applications })` for the overall and per-kind seen/correct counts; `clearCodexFresh(map)` for the mount-time write-back. `applyCodexEncounter` is not called anywhere on this screen — a Codex visit is not a play surface, so nothing is written as an encounter, per Spec 2's encounter table ("Viewing the Codex" → "nothing").
- The catalog totals the headline and each group heading divide against (`protocols.length`, `applications.length`, and their sum) come from the production catalog arrays already imported elsewhere (`src/catalogs/production.ts`), not from literals; today these are 74 overall, 48 Protocols, 26 Applications.

### Persistence

- `src/engine/types.ts` gains `export type CodexSort = "name" | "port";`, co-located with the existing `CodexState`/`CodexRecord`/`CodexMap`/`CodexEncounter` types.
- `src/persist/storage.ts` gains one new key, `portdle:v1:codexSort`, alongside the existing keys, and `isCodexSort`, `readCodexSort(): CodexSort`, and `writeCodexSort(value: CodexSort): { ok: true } | { ok: false }` on `Persist`, following the exact pattern `isTheme`/`readTheme`/`writeTheme` already use: a value that is not exactly `"name"` or `"port"` (including missing, corrupt JSON, or any other value) reads as `"name"`, and neighboring keys are untouched by a read or a write of this key.
- The Codex map read/write continues to go through the existing `readCodex`/`writeCodex`, unchanged.

### Codex screen composition

- One new file, `src/ui/codex-page.tsx`, exporting `CodexPage`, matching how `daily-page.tsx` and `blitz-page.tsx` each hold their whole screen's markup and small helper components in one file rather than splitting into many.
- On mount, the page captures the stored Codex map once (`useState(() => persist.readCodex())`), with every fresh flag as stored, and renders from that captured value for the whole visit. A mount-only effect writes `clearCodexFresh` of that same captured map back through `persist.writeCodex`; a write failure sets the existing save-warning state, surfacing the shared "Progress may not save." notice, exactly as `daily-page.tsx`'s and `blitz-page.tsx`'s own write-failure handling already does. This satisfies Spec 2's rule: the screen renders the visit with flags intact, then clears them in the same mount, so cards pop from the values read and the next visit finds no flags.
- The sort choice is read once on mount (`useState(() => persist.readCodexSort())`) and written through `persist.writeCodexSort` on every change, with the same save-warning handling on failure.
- The Sort toggle is a group of two native radio inputs, named "Sort" (a `<fieldset>` with a visually-hidden `<legend>`, following `daily-page.tsx`'s existing `TrackerStrip` fieldset/legend pattern), styled to look like the Daily switcher's and History switcher's segmented control (the underline-segment classes `daily-page.tsx`'s `DailySwitcher` and `history-page.tsx`'s `HistorySwitcher` already use) rather than `blitz-page.tsx`'s rounded `Pill` radios — the same underline-segment visual, but built from radio inputs sharing one `name` attribute instead of routed `Link`s, since this toggle has no route behind it. Each option ("Name", "Port") is a `<label>` wrapping a visually-hidden (`sr-only`) radio input plus the visible option text, exactly as `blitz-page.tsx`'s existing `Pill` component already wraps its radio inputs, so each option's accessible name is its visible label text and its checked state is native radio state.
- Top to bottom: the `h1` "Codex"; the shared `ProgressNotice` (placed directly under the `h1`, matching where `daily-page.tsx` and `blitz-page.tsx` already place it relative to their own heading, even though neither Spec 2's nor this ticket's top-to-bottom description calls it out explicitly, since it is conditional, failure-only UI rather than a fixed element of the visit); the headline paragraph "Seen {n} / {total} · Correct {m}"; the Sort toggle; then one `section` per catalog kind in the order `codexGroups` already returns (Protocols before Applications).
- Each section holds an `h2` reading "{Kind} {n} / {total}" (e.g. "Protocols 12 / 48", using a new two-entry local label map `{ protocol: "Protocols", application: "Applications" }` — not the existing `CATEGORY_LABEL` from `src/engine/share.ts`, which is keyed by `DailyCategory`'s plural strings `"protocols"`/`"applications"` rather than `CatalogKind`'s singular `"protocol"`/`"application"`) and a card grid: a `<ul>` given an id-linked `aria-labelledby` pointing at that `h2`'s id, so the grid is named by its heading exactly the way `history-page.tsx`'s existing grouped lists are named by their date headings. The grid is two columns below the small breakpoint, three at the small breakpoint, four at the medium breakpoint, matching the breakpoints the rest of the redesign already uses.
- Each card renders inside its own `<li>`. Because `MissPopover`'s outer wrapper (`<span className="relative inline-block" data-popover={id}>`) is not configurable via a className prop, and this ticket does not touch `miss-popover.tsx`, each `<li>` is itself a single-cell CSS grid (`className="grid"`); this blockifies and stretches its one child (the `MissPopover` wrapper span for a seen card, or a plain `div` for an unseen one) to fill the cell, regardless of that child's own declared display, with no change to the popover component.
- The grid's current column count (2, 3, or 4) is tracked in a small hook backed by two `matchMedia` listeners at the small and medium breakpoints, matching the same breakpoints that set the CSS column count. Each card's `lastColumn` flag is `index % columnCount === columnCount - 1`, computed from the card's position within its group and that column count, per Spec 2's rule that the card learns its column from its index and the grid's current column count so the popover never leaves the grid. This hook has no seam test: per #74's spec, `grid` placement is checked by eye in screenshots, and the existing `stubMatchMedia` test helper resolves every non-dark-scheme query to `false`, so app-seam tests always see the smallest column count regardless of this hook's real-browser behavior.

### Cards

- A seen card is a `<button>`, supplied to `MissPopover` as its `trigger` render prop (spreading the interaction-wiring bundle `MissPopover` passes in), with `placement="grid"` and the computed `lastColumn`. This is `MissPopover`'s first production `grid`-placement caller; no change to `miss-popover.tsx` is needed, since the `placement`/`lastColumn`/`trigger` mechanism already implements every rule this ticket needs (focus alone does not open it; Enter or click toggles the pin; hover, Escape, and outside-click behave as they do on the Daily board).
- The seen card's visible content, in order, is: the entry's name; its port, large, in monospace; a transport badge showing the same text the Reveal's badge already shows (`src/ui/daily-reveal.tsx`'s `transportLabel` function gains the `export` keyword, its only change, so the Codex card imports and reuses that text; the Reveal's `Badge` visual component itself is not shared, since only the text is specified as reused and the codebase's existing precedent, `history-page.tsx`'s own `BlitzBadge`, is for each screen to own its badge markup); and the state label ("Correct", "Missed", or "Identified"). Each of these four pieces is a separate visible child, with a literal `{" "}` space between each pair in the JSX, so the button's accessible name — computed from its visible content — is deterministically "{name} {port} {transport} {state label}" joined by single spaces, per the ticket's accessible-name contract.
- The card's left edge carries a color matching its state: emerald for Correct, rose for Missed, zinc for Identified, implemented as a `border-l-{color}` utility layered over a neutral all-sides border (a standard Tailwind pattern: the more specific single-side color utility overrides the general one in the generated stylesheet).
- A card whose `fresh` flag is `true` (as captured at mount, before the write-back clears it) plays the existing `.animate-pop` class from `src/styles.css` — the same 150ms keyframe the board's tiles use — with no per-card stagger; the existing reduced-motion media query already zeroes all animations, so no extra handling is needed here.
- An unseen card is a non-interactive `<div>` with `role="img"` and `aria-label="Unseen"`, following the same shape as the board's tiles (`role="img"` with a visible glyph and a separate `aria-label`; the glyph needs no `aria-hidden`, since `role="img"` already excludes children from the accessibility tree). It shows `???`, large, in monospace, in place of the port, with no name, no transport badge, and no interactive affordance — a plain `<div>` has no default focusability, so it is skipped by keyboard focus without any explicit `tabIndex`.

### Shell and nav

- `src/ui/shell.tsx`'s `NAV` array gains a fourth entry, `{ to: "/codex", label: "Codex", icon: BOOK, matchPaths: ["/codex"] }`, after History, using a new hand-authored `BOOK` path constant — a single `d` string (an open-book glyph, its two mirrored page-halves each their own `M...z` subpath) rendered through the existing shared `NavIcon` component, in the same hand-authored, stroke-based style (viewBox 24, `stroke="currentColor"`, `strokeWidth="1.8"`, `fill="none"`, round caps and joins) as the existing `GRID`/`BOLT`/`CLOCK`/`HELP` constants — those four vary in their own subpath counts (`GRID` has four, `HELP` three, `CLOCK` two, `BOLT` one), so "two-subpath" describes only the new `BOOK` constant's own shape, not a rule the existing four already follow. No icon library is introduced; none is used anywhere else in this codebase. The tab bar's `grid-cols-3` becomes `grid-cols-4`, the only other change to this file.
- `src/router.tsx` gains a `codexRoute` (path `/codex`, rendering `CodexPage`), added to the route tree.
- `src/ui/how-to-copy.tsx`'s `HOW_TO_RULES` array gains a seventh, final string: "The Codex collects every service you meet.", read by both the How-to dialog and (mechanically, since the two share this one list) anywhere else that already renders it.

## Testing Decisions

A good test exercises a public seam with literal inputs and asserts what a player sees or what a pure function returns; it does not read class names, colors, or library internals. Expected values are literals from this spec and Spec 2. This ticket adds no engine-seam tests: `src/engine/codex.ts` is unchanged and already covered by `src/engine/codex.test.ts` from #73, and this ticket calls its exports without modifying their behavior.

1. **Persist seam** (extend `src/persist/storage.test.ts`, following the file's existing `codex...`-key test cluster and its `isTheme`/`readTheme` prior art).
   - `codexSort` missing reads as `"name"` and round-trips `"port"`; a stored value outside `"name"`/`"port"` (and corrupt JSON) reads as `"name"`; writing or corrupting the `codexSort` key does not touch or clear any neighboring key (theme, a Daily, the Codex map, Blitz bests); a write failure returns `{ ok: false }`.
2. **App seam** (render the app with a memory store, memory history, and an injected UTC day; prior art: `src/ui/app.test.tsx`, `src/ui/history-page.test.tsx`, `src/ui/miss-popover.test.tsx`, `src/ui/blitz-runs.test.tsx`).
   - Codex, empty map: every card reads `???`; the headline reads "Seen 0 / 74 · Correct 0" (the catalog's current totals); the "Puzzle unavailable" and Blitz/History flows are unaffected.
   - Codex, seeded map: the matching cards show name, port, transport, and state label text for each of Correct, Missed, and Identified; each group heading carries its own seen count out of its own total (e.g. a map with two seen Protocols entries and one seen Applications entry reads "Protocols 2 / 48" and "Applications 1 / 26").
   - Unseen cards carry the accessible name "Unseen" via their `img` role and are not in the tab order; clicking a seen card's button opens a note with that entry's description and sources; Enter on a focused seen card opens it; Escape closes it.
   - The Sort toggle is a group named "Sort" with options "Name" and "Port"; choosing "Port" reorders the seeded cards by port (ties by case-folded name) and persists that choice through a re-render; choosing "Name" restores the default order; an unseen card keeps its position under both.
   - A card seeded with `fresh: true` renders normally on this mount (no assertion on the animation itself — Spec 2's Motion section keeps motion outside the seam tests, and this Testing Decisions section's own opening rule already excludes asserting class names or library internals); after the page has mounted, every record in the store's Codex map reads `fresh: false`, including ones that were `true` before the visit and ones seeded already `false`.
   - Visiting the Codex leaves every stored Codex state (`state` field) exactly as seeded — only `fresh` flags change; no `state` value moves as a result of the visit.
   - Shell: the nav has exactly four links, in order Daily, Blitz, History, Codex; the Codex link is marked current only on its own route; the existing "nav links ... present for keyboard users" test's hardcoded name list becomes `["Daily", "Blitz", "History", "Codex"]`; the existing per-route active-link and per-route-heading tests gain a `/portdle/codex` case (heading "Codex", active only there); the How-to dialog lists seven rules, the seventh reading exactly "The Codex collects every service you meet."

No snapshot tests, no visual regression, no Playwright. Column counts, card accents, the popover's `grid` placement (including the last-column right-alignment), and the pop animation are verified by eye in screenshots at phone (375×812) and desktop (1024×800) widths, per this ticket's acceptance criteria — not by a seam test, matching how #74 already left `grid` placement to eyes-on verification. This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` all passing, plus the seam coverage above and the screenshot pass.

## Out of Scope

- Any change to `src/engine/codex.ts`, its types, or its tests — #73's engine module is consumed as-is.
- Any change to `src/ui/miss-popover.tsx` or its tests — #74's `placement`/`lastColumn`/`trigger` mechanism is consumed as-is; this ticket is its first production `grid` caller, not a second iteration on it.
- The Blitz arena, setup dialog, round log, or any change to `src/ui/blitz-page.tsx` — ticket #77 runs in parallel on that file.
- A Codex detail dialog with dates, state history, or where an entry was first seen.
- Removing the accepted port-order leak of unseen Codex cards in either sort.
- Any change to Daily or Blitz rules, the schedule, the catalog, or the miss popover's content (name, port, description, sources).
- Backfilling the Codex from play that happened before #73 shipped — already out of scope there, unaffected here.

## Further Notes

- Primary sources: the body of issue #76 "Codex screen, Codex nav item, and the How-to line"; Spec 2 (`docs/superpowers/specs/2026-09-11-spec2-blitz-history-codex.md`, issue #70), its "Codex screen" implementation-decisions subsection, the "Codex" and "Shell, accessibility, motion" User Stories groups, the Copy and Motion sections, and its Testing Decisions' Codex and Shell bullets; the ticket specs for #73 (`2026-09-12-t73-codex-engine.md`) and #74 (`2026-09-12-t74-miss-popover-placement.md`), whose shipped code this ticket builds directly on and does not modify.
- Glossary: `CONTEXT.md` already defines Nav (now four items), Tab bar, Codex, Codex card, Sort toggle, Miss popover (already broadened to "a miss identification or a seen Codex card"), Unseen, Seen, Identified, Missed, Correct, Encounter, Play surface, How-to. This ticket introduces no new glossary terms and needs no glossary edit; it uses "Seen" only as the umbrella state, never as a synonym for Identified alone, matching the glossary.
- ADR 0001 ("localStorage until a backend") continues to hold unchanged: the new `codexSort` key is plain JSON behind the existing synchronous seam, versioned under the existing `portdle:v1:` prefix.
- Author calls not covered by the ticket or Spec 2, listed so they can be overruled: the single-file `src/ui/codex-page.tsx` shape (matching `daily-page.tsx`/`blitz-page.tsx`'s existing per-screen file convention) rather than splitting the card, the sort toggle, and the page into separate files; the new local `{ protocol: "Protocols", application: "Applications" }` label map rather than reusing or reshaping the existing `CATEGORY_LABEL` (different key domains — `CatalogKind` vs `DailyCategory`); `ProgressNotice`'s placement directly under the `h1`, mirroring Daily's and Blitz's placement since Spec 2's Codex top-to-bottom list does not mention it either way; each grid `<li>` being its own single-cell CSS grid so `MissPopover`'s fixed-class wrapper span stretches to fill it, chosen over changing `miss-popover.tsx` to accept a wrapper className (out of this ticket's scope) or over any other CSS-only workaround; the card's four visible pieces separated by explicit `{" "}` JSX space nodes rather than relying on implicit accessible-name whitespace-joining, to make the exact "{name} {port} {transport} {state label}" contract robust; the hand-authored `BOOK` icon path, since the ticket specifies only "a book outline icon in the style of the existing nav icons" and no icon library exists in this codebase to draw from; exporting only `transportLabel` (not the Reveal's `Badge` component) from `daily-reveal.tsx`, since the spec's Copy section says the transport badge text is reused, not the component, and `history-page.tsx`'s own separately-styled `BlitzBadge` is existing precedent for each screen owning its badge markup.
