# Spec: Help removal and redirect

Spec for #50. Tracker: https://github.com/mquesada02/portdle/issues/50

## Problem Statement

The nav carries a Help item that duplicates the "How to play" button next to it in the top bar, and a Help page that duplicates the How-to dialog's rules. A player scanning the nav sees a fourth item that adds nothing the top bar doesn't already offer, and the tab bar on a phone carries one more column than it needs. A player who has the old Help address bookmarked or linked from elsewhere should not hit a dead end when the route is removed.

## Solution

The nav shrinks to exactly three items: Daily, Blitz, History. The Help page is removed. Its address stays registered as a route, but the route now redirects to the Daily instead of rendering the removed page, so a bookmark or external link lands somewhere useful rather than 404ing. The "How to play" button in the top bar and the first-visit How-to dialog are unchanged and remain the only help surface, per the parent spec.

## User Stories

### Nav

1. As a player, I want the nav to have exactly Daily, Blitz, and History, so that the tab bar is roomier and nothing is duplicated.
2. As a phone player, I want the nav to keep rendering as a fixed bottom tab bar with an icon and label per item, so that switching surfaces with my thumb still works with three items instead of four.
3. As a desktop player, I want the nav to keep rendering as inline top-bar links, so that the screen does not waste a bottom strip.
4. As a player, I want the current nav item still highlighted, so that I can see which surface I'm on.
5. As a player on Protocols or Applications, I want the Daily nav item still highlighted, so that the three Dailies still read as one surface.
6. As a keyboard player, I want to still Tab through the wordmark, the three remaining nav items, the How-to button, and the theme toggle in order, so that nothing is skipped or newly unreachable.

### How-to

7. As a player, I want the "How to play" button in the top bar to remain the way to reread the rules, so that help is still one tap away.
8. As a first-time player, I want the How-to dialog to still open automatically on first visit to any route, so that first-visit behavior is unchanged.
9. As a player who dismisses How-to, I want it to not reopen on my next visit, so that dismissal persists as before.

### Redirect

10. As a player who bookmarked or was linked to the old Help address, I want it to land on the Daily, so that the link is not a dead end.
11. As a player, I want the redirect to happen before anything Help-related renders, so that I never see a flash of a page that no longer exists.

### Maintainer

12. As a maintainer, I want the Help page component deleted rather than left orphaned, so that dead code doesn't linger.
13. As a maintainer, I want the shell's test suite to assert three nav links, the redirect landing on the Daily, and no behavior specific to the Help page, so that the suite matches what the app now does.

## Implementation Decisions

### Design language

- Follows the UI redesign spec's design language unchanged — no new visual elements.

### Nav

- The nav item list drops its fourth entry (Help). The remaining three items (Daily, Blitz, History) keep their existing routes, labels, icons, and active-match behavior (Daily active on all three Daily routes; each other item active only on its own route) exactly as before — nothing about how the surviving items render or highlight changes.
- The icon previously used for the Help nav item is also the icon already used by the "How to play" button; it stays in place for that button. Only the nav item that used it is removed.
- The phone tab bar's column count follows the nav item count. The UI redesign spec sizes the tab bar at four equal columns for its four-item nav, so the three remaining items get three equal columns instead.

### How-to

- The How-to dialog, the "How to play" button that opens it, and the shared rules-list content backing both the dialog and the deleted Help page are all unchanged: same trigger, same open/dismiss behavior, same persisted "seen" state, same accessible name. Deleting the Help page removes that content's only other consumer.

### Redirect

- The old Help address remains a registered route — so an existing link or bookmark still resolves rather than 404ing — but it now redirects straight to the Daily instead of rendering a page, and nothing Help-related is ever rendered first. The Help page component itself is deleted rather than left orphaned.

## Testing Decisions

A good test renders the app through its public seam and asserts what a player can see or do: roles, accessible names, and visible text. It does not assert class names, CSS, or component internals, and it does not recompute expected values the way the code does. Expected strings are literals from this spec.

One seam, already existing:

- **App seam.** Render `App` with a memory store, a memory history, and an injected `utcToday`. Prior art: the existing App-seam shell tests. Cover: exactly three nav links, named Daily, Blitz, History, and no link named Help; the existing per-route active-link assertions for the three surviving items (Daily active across its three routes and only those; Blitz and History active only on their own route); the "How to play" button opening the dialog named "How-to"; the dialog opening on first visit on any route; Got it, Escape, and a backdrop click each closing it and writing How-to seen, with no reopen after; the theme toggle's existing behavior and accessible name; the "Progress may not save." notice on a failed write; and navigating to the old Help address landing on the Daily, with the Daily's heading present and no heading named Help or content specific to Help ever appearing.

Tests that must change by this ticket's decision: the per-route active-link cases and the route-heading cases both drop their Help case (the route-heading case is replaced with a Daily-landing assertion for the old Help address); the keyboard-reachability test's hardcoded list of nav-link names drops "Help"; the test asserting a Help page heading and rules content is deleted, since that page no longer exists. Every other existing shell assertion keeps its current expectation. The History page's test file needs no change: it carries no assertion referencing Help; its only relevant imports are from the shared test-support modules used across the suite.

No snapshot tests, no visual regression, no Playwright. This ticket is proven done by `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm gen:schedule --check`, and `pnpm build` all passing — the full checklist that ticket #50 itself specifies, regardless of this ticket's own scope — in addition to the App-seam coverage above.

## Out of Scope

- Any change to the Daily page component, including its existing link to the old Help address from the "Puzzle unavailable" empty state — the link is left as-is, since the address still resolves either way (now via redirect).
- Any change to the Daily marks engine or UI, the search engine, the Blitz end card, or CI workflow — separate tickets running in parallel with their own file ownership.
- Any change to How-to beyond what Implementation Decisions already settles above.
- Any redesign of the nav's visual treatment (spacing, breakpoints) beyond the column-count change already called out — the nav keeps its existing rendering rules, just for three items instead of four.

## Further Notes

- Primary source: `docs/superpowers/specs/2026-09-10-daily-digit-feedback.md` (issue #44), the Help removal decision and user stories 29-31.
- That decision supersedes the UI redesign spec's four-item nav and Help page. The UI redesign spec's Shell section otherwise remains the authority for everything else about the shell (sticky top bar, wordmark link, theme toggle, tab-bar-on-phone/inline-links-on-desktop nav rendering, active-item highlighting rules). Product and architecture authority remains the parent spec and the UI redesign spec; this spec is ticket #50 only, one slice of the parent spec's Help removal decision.
- Glossary: `CONTEXT.md` defines Shell, Top bar, Nav, Tab bar, How-to. Use those words in tests and code; avoid "layout"/"chrome"/"frame" for Shell, "header"/"app bar" for Top bar, "menu"/"sidebar" for Nav, "bottom nav"/"footer" for Tab bar, and "tutorial"/"onboarding"/"intro"/"Help page" for How-to. The removed page and item are referred to here as "Help" (a proper noun for what existed), not as a re-use of any glossary term.
- Known cross-ticket effect, not fixed by this ticket: an existing Daily-page test uses the old Help address as a stand-in for "some route that isn't a Daily route" to assert the Daily switcher is absent elsewhere. Once the redirect ships, that probe lands back on the Daily, where the switcher does appear, so that assertion no longer holds. That test is Daily-page test coverage, not Shell test coverage, so it sits outside this ticket's file scope per its acceptance criteria; it is left for whoever next touches that file to repoint the probe at a different non-Daily route.
