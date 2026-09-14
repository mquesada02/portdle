# Spec: Motion — Codex sort reorder

Spec for #94. Tracker: https://github.com/mquesada02/portdle/issues/94. Parent: Spec 3, #87. Blocked by #93 (merged).

## Problem Statement

Changing the Codex sort toggle between Name and Port jumps every one of the catalog's seventy-four cards to its new slot in one frame. Ticket #93 built the shared view-transition helper, `runViewTransition`, and proved it out for the Blitz screen's phase changes; nothing yet calls it from the Codex screen, and the stylesheet has no `reorder`-type rules at all.

## Solution

Changing the Codex sort runs the state update through `runViewTransition` with the `reorder` type. Each card whose slot changes glides to its new position over 200ms with the browser's default easing; a card whose slot does not change gets no motion; the rest of the Codex screen — the headline, the counts, the sort toggle itself, the group headings — holds still, exactly as `screen` holds still under every other type. Browsers without the View Transitions API reorder instantly, as today. The fresh-card pop on a newly-encountered entry is unchanged and still plays only on mount.

## User Stories

Renumbered sequentially for this ticket; each traces back to Spec 3 (`docs/superpowers/specs/2026-09-13-spec3-motion-polish.md`, issue #87).

1. As a Codex reader, I want cards to glide to their new positions when I switch the sort between Name and Port, so that I can follow where an entry went.
2. As a Codex reader, I want a card whose position does not change to stay still rather than replay any motion, so that only what actually moved draws my eye.
3. As a Codex reader, I want the headline, the seen counts, the sort toggle, and the group headings to hold still while cards glide, so that only the cards move.
4. As a Codex reader, I want a fresh card's pop to keep working as it does today, so that new finds still feel rewarding.
5. As a Codex reader on a browser without the View Transitions API, I want the sort to reorder instantly as today, so that the toggle always works.
6. As a player who has asked my system to reduce motion, I want none of this transition to play, so that the app respects my setting as it already does for the board.
7. As a screen reader user, I want this transition to change nothing about what is announced or when, so that motion stays purely visual.
8. As a Codex reader, I want the cards to hold still, with no individual crossfade, when I navigate to or from the Codex screen, so that the screen's own fade-and-rise motion is the only thing that plays there.
9. As a maintainer, I want the Codex sort reorder to reuse the shared helper from ticket #93 without changing it, so that the Blitz phase changes and the Codex reorder do not each reimplement the fallback.
10. As a maintainer, I want the view-transition stylesheet rules this ticket adds to pass lint without weakening the linter for the rest of the stylesheet, so that the linter keeps its value.

## Implementation Decisions

### Card naming

Each Codex card's outermost element — the grid's `<li>`, keyed on `card.entry.id`, in `CodexPage`'s `group.cards.map((card, index) => ...)` loop — gains a `codex-{id}` view-transition name built from its entry's id, set through the element's `style` attribute (`viewTransitionName: \`codex-${card.entry.id}\``), not a Tailwind arbitrary-property utility class. Tailwind arbitrary properties only hold a static value baked in at build time — the codebase's existing view-transition names are all fixed strings this way (`screen`, `switcher-content`) — but each card's name is dynamic per entry, so it must be set at runtime through `style`. `csstype`, which backs React's `CSSProperties`, types `viewTransitionName` as a plain string-accepting property, so this needs no cast. This is the only change to the file's JSX; the sort-change rewrite below is a separate, non-markup change to `handleSortChange`'s body.

### Reorder CSS mechanism

Under the `reorder` type, each card's group tween and its snapshots' default crossfade are shortened from the browser's 250ms default to 200ms, keeping the browser's default easing (the `ease` keyword) rather than a custom keyframe — per Spec 3's Durations-and-easing decision, which says the reorder type "keeps the browser's default easing for the cards' group tween and their crossfade alike." This rules out writing a custom `fade`/`rise`-style keyframe for the cards, the way `screen` and `switcher-content` do under their own types: those regions want a *specific* motion (fade out, rise in) replacing the browser's default; the cards want the browser's *own* default motion, merely shortened. Since `root` and `screen` are the only other named regions still zeroed under this type (below) and nothing else is left running at the browser's 250ms default, the `reorder` transition ends with the 200ms glide, matching Spec 3's Durations-and-easing decision.

The stylesheet reaches every card without enumerating each `codex-{id}` by targeting the universal pt-name-selector, `*`, under `:root:active-view-transition-type(reorder)`, on `::view-transition-group(*)`, `::view-transition-old(*)`, and `::view-transition-new(*)`, setting only the `animation-duration` longhand (`200ms`) — never the `animation` shorthand:

```css
:root:active-view-transition-type(reorder)::view-transition-group(*),
:root:active-view-transition-type(reorder)::view-transition-old(*),
:root:active-view-transition-type(reorder)::view-transition-new(*) {
	animation-duration: 200ms;
}
```

This is the load-bearing detail: the browser's default group tween and crossfade run under auto-generated animation names that author CSS cannot reference directly; setting only `animation-duration` leaves `animation-name` untouched, so those default animations keep running, just shortened. Writing the full `animation` shorthand instead would reset the unlisted `animation-name` to its initial value, `none`, silently killing all card motion.

An alternative was considered and rejected: giving the cards a shared `view-transition-class` (a newer, Level-2 CSS property that groups differently-named regions under one class so a single `::view-transition-group(*.classname)` selector can target them together) instead of the plain `*` selector. It was rejected because it adds a second per-card CSS declaration and depends on a less-widely-supported feature for no behavioral benefit over `*` here, which already exists in every browser that has the View Transitions API at all — the same `*` selector this stylesheet's reduced-motion block already uses to reach every named region universally.

The `*` selector above matches every named group present during a `reorder` transition, including `root` and `screen`, both of which must hold still under this type. This is safe because CSS cascades per longhand property, not per rule: `root`'s pre-existing untyped no-animation rule (`::view-transition-group(root)` and its old/new siblings, from ticket #89, using the `animation` shorthand) and the new `reorder`-scoped no-animation rule for `screen` (below) are the only rules anywhere in the stylesheet that set the `animation-name` longhand for those two regions; this wildcard rule never sets `animation-name` at all, only `animation-duration`. So regardless of selector specificity or source order between this rule and those no-animation rules, `animation-name` for `root` and `screen` always resolves to `none` from their own dedicated rules, and an element with `animation-name: none` runs no animation — this rule's `animation-duration: 200ms` on those two elements has nothing to apply to.

### `screen` no-animation under `reorder`

Separately from the wildcard rule above, the Codex cards' own region needs `screen` explicitly held still under `reorder` — the acceptance criteria's "screen carries the no-animation rule" — mirroring the existing `:root:active-view-transition-type(switcher)` block's shape exactly, scoped to `reorder` instead:

```css
/* biome-ignore lint/correctness/noUnknownTypeSelector: "screen" names a view-transition region, not an element type */
:root:active-view-transition-type(reorder)::view-transition-group(screen) {
	animation: none;
}
/* biome-ignore lint/correctness/noUnknownTypeSelector: "screen" names a view-transition region, not an element type */
:root:active-view-transition-type(reorder)::view-transition-old(screen),
/* biome-ignore lint/correctness/noUnknownTypeSelector: "screen" names a view-transition region, not an element type */
:root:active-view-transition-type(reorder)::view-transition-new(screen) {
	animation: none;
	mix-blend-mode: normal;
}
```

This is its own separate three-line block, not merged into a type list with `switcher`'s — Spec 3's Stylesheet-and-lint decision's own worked count (nine `screen`-naming lines once every Spec 3 type exists: three shared between `screen` and `phase`, three for `switcher`, three for `reorder`) treats `switcher` and `reorder` as separate blocks; they only share the goal of zeroing `screen`, not a reason to share a parent rule, unlike `screen` and `phase`, which share because they want the identical non-zero animation. Each of the three lines still names `screen` inside a view-transition pseudo-element and needs its own `biome-ignore lint/correctness/noUnknownTypeSelector` comment directly above it, bringing the stylesheet's running total from six such lines (three shared `screen`/`phase`, three `switcher`) to nine — eleven once the "Codex cards hold still under the `screen` type" section below adds its own two. The wildcard-rule block above needs no ignore, since `*` never triggers the rule.

### Codex cards hold still under the `screen` type

The acceptance criteria's remaining clause — "under the `screen` type, the Codex cards carry the no-animation rule" — needs a separate rule from the two above, because it is scoped to a *different* type (`screen`, not `reorder`) and reached only by `*`, since a screen change into or out of the Codex route touches every `codex-{id}` region at once (an "add" transition when the Codex route is the destination, a "remove" transition when it's the origin), the same way a screen change touches `switcher-content` when the destination or origin has one:

```css
:root:active-view-transition-type(screen)::view-transition-group(*) {
	animation: none;
}
:root:active-view-transition-type(screen)::view-transition-old(*),
:root:active-view-transition-type(screen)::view-transition-new(*) {
	animation: none;
	mix-blend-mode: normal;
}
/* biome-ignore lint/correctness/noUnknownTypeSelector: "screen" names a view-transition region, not an element type */
:root:active-view-transition-type(screen)::view-transition-old(screen),
/* biome-ignore lint/correctness/noUnknownTypeSelector: "screen" names a view-transition region, not an element type */
:root:active-view-transition-type(screen)::view-transition-new(screen) {
	mix-blend-mode: plus-lighter;
}
```

The wildcard `*` in the first two rules also matches the `screen` pseudo-element itself (present in every `screen`-type transition, not only ones touching Codex), so a third, `screen`-specific rule restores what the wildcard's `mix-blend-mode: normal` would otherwise leave broken: nothing else in the stylesheet ever sets `screen`'s `mix-blend-mode` under the `screen` type — the pre-existing `screen, phase` block (ticket #89) only declares `animation`, never `mix-blend-mode` — so without this third rule, `screen`'s browser-default additive blend (`plus-lighter`, the View Transitions API's own default for old/new snapshots, restated explicitly here since nothing else does) would be silently zeroed on every screen change anywhere in the app, not just ones touching Codex, contradicting Spec 3's Technique decision ("every snapshot that animates keeps the browser's additive blend... `screen` under the `screen` and `phase` types").

None of the three rules above needs to be placed relative to the pre-existing `screen, phase` block in any particular order, and this whole block can simply be appended alongside this ticket's other two, because named and universal pt-selectors are not equally specific: per the CSS View Transitions Level 2 specification (`https://www.w3.org/TR/css-view-transitions-2/`, §4.4, "Additions to named view transition pseudo-elements" — the same level that defines `:active-view-transition-type()` itself, which every type-scoped rule in this stylesheet already depends on), a named view-transition pseudo-element selector — one whose argument is a `<custom-ident>`, such as `::view-transition-old(screen)` — has the specificity of a type selector, while the same pseudo-element with a bare `*` argument has *zero* specificity. So `:root:active-view-transition-type(screen, phase)::view-transition-old(screen)` is unconditionally more specific than `:root:active-view-transition-type(screen)::view-transition-old(*)`, regardless of which comes first in the file: the pre-existing `screen, phase` block's `animation` declaration always wins on `screen`'s `animation-name`, and this ticket's own restorative rule (also named, `::view-transition-old(screen)`/`::view-transition-new(screen)`) always wins on `screen`'s `mix-blend-mode` over this same block's own wildcard rules, for the identical reason. `root` and `switcher-content`, also matched by the wildcard, are unaffected either way: `root`'s `animation-name` is already `none` from its own untyped rule (also unconditionally more specific than this wildcard, being named), and `switcher-content`'s existing screen-type rule (ticket #92, also named) sets the identical `none` value this wildcard would set regardless.

So all of ticket #94's `src/styles.css` work — the two `reorder`-type blocks above and this three-rule `screen`-type block — is appended together at one location: immediately after the existing `switcher`-type screen-zeroing block and before the `/* --- #92: switcher-content region --- */` comment, under one `/* --- #94: reorder region and screen-type Codex cards --- */` comment, following the file's existing per-ticket section-comment convention (mirroring how `/* --- #91: dialogs and Rounds disclosures --- */` names all of that compound section's content). Nothing existing in the file is edited, removed, or reordered. The root's untyped no-animation rule already covers every type, `reorder` and `screen` alike, so it needs no change.

### Sort-change rewrite

`handleSortChange` in `codex-page.tsx` changes from committing `setSort` first and persisting after, to persisting first and running only the state change through the helper:

```ts
function handleSortChange(next: CodexSort) {
	const result = persist.writeCodexSort(next);
	if (!result.ok) {
		setSaveWarning(true);
	}
	runViewTransition(["reorder"], () => {
		setSort(next);
	});
}
```

Only `setSort(next)` — the state change that actually reorders the DOM — runs inside the helper's update callback. `persist.writeCodexSort` and its failure's `setSaveWarning(true)` move ahead of the `runViewTransition` call. This exactly mirrors ticket #93's own precedent for Blitz's `applyResult`, where `recordEncounters`/`setSaveWarning` stay before the phase-change commit: the persist write has no dependency on React render state (it takes `next` directly, not the `sort` state), and `runViewTransition`'s `flushSync` flushes whatever React work is already pending at the moment it runs — so a `setSaveWarning` update queued immediately beforehand in the same handler still commits in the same synchronous batch as the sort change, preserving Spec 3's Technique decision that a view transition changes nothing about what the DOM contains or when, so every live region (here, the Codex screen's `ProgressNotice`) keeps its existing timing. `runViewTransition` is imported from `./view-transition`.

No other part of `codex-page.tsx` changes: `codexGroups`/`codexCounts` (`src/engine/codex.ts`), the mount effect, `useColumnCount`, `SortToggle`/`SortOption`, and `SeenCard`/`UnseenCard` are untouched beyond the one `<li>` style addition above.

### Test helper

`codex-page.test.tsx`'s local `renderCodex` gains a `reducedMotion` option threaded into `stubMatchMedia`, mirroring the `reducedMotion` option ticket #93 added to `blitz-arena.test.tsx`/`blitz.test.tsx`'s `renderBlitz` (itself mirroring `app.test.tsx`'s `renderApp`, from ticket #89): `stubMatchMedia(false, options.reducedMotion ?? false)` replaces today's bare `stubMatchMedia()`; the options type gains `reducedMotion?: boolean`. Every existing call site keeps compiling and passing unchanged, since the new option defaults to `false`.

### Copy

No new strings.

## Testing Decisions

A good test exercises a public seam with literal inputs and asserts what a player sees or what a pure function returns. How the motion looks is checked by eye, not by a test, per Spec 3's Testing Decisions; whether, and with which type, the helper asks for a view transition is tested through the same fake of the View Transitions API tickets #89 and #93 already established (`stubViewTransitions`, `src/test/helpers.ts`). This ticket touches one seam.

1. **App seam** (`codex-page.test.tsx`; render the app with a memory store, memory history, and the injected `UTC_TODAY`, following this file's existing `renderCodex` pattern).
   - Every existing test keeps passing unchanged, aside from the mechanical `reducedMotion`-threading edit to `renderCodex` described above, which changes no existing call site's behavior.
   - New, placed next to the existing `"Sort toggle reorders by port and persists across a remount; Name restores the default order; an unseen card keeps its position"` test, each installing `stubViewTransitions()` after `renderCodex` and calling `restore()` in a `finally`:
     - Changing the sort (clicking the `"Port"` radio) records one call with `["reorder"]`.
     - With `reducedMotion: true` passed to `renderCodex`, changing the sort still takes effect (`persist.readCodexSort()` reads `"port"`) and records no call.

No snapshot tests, no visual regression, no Playwright. This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` all passing, plus confirming by eye in the built CSS that the `reorder`-type rules and the `screen`-type Codex-cards block are all present under the single `/* --- #94: reorder region and screen-type Codex cards --- */` comment, and that `pnpm lint` reports no unused suppression.

## Out of Scope

- The `switcher`, `phase`, and `switcher-content` rules in `src/styles.css` — #92's and #93's work, already merged, untouched by this ticket.
- Any change to `src/engine/codex.ts`'s sort or grouping logic — already correct per ticket #85, merged, which sorts every card, unseen included.
- A `view-transition-class` on the cards — considered and rejected above in favor of targeting `*`.
- The fresh-card pop (`.animate-pop`) — unchanged, plays only on mount per `SeenCard`'s existing `fresh` check.
- A polyfill for browsers without the View Transitions API, and any motion library or spring physics.

## Further Notes

- Primary sources: issue #94's body; Spec 3 (`docs/superpowers/specs/2026-09-13-spec3-motion-polish.md`, issue #87), its Technique, Codex sort reorder, the `reorder` parts of Durations and easing, Reduced motion and fallbacks, and Stylesheet and lint decisions, and its Helper testing bullet; the merged ticket specs `docs/superpowers/specs/2026-09-14-t89-screen-changes.md` (issue #89, for the `screen` region, the stylesheet/lint conventions, and the root's untyped no-animation rule) and `docs/superpowers/specs/2026-09-14-t93-blitz-phases.md` (issue #93, for `runViewTransition` itself and its `applyResult`/`setSaveWarning` ordering precedent this ticket reuses); the CSS View Transitions Module Level 2 specification (`https://www.w3.org/TR/css-view-transitions-2/`, §4.4, "Additions to named view transition pseudo-elements"), read directly to confirm that a named view-transition pseudo-element selector has the specificity of a type selector while the same pseudo-element with a `*` argument has zero specificity; `src/ui/codex-page.tsx`, `src/ui/codex-page.test.tsx`, `src/ui/view-transition.ts`, `src/styles.css`, `src/test/helpers.ts`, and `src/engine/codex.ts` as they stand on `master` after ticket #93 merged.
- Glossary: `CONTEXT.md` gains no terms; this ticket introduces no player-facing copy or renamed concept. The type name `reorder` and the region name `codex-{id}` are motion names local to Spec 3, not domain terms, as Spec 3's own Further Notes already state.
- ADR 0001 ("localStorage until a backend"), the only ADR in `docs/adr/`, is unaffected: it is about persistence, not motion or rendering.
- Author calls not covered by the ticket or Spec 3, listed so they can be overruled:
  - Targeting the universal `*` pt-name-selector under the `reorder` type, setting only `animation-duration`, rather than giving the cards a shared `view-transition-class` — see Reorder CSS mechanism above.
  - Adding a third, `screen`-specific rule restoring `mix-blend-mode: plus-lighter` on `screen`'s own old/new snapshots under the `screen` type, since the cards-hold-still wildcard rule would otherwise leave it unset by anything else — see Codex cards hold still under the `screen` type above.
