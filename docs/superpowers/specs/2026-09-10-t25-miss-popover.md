# Spec: Miss popover and sources

Spec for #25. Tracker: https://github.com/mquesada02/portdle/issues/25

## Problem Statement

A player who misses with a port that belongs to another catalog entry sees that entry's name next to the row, but it is inert plain text. There is nowhere to learn more about the service — what it does, or where to read a primary source about it — without leaving the game and searching elsewhere. Maintainers, meanwhile, have no way to attach a source to a catalog entry at all: the schema has no field for one, so even if the UI could show sources, nothing could supply them.

## Solution

An identified miss's name becomes a tappable trigger. Hovering it on desktop opens the miss popover directly under it, showing the entry's name, port, description, and any sources; the pointer can move from the trigger into the popover without it closing, so a source is reachable. Tapping the trigger on a phone toggles the popover open and closed; tapping outside it closes it. Focusing the trigger with a keyboard opens it, and Escape closes it. A source opens in a new tab. A miss that matches nothing keeps its plain-text "Not in this catalog." caption with no trigger and no popover. The popover appears only on the Daily screen.

Catalog entries gain an optional `sources` list, each a label and a URL. Catalog validation rejects a source with an empty label or a URL that does not start with `https://`, so a bad source fails the same checks that already gate the schedule generator and CI. `sources` is flavor, like description and blurb: editable at any time, and no part of the frozen prefix rules that guard a Daily's committed name and port. At least one production entry ships with real sources so the popover has something to demo.

## User Stories

### Miss popover

1. As a player, I want the name of a catalog miss to look tappable, so that I know there is more behind it.
2. As a desktop player, I want hovering the name to open the miss popover under it with the entry's name, port, description, and sources, so that I learn about the service I typed.
3. As a desktop player, I want to move the mouse from the name into the popover without it closing, so that I can open a source.
4. As a phone player, I want tapping the name to open the popover and tapping it again or tapping outside to close it, so that hover-only content is not lost on touch.
5. As a keyboard player, I want focusing the name to open the popover and Escape to close it, so that the content is reachable without a mouse.
6. As a player, I want a source to open in a new tab, so that I do not lose my board.
7. As a player, I want the popover to fit within the screen on a phone, so that it never needs horizontal scrolling.
8. As a player, I want no popover on "Not in this catalog.", so that a plain caption is not mistaken for a control.
9. As a player, I want the popover to omit the sources section when an entry has no sources yet, so that curation can land later without an empty section.
10. As a player, I want a popover open on one row to sit in front of the rows below it, so that the panel is never clipped or hidden by later content.

### Maintainer

11. As a maintainer, I want catalog entries to accept an optional `sources` list of label and URL pairs, so that the miss popover can show sources.
12. As a maintainer, I want catalog validation to reject a source with an empty label or a non-https URL, so that bad sources fail CI.
13. As a maintainer, I want `sources` treated as flavor, editable at any time, so that adding sources never touches the frozen prefix rules.
14. As a maintainer, I want at least one production entry to carry real sources, so that the popover is demoable without further curation work.

## Implementation Decisions

### Miss popover

- The row caption for an identified miss becomes this trigger, replacing the Daily board and slots ticket's plain text: a button with the entry's name, small gray text, and a dotted underline. The caption for a miss that matches nothing, "Not in this catalog.", is unaffected and stays plain, non-interactive text.
- State model, carried over from the prototype that settled the redesign's interaction design (branch `prototype/ui`, commit `fd70684`): three independent booleans — `pinned`, `hovered`, and `focused` — with the popover open whenever any of them is true.
  - Moving the pointer onto the trigger or onto the popover panel itself sets `hovered`, cancelling any pending close.
  - Moving the pointer off either one starts a 150ms grace timer that clears `hovered` when it elapses, so a brief crossing between the trigger and the panel does not close it; re-entering either before the timer fires cancels it.
  - Focusing the trigger sets `focused`; losing focus clears it.
  - Clicking the trigger toggles `pinned`, independent of hover or focus.
  - Pressing Escape while the popover is open clears all three booleans.
  - A pointer-down outside both the trigger and the panel clears `pinned` and `hovered` (focus is unaffected, since it already moved elsewhere).
- Content: the entry's name, its port in monospace, its description, and — only when the entry has at least one — a sources block listing each as an anchor opening in a new tab with `rel="noreferrer"`. An entry with no sources renders no sources block at all, not an empty one.
- Sizing and placement: the panel is 16rem wide. Below the small breakpoint (640px) it is centered under the trigger; at the small breakpoint and up, its right edge aligns with the trigger's right edge. It renders above the rows that follow it on the board, never clipped or covered by them.
- The popover exists only on the Daily screen. Blitz and History do not render miss identifications through this trigger.

### Catalog schema

- A catalog entry gains an optional `sources` list. Each source is a label and a URL. This is additive and optional: an entry with no sources list behaves exactly as it does today.
- Validation gains an `invalid-source` issue for a source with an empty label or a URL that does not start with `https://`. This check runs inside the existing catalog validation, so `gen:schedule --check` and CI enforce it automatically, with no separate wiring.
- `sources` is flavor: it may change at any time, the same as an entry's description or blurb, and is excluded from the frozen prefix rules that guard a Daily's committed name and port.
- At least one production entry is populated with a real, correct source (the specific entry and source are an author call, see Further Notes).

## Testing Decisions

A good test renders the app through its public seam and asserts what a player can see or do: roles, accessible names, visible text, focus, and persisted keys through the injected store. It does not assert class names, CSS, animation timing, or component internals, and it does not recompute expected values the way the code does. Expected strings are literals from this spec.

Two seams: the App seam, already established by earlier tickets in this effort, and the Catalog validation seam, already used by the existing catalog validation tests.

1. **App seam.** Render `App` with a memory store, a memory history at a route, and an injected `utcToday`, then interact and assert by role and accessible name. This ticket's coverage lives in a dedicated test file for the miss popover (an author call, see Further Notes) and exercises: hovering the trigger opens the popover with the entry's name, port, and description visible, and a source rendered as an anchor with the expected destination and `rel="noreferrer"`, opening in a new tab; focusing the trigger with the keyboard opens the popover and losing focus (blur) closes it; moving the pointer from the trigger into the panel keeps it open; moving off and letting the grace timer elapse closes it; clicking the trigger toggles a pinned-open state that persists independent of hover; Escape closes an open popover; a press outside the trigger and the panel closes it; an entry with no sources shows no sources block; a miss that matches nothing still renders "Not in this catalog." as plain text with no trigger and no popover.
2. **Catalog validation seam.** Call the catalog validator directly with entries carrying a valid source, a source with an empty label, and a source with an `http://` URL, asserting the `invalid-source` issue fires only for the invalid cases. This lives alongside the existing catalog validation tests for blurbs and duplicate names.

No snapshot tests, no visual regression, no Playwright. This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` all passing, in addition to the coverage above.

## Out of Scope

- Populating `sources` across the rest of the catalogs — only the one entry required to demo the popover is in scope; the rest is later curation work.
- The miss popover in Blitz or History.
- Any change to the reveal, stats, histogram, Share, or any other Daily-screen behavior not covered here.
- Any new game feature, rule change, engine change, persistence key, or route.
- Changing how a miss that matches nothing is captioned.

## Further Notes

- Primary source: `docs/superpowers/specs/2026-09-10-ui-redesign.md` (issue #22), sections Miss popover and Catalog schema, and user stories 55–63 and 102–104. Prototype reference: branch `prototype/ui`, commit `fd70684` — illustrative only, never merged; its demo source data is illustrative only and is not carried over, since real sources belong on catalog entries themselves.
- Glossary: `CONTEXT.md` at the repo root defines Entry, Answer-eligible, Daily, Miss identification, Source, Row, and Miss popover. Use those words in tests and code; avoid "Item"/"record"/"service row" for Entry, "Puzzle of the day"/"challenge" for Daily, "Hint"/"feedback" for Miss identification, "Link"/"citation"/"reference" for Source, and "Tooltip"/"hint card"/"hover card" for Miss popover.
- Product and architecture authority remains the v1 design spec and the UI redesign spec; this ticket is one slice of that spec's Miss popover and Catalog schema decisions.
- This ticket changes the row caption for an identified miss, introduced by the Daily board and slots ticket, from plain text to the interactive trigger described above; the "Not in this catalog." caption for a miss that matches nothing is unchanged.
- Author calls not covered by the ticket or the parent spec, listed so they can be overruled: the production entry required by the ticket's acceptance criteria is FTP (port 21) sourced to RFC 959, chosen because its port is one the fixture Daily used by the App-seam tests can miss on (FTP is answer-eligible and is not itself that fixture Daily's answer on the UTC date the tests use) and because RFC 959 is a real, correct primary document of the kind that CONTEXT.md's own definition of Source names (an RFC, the IANA registry, or vendor docs); this one entry is populated here even though the parent spec reserves broader sources curation for a later ticket, since the ticket's own acceptance criteria require at least one production entry to carry sources so the popover is demoable; the miss popover's App-seam tests live in a file of their own rather than extending the existing Mixed Daily test file, to avoid concurrent edits to that shared file colliding with other in-flight redesign tickets.
