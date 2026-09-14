# Spec: Dialogs, Rounds disclosures, and nav colors

Spec for #91. Tracker: https://github.com/mquesada02/portdle/issues/91. Parent: Spec 3, #87.

## Problem Statement

Three surfaces still cut instead of moving. The How-to dialog and the Blitz setup dialog, and their backdrops, snap on and off with no transition. A Rounds disclosure, on the arena's last-run card and on each row of History's Blitz segment, dumps its round list open with no motion. Nav items, the Daily switcher's and the History switcher's items, and the Codex sort toggle flip their color the instant they become current, while the pill radios right next to them already ease into their own color change.

## Solution

Both dialogs and their backdrops fade in on open and fade out on close, through `@starting-style` and discrete transitions on the dialog's open state, so a browser without that support keeps today's instant open and close. A Rounds disclosure's round list fades and rises in when the disclosure opens, using the same rise motion the Daily reveal already uses, and closes instantly with no height animation. Nav items, the Daily switcher's and the History switcher's items, and the Codex sort toggle gain the same color-transition utility class the pill radios already carry. All of it is plain CSS, zeroed under reduced motion, and needs no JavaScript change and no new test.

## User Stories

Renumbered sequentially for this ticket, following the convention prior per-ticket specs (t72, t74, t75, t77) already set; each story traces back to Spec 3 (`docs/superpowers/specs/2026-09-13-spec3-motion-polish.md`, issue #87), story numbers noted in parentheses.

### Dialogs

1. As a player, I want the How-to dialog and its backdrop to fade in when they open, so that the dialog arrives instead of snapping on. (Spec 3 story 13)
2. As a player, I want the setup dialog to open and close with the same motion as the How-to dialog, so that both dialogs feel alike. (14)
3. As a player, I want a dialog and its backdrop to fade out on Escape, backdrop click, Cancel, or Start, so that dismissal is as soft as arrival. (15)
4. As a player, I want a dialog's close motion to be shorter than its open motion, so that leaving feels quicker than arriving. (16)
5. As a player on a browser without `@starting-style` or discrete transitions, I want both dialogs to open and close exactly as they do today, so that an older browser loses only the polish. (part of 5, applied to dialogs)

### Round log disclosures

6. As a player, I want the round log to rise in when I open a Rounds disclosure on the arena or a row of History's Blitz segment, so that the list arrives instead of appearing at once. (17)
7. As a player, I want closing a Rounds disclosure to be instant, so that collapsing stays snappy. (18)

### Nav and switchers

8. As a player, I want a nav item's color to transition when it becomes current, so that the active state slides into place instead of flipping. (26)
9. As a player, I want a switcher item's color to transition when it becomes current, so that the Daily switcher and the History switcher match the nav. (27)
10. As a Codex reader, I want the sort toggle's color to transition the same way, so that it matches the nav and the switchers.

### Accessibility and maintenance

11. As a player who has asked my system to reduce motion, I want none of the dialog, disclosure, or color motion to play, so that the app respects my setting as it already does for the board. (28, scoped to this ticket's three surfaces)
12. As a screen reader user, I want none of this motion to change what is announced or when, so that motion stays purely visual. (29, scoped to this ticket's three surfaces)
13. As a maintainer, I want the color transition reused from the pills rather than written again, so that the motion language stays consistent. (part of 31)
14. As a maintainer, I want this ticket's CSS to land as one block in the stylesheet, next to no JavaScript change, so that it stays reviewable apart from the other Spec 3 tickets touching the same file.

## Implementation Decisions

### Dialogs

- Exactly two native `<dialog>` elements exist in the codebase — the How-to dialog (`src/ui/how-to.tsx`) and the setup dialog (`SetupDialog` in `src/ui/blitz-page.tsx`) — and both already carry the identical existing class list (`m-auto max-w-sm bg-transparent p-0 backdrop:bg-black/50 dark:backdrop:bg-black/70`). One generic, unscoped `dialog` / `dialog[open]` / `dialog::backdrop` rule set in the stylesheet therefore covers both with no change to either component's markup, props, or the existing `showModal()`/`close()`/Escape/backdrop-click logic, which stays exactly as it is.
- On open: the dialog's own box (the panel) fades from opacity 0 to 1 and scales from 95% to 100% over 150ms, ease-out; the `::backdrop` fades from opacity 0 to 1 over 150ms, ease-out, alongside it. Both use the browser's `@starting-style` at-rule to supply the pre-open values a freshly-promoted top-layer element has no prior frame to transition from.
- On close: the panel and the backdrop both fade out over 100ms, ease-out; the dialog's `display` and `overlay` (top-layer) properties transition alongside as discrete properties via `transition-behavior: allow-discrete`, so the browser keeps the panel and backdrop painted, fading, for the full 100ms instead of removing them from the top layer the instant `close()` clears the `open` attribute.
- The asymmetric durations need no JavaScript because a CSS transition always runs for the duration declared on its *target* state: the base, closed `dialog` rule (and the base `dialog::backdrop` rule) declares the transition list at 100ms — the duration that applies the instant the `open` attribute is removed and the dialog transitions back to that base rule, i.e. the close — while the `dialog[open]` rule (and `dialog[open]::backdrop`) overrides only `transition-duration` to 150ms, the duration that applies the instant the `open` attribute is added and the dialog transitions into that rule, i.e. the open. No `classList` toggling or inline style is needed; the `open` attribute the existing `showModal()`/`close()` calls already set and clear is the only thing driving which duration is in effect.
- The panel's scale uses the standalone CSS `scale` property (not `transform: scale()`); neither dialog applies any other transform, so this is a direct, unambiguous animation of size alone.
- A browser without `@starting-style` support, or without `allow-discrete`, renders the dialog's and the backdrop's final declared values the instant the `open` attribute is added or removed, with no interpolation — today's instant open and close — since neither at-rule nor keyword is required for the base cascade to resolve.
- The theme toggle in `src/ui/shell.tsx` is untouched: no transition on its icon swap or on the page's change of color scheme.

### Round log disclosures

- The round log inside a Rounds disclosure — the arena's last-run card (`LastRun` in `src/ui/blitz-page.tsx`) and each row of History's Blitz segment (`BlitzRunRow` in `src/ui/history-page.tsx`) — plays the existing `rise` `@keyframes` (already in `src/styles.css`, used today by `.animate-rise` for the Daily reveal) over 150ms, ease-out, with no delay, when the disclosure's native `<details>` gains its `open` attribute. `RoundLog`'s rendered `<ul>` is the only element besides `<summary>` inside either `<details>`, and no other `<details>` element exists anywhere in `src/`, so a rule scoped to an open `<details>`'s direct-child `<ul>` reaches exactly these two round logs and nothing else, with no change to `round-log.tsx`, `blitz-page.tsx`, or `history-page.tsx`.
- Closing a disclosure is instant: removing the `open` attribute stops the rule from matching, and native `<details>` already hides its content the instant the attribute is removed, with no exit animation defined.
- Height is never animated; the disclosure's native open/close sizing is untouched, matching Spec 3's explicit exclusion.
- The end card's round log (the `ended` branch of `BlitzPage` in `blitz-page.tsx`) renders `RoundLog` directly, with no `<details>` wrapper — it is always visible and structurally outside the scope of this rule, so it needs no change and gets none.

### Nav and switcher colors

- The Tailwind `transition-colors` utility class — the exact class the pill radios (`Pill` and `OrientationCard` in `blitz-page.tsx`) already carry — is added to four elements' existing class lists, each a small, additive edit with no other change to markup, logic, or existing classes:
  - The nav `<Link>` in `src/ui/shell.tsx` (the `NAV.map` render).
  - The Daily switcher's `<Link>` in `src/ui/daily-page.tsx` (`DailySwitcher`).
  - The History switcher's `<Link>` in `src/ui/history-page.tsx` (`HistorySwitcher`).
  - The Codex sort toggle's `<label>` in `src/ui/codex-page.tsx` (`SortOption`).
- No new CSS is written for this: `transition-colors` already exists as a Tailwind utility, so its 150ms duration and its timing curve (Tailwind's default `cubic-bezier(0.4, 0, 0.2, 1)`) come from Tailwind itself, identical to what the pills already use.

### Stylesheet organization

- All CSS this ticket adds — the `dialog`/`dialog[open]`/`dialog::backdrop`/`@starting-style` rules, the `details[open] > ul` rule, and the scoped reduced-motion rule below — is appended as one clearly delimited, commented block at the end of `src/styles.css`, after the existing reduced-motion rule. Two other Spec 3 tickets (#89, #90) touch this same shared file in parallel; this ticket's block is additive only and does not edit any existing line in the file.

### Reduced motion

- The existing `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none; transition: none; } }` rule in `src/styles.css` is not modified, and the `transition-colors` utility's transition is zeroed by it exactly as the pills' own `transition-colors` already is today.
- That existing rule does not, however, reach this ticket's other new selectors: `*`, `*::before`, and `*::after` all carry lower CSS specificity than the element and attribute selectors this ticket adds (`dialog`, `dialog[open]`, `details[open] > ul`), so the existing rule loses the cascade to them regardless of source order, and its selector list never matches `::backdrop` at all (a pseudo-element distinct from `::before`/`::after`), so `dialog::backdrop`'s transition is outside its reach entirely. This ticket therefore adds one small, additive `@media (prefers-reduced-motion: reduce)` rule of its own, inside its own appended block and after its forward rules, naming exactly `dialog`, `dialog::backdrop`, and `details[open] > ul` and setting their `animation`/`transition` to `none` — the same selectors and same specificity as the forward rules it neutralizes, so it wins by source order for those three selectors without needing `!important` and without touching the existing universal rule. `.animate-pop`, `.animate-shake`, `.animate-draw`, `.animate-rise`, and every other pre-existing motion in the codebase are unaffected and unexamined by this ticket; only this ticket's own three new selectors are covered by its new rule.
- No new accessibility surface beyond this: no aria attribute, announced text, or focus behavior changes on any of the three surfaces.

## Testing Decisions

A good test exercises a public seam with literal inputs and asserts what a player sees or what a pure function returns. As Spec 3's own Testing Decisions section establishes for the whole motion pass, how motion looks is checked by eye in the browser, not by tests; this ticket adds no seam of its own (no new helper function, no new branching state) for a test to exercise.

- No new test is written. This ticket's changes are pure CSS (the dialog and disclosure rules) and four additive Tailwind `className` edits that introduce no new rendered text, role, or accessible name and change no existing one — nothing any existing test asserts on shifts.
- Every existing test suite (App, Blitz, Blitz arena, History, Codex, Daily, Miss popover, and the rest) is expected to keep passing unchanged, since nothing in this ticket touches component output, props, state, or behavior — only CSS and static class lists.
- This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` all passing, plus a manual check that the built CSS contains: the `dialog`/`dialog[open]`/`dialog::backdrop` transition rules and their `@starting-style` blocks; the `details[open] > ul` animation rule; this ticket's own scoped reduced-motion rule; and the `transition-colors` utility applied to the four elements above. Everything else — the dialogs' and disclosures' actual fade/scale/rise timing, and all four color transitions — is checked by eye on the dev server, in a browser with and without `@starting-style`/`allow-discrete` support, and with reduced motion on and off, per Spec 3's own Testing Decisions.

## Out of Scope

- View transitions: screen changes, switcher changes, Blitz phase changes, the Codex reorder, the router's transition-types function, and the shared view-transition helper — all ticket #89.
- The miss popover's open and close animation, its keyframes, and its closing-state/unmount logic — ticket #90.
- Any change to the theme toggle: its icon swap and the page's change of color scheme stay instant.
- Any change to the end card's always-visible round log, or to `RoundLog` itself.
- Any edit to the existing reduced-motion rule in `src/styles.css` — this ticket's own reduced-motion coverage for its three new selectors is a separate, additive rule (see Implementation Decisions, Reduced motion), not a change to the existing one.
- Fixing the existing reduced-motion rule's specificity gap for `.animate-pop`, `.animate-shake`, `.animate-draw`, `.animate-rise`, or any other pre-existing motion in the codebase — out of this ticket's scope, which covers only the three selectors it adds.
- Any new test, snapshot test, or visual regression test.
- A polyfill for browsers without `@starting-style` or `allow-discrete`; those browsers keep today's instant dialog open/close by design, not by a fallback shim.
- Any change to dialog focus trapping, `aria-labelledby`, Escape handling, or backdrop-click handling — all unchanged from today.

## Further Notes

- Primary sources: the body of issue #91; Spec 3 (`docs/superpowers/specs/2026-09-13-spec3-motion-polish.md`, issue #87) — its Dialogs, Round log disclosures, and Nav and switcher colors decisions in full, and the parts of its Durations and easing section (enter 150ms / exit 100ms, ease-out for the dialog and disclosure keyframes, the pills' `cubic-bezier(0.4, 0, 0.2, 1)` for the color transitions, "the color transition is the one motion written nowhere, reused through the pills' utility class") and its Reduced motion and fallbacks section ("The popover, dialogs, disclosures, and colors are plain CSS in every band, zeroed by the same rule") that bear on this ticket's three surfaces.
- Glossary: `CONTEXT.md` already defines How-to, Setup dialog, Round log, History switcher, Daily switcher, Nav, Sort toggle; this ticket introduces no new term. Spec 3's Further Notes section already rules "Rounds disclosure" a motion name local to that spec, not a glossary term, naming the native disclosure titled "Rounds ({n})" on the arena's last-run card and on the rows of History's Blitz segment — this ticket uses that same name and adds nothing to `CONTEXT.md`.
- This ticket touches no persisted shape, no storage key, no engine module, and no copy: no new strings.
- Coordination note (from the work assignment, not the ticket body or Spec 3 itself): tickets #89 and #90 both append to `src/styles.css` in parallel; this ticket's own addition is a single, clearly delimited, purely additive block placed after the existing reduced-motion rule, to keep the merge surface small.
