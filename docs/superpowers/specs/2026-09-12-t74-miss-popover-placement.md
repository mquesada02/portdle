# Spec: Extract the miss popover with a placement argument

Spec for #74. Tracker: https://github.com/mquesada02/portdle/issues/74

## Problem Statement

Today `MissPopover` only knows how to sit under the Daily board's miss caption: its position and its focus-opens behavior are both hard-coded for that one spot. Spec 2's Codex screen will need the same panel — pin, hover, Escape, and outside-click all behaving the same way — hanging off a seen Codex card inside a grid instead of a text link inside a board row, positioned below the card and without opening just because a keyboard user tabbed past it. Nothing about the component today lets a second caller ask for that.

## Solution

`MissPopover` gains a required `placement` argument, `inline` or `grid`, plus a `lastColumn` flag that only matters for `grid`. `inline` is exactly today's Daily behavior: centered under the trigger below the small breakpoint, right-edge-aligned with it above the small breakpoint, and opening on focus as well as hover, click, and pin. `grid` sits the panel below the trigger, aligned to the trigger's left edge, or to its right edge when `lastColumn` is true, at every width, and drops the focus-opens rule so tabbing past the trigger stays quiet — the panel still opens on hover, click, or Enter (which activates the button's click), and still closes on Escape or an outside click, identically to `inline`. The Daily screen passes `placement="inline"` at its one call site and is otherwise untouched: nothing user-visible changes in this ticket. `grid` has no production caller yet; it exists so a future Codex ticket can hang the same popover off a card, and is proven here by a small direct-render test rather than a Daily-screen change.

## User Stories

### Miss popover

1. As a Daily player, I want the miss popover to open on hover exactly as it does today, so that this refactor changes nothing I can see or feel.
2. As a Daily player, I want the miss popover to open when I focus the trigger with the keyboard, so that the Daily row keeps working without a mouse exactly as it does today.
3. As a Daily player, I want the miss popover to open and stay open when I click the trigger, so that pinning it open still works exactly as it does today.
4. As a Daily player, I want Escape to close an open miss popover, so that dismissing it still works exactly as it does today.
5. As a Daily player, I want a click outside the trigger and panel to close the miss popover, so that dismissing it by clicking away still works exactly as it does today.
6. As a Daily player, I want the miss popover positioned and sized exactly as it is today (centered under the trigger on a phone, right-aligned with it on a wider screen, 16rem wide), so that this refactor is invisible on the Daily board.

### Maintainer

7. As a maintainer, I want `MissPopover` to accept a `placement` argument of `inline` or `grid` so that a future Codex ticket can reuse the same component for a card trigger instead of copying its state model.
8. As a maintainer, I want the `grid` placement to also accept a last-column flag, so that a future Codex ticket can flip the panel to align with the trigger's right edge for cards in the grid's last column.
9. As a maintainer, I want the `grid` placement to keep the panel's existing 16rem width, so that only its position and focus behavior differ from `inline`, not its size or content.
10. As a maintainer, I want the `grid` placement to drop the focus-opens rule while keeping hover, pin, Escape, and outside-click identical to `inline`, so that tabbing across a future Codex grid stays quiet the way Spec 2 describes, without touching any of the other interactions.
11. As a maintainer, I want the `grid` placement's Enter-to-toggle and Escape-to-close behavior covered by a small direct-render test, so that the behavior a future Codex ticket depends on is proven now, even though `grid` has no production caller yet.
12. As a maintainer, I want every existing Daily miss-popover test to keep passing with its existing assertions, so that I have evidence this ticket is a pure prefactor with no behavior change on the Daily screen.
13. As a maintainer, I want `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` to all pass, so that the extraction is proven mechanically sound before a Codex ticket builds on it.

## Implementation Decisions

### Miss popover

- `MissPopover` gains two props alongside the existing `entry`: `placement`, required, one of `"inline"` or `"grid"`; and `lastColumn`, optional, defaulting to false, read only when `placement` is `"grid"`.
- State model is unchanged and shared by both placements: the three independent booleans `pinned`, `hovered`, and `focused`; the 150ms hover-grace timer between the trigger and the panel; Escape clearing all three; a pointer-down outside both the trigger and the panel clearing `pinned` and `hovered`; a click toggling `pinned`. These mechanisms are identical in both placements and don't branch on `placement`; how `focused` factors into whether the popover is open is the one exception, covered next.
- Focus-opens is that one behavioral difference: under `inline`, focusing the trigger sets `focused` and blurring it clears `focused`, exactly as today, and `focused` counts toward whether the popover is open (open whenever `pinned`, `hovered`, or `focused` is true). Under `grid`, focus is not counted toward open at all (open whenever `pinned` or `hovered` is true), so tabbing onto and off the trigger never opens or closes the panel. Hover, pin, Escape, and outside-click are identical in both placements, per Spec 2's Codex screen section: only focus-opens and position differ between `inline` and `grid`.
- The trigger stays exactly what it is today for both placements: a `<button>` rendered by `MissPopover` itself, showing `entry.name`, styled as the Daily caption's dotted-underline text link. This ticket adds no trigger-customization prop; a future Codex ticket is expected to change how the trigger renders when it wires a card as the trigger, but that is out of scope here.
- Positioning is the other behavioral difference, expressed as Tailwind classes on the panel, both keeping its existing non-positioning styling (16rem wide, rounded border, background, padding, shadow, dark-mode colors) unchanged:
  - `inline`: unchanged from today — centered under the trigger below the 640px small breakpoint, right-edge-aligned with the trigger at and above it.
  - `grid`: below the trigger at every width, left-edge-aligned with the trigger by default, or right-edge-aligned with the trigger when `lastColumn` is true. No breakpoint-dependent switch, unlike `inline`.

### Daily screen

- `daily-page.tsx`'s `RowCaption` passes `placement="inline"` at its one `<MissPopover>` call, its only change. No other part of the Daily page is touched, since ticket #73 runs in parallel on the same file.

## Testing Decisions

A good test here exercises a public seam and asserts what a player can see or do — role, accessible name, visible text, focus — never class names, CSS, or component internals, per this repo's existing testing standard. Expected strings are literals from this ticket and its parent spec.

1. **App seam** (prior art: the existing tests in `src/ui/miss-popover.test.tsx`, which already render `<App>` with a memory store, a memory history, and an injected UTC day, and drive a Daily miss to trigger the popover). Every existing test in this file keeps its existing assertions unchanged: a catalog miss with sources renders a tappable trigger closed until opened; hovering it opens the popover with name, port, description, and a source anchor; moving the pointer from the trigger into the panel keeps it open; moving off and letting the grace timer elapse closes it; clicking the trigger toggles a pinned-open state independent of hover; focusing the trigger with the keyboard opens the popover and blur closes it; Escape closes an open popover; a pointer-down outside the trigger and panel closes it; a miss that matches nothing renders plain text with no trigger and no popover.
2. **Component-level, direct render** (prior art: the same file's existing "an entry with no sources shows no sources block" test, which already renders `<MissPopover entry={...} />` directly with a fixture `CatalogEntry` rather than through `<App>`): that existing test is updated only to pass the new required `placement="inline"` prop, with its assertions unchanged. One new test of the same shape covers the `grid` placement's focus rule, since it has no production caller to exercise it through the App seam: rendering `<MissPopover>` directly with `placement="grid"` and a fixture entry, asserting that focusing the trigger does not open the popover, that pressing Enter on the focused trigger (which activates the button, toggling the pin) opens it, and that Escape then closes it.

No visual or screenshot verification for this ticket: `grid`'s position is checked by eye once a future ticket renders it in the app, exactly as `inline`'s position is today; this ticket adds no on-screen consumer of `grid` to screenshot. No snapshot tests, no visual regression, no Playwright. This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` all passing, in addition to the coverage above.

## Out of Scope

- The Codex screen, its route, its grid, its cards, and any code that renders `MissPopover` with `placement="grid"` in the running app — this ticket only adds the argument and proves it with one direct-render test, per Spec 2's Codex screen section, which is future ticket work.
- A trigger-customization prop or any other way to make the trigger something other than the internally-rendered button — the "trigger can be a card" idea belongs to the future Codex ticket.
- Any change to the popover's content: entry name, port, description, or sources block.
- Any change to Daily-screen behavior, layout, or content beyond the one `placement="inline"` prop at `RowCaption`'s `<MissPopover>` call — ticket #73 runs in parallel on `daily-page.tsx` and this ticket's edits there stay minimal and local to that one call site.
- Any change to Blitz, History, the catalog, the schedule, or CONTEXT.md — the glossary's Miss popover entry already reads "on a miss identification or a seen Codex card," so no glossary edit is needed here.

## Further Notes

- Primary source: the ticket body of #74, and Spec 2 (`docs/superpowers/specs/2026-09-11-spec2-blitz-history-codex.md`, issue #70), Codex screen section, the sentence beginning "A seen card is a button that opens the miss popover component with that entry..." Ticket #74 implements only the extraction and the `placement` argument described there, not the Codex card or grid that will consume it.
- Glossary: `CONTEXT.md` at the repo root already defines Miss popover as "The small panel on a miss identification or a seen Codex card showing that entry's description and sources," and already defines Codex, Codex card, and Play surface — all ahead of this ticket, as part of Spec 2's glossary update. This ticket introduces no new terms and needs no glossary edit.
- Product and architecture authority remains Spec 2; this ticket is the prefactor slice of its Codex screen section, done ahead of the Codex ticket itself so that ticket's diff is smaller.
- The `placement`/`lastColumn` two-prop shape (rather than, say, a single discriminated-union prop) is a code-shape call, not a product one: Spec 2 and the ticket both describe "a placement argument" and "a last-column flag" as two separate pieces of information, and no behavior differs between either shape.
- Author call not covered explicitly by the ticket or Spec 2, listed so it can be overruled: the ticket's own "What to build" paragraph opens by saying the popover "becomes a standalone component whose trigger can be any element, not only the Daily miss caption, so the Codex ticket can hang it on a card," which could be read as asking this ticket to make the trigger itself customizable. This spec instead reads that sentence as scene-setting for the future Codex ticket, not a requirement of this one, because the acceptance criteria only ask for a `placement`/`lastColumn` argument exercised "with a button trigger" — the same internally-rendered button that exists today — and never mention a trigger prop. This ticket keeps the trigger hard-coded to that button in both placements; a future Codex ticket is expected to revisit how the trigger renders when it wires up a card.
