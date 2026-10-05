# Ticket spec: Theme crossfade

Spec for #234. Tracker: https://github.com/mquesada02/portdle/issues/234. Parent: Spec 6 (tests, CI, and motion), https://github.com/mquesada02/portdle/issues/222 (`docs/superpowers/specs/2026-10-04-spec6-tests-ci-motion.md`, "Theme crossfade", user stories 34 to 36). Map: https://github.com/mquesada02/portdle/issues/212. Decision: #220 (prototype, theme variant A). Gate: `docs/superpowers/specs/2026-10-05-t227-gate-tracer.md`. Base branch: `master`. Blocked by: #227 (merged).

## Problem Statement

When the player taps the theme toggle, the whole page changes color in one frame. The change looks abrupt, and it is the only visible state change with no motion.

## Solution

The theme toggle runs its change through the existing view-transition helper with a new `theme` type. Under that type, the whole page crossfades from the old theme to the new theme in 250 ms with `ease-out`. The Top bar and the Nav crossfade with the rest of the page, although they hold still under every other type. With reduced motion, or in a browser without the View Transitions API, the theme changes at once, as before. The screenshot gate takes frames of the crossfade.

## User Stories

1. As a player, I want the page to crossfade when I toggle the theme, so that the change is smooth and not abrupt.
2. As a player, I want the Top bar and the Nav to crossfade with the page, so that the whole screen changes as one picture.
3. As a player, I want the crossfade to last 250 ms with `ease-out`, so that it ends quickly and does not delay me.
4. As a player with reduced motion, I want the theme to change at once, so that no motion plays.
5. As a player in a browser without the View Transitions API, I want the theme to change at once, so that the toggle still works.
6. As a player, I want the new theme stored when I toggle it, so that the next visit uses it.
7. As a player in a browser with the API but without transition types, I want the theme to change at once, so that the toggle still works. The untyped rules hold the page still there, so no crossfade plays.
8. As a player, I want the icon of the toggle (sun or moon) to change with the page, so that the control shows the current theme.
9. As a player, I want the other motions (screen changes, phase changes, switcher, reorder) to stay as they are, so that nothing else changes.
10. As a developer, I want the toggle to use the existing helper, so that reduced motion and API checks live in one place.
11. As a developer, I want the `theme` rules next to the other view-transition rules in the stylesheet, so that all types are in one place.
12. As a developer, I want an App-level test of the toggle without the API, so that the fallback is proven in jsdom.
13. As an agent, I want gate frames of the crossfade at fixed times, so that I can see the motion and find a regression.
14. As an agent, I want the frames in the full matrix (375 × 812 and 1024 × 768, light and dark), so that both directions of the change and both layouts are guarded.
15. As an agent, I want a reduced-motion run of the crossfade, so that the instant change is proven.
16. As a reviewer, I want the `visual-change` label on the pull request, so that the new frames (which have no baseline) do not fail the gate.

## Implementation Decisions

- **Seams**: two existing seams, no new seam. The App-level test (the `App` rendered in jsdom, with the existing helpers) proves the contract that the toggle works without the API. The gate (the stub build in Chromium) proves the motion. The helper file is not edited. It already takes a list of types, and `theme` is a new member of that list.
- **Toggle**: the toggle click still writes the new theme to storage (and still shows the save warning when the write fails). The state change that applies the theme runs inside `runViewTransition(["theme"], …)`. The helper calls `flushSync` inside the update, so the new theme is in the page when the browser captures the new snapshot. The write to storage stays outside the update: it is not a visual change.
- **Theme rules**: in the global stylesheet, in the view-transition section, a rule set keyed on `:root:active-view-transition-type(theme)` (the same style as the `switcher` and `reorder` rules). Under `theme`: the old snapshot of every named region fades out and the new snapshot fades in, each for 250 ms with `ease-out`, with `mix-blend-mode: plus-lighter` so the two snapshots add to a true crossfade. The rule covers `root`, `shell-top`, `shell-nav`, `screen`, `switcher-content`, the Codex cards, and any other named region present. So no region keeps the browser default (250 ms `ease-in-out`) and no region holds still. Each group animation is zeroed (the regions do not move or resize). The shell groups keep the `z-index` they already have. Both animations use `250ms ease-out both`. The rule is more specific than the untyped rules that hold the root and the shell still, so it wins only under `theme`. The `screen, phase` rules do not match under `theme`, so they do not clash. A new pair of keyframes (a fade out and a fade in) is added next to the existing keyframes. Under any other type, nothing changes.
- **Reduced motion**: nothing new. The helper checks reduced motion first and starts no transition. The existing reduced-motion rule zeroes the view-transition pseudo-elements.
- **No API**: nothing new. The helper calls the update at once.
- **Gate frames**: one new gate spec file for the crossfade, on the fresh Daily of 2026-10-10 (the screen of the tracer). The test uses the existing `shootMotion` helper (which waits until no animation runs before the click) with the target `::view-transition-new(root)` and the click as the interaction. Frame times: 0, 60, 125, 190, and 250 ms, named `theme-crossfade-<time>ms`. Each project starts in its own theme (the fixture stores it), so the light projects frame light to dark, and the dark projects frame dark to light. With reduced motion, the test clicks the toggle, waits until the theme class changes, asserts that no view-transition animation exists, and takes one end frame, `theme-crossfade-end`. The reduced check needs `expectNoMotion` to accept a pseudo-element target, as `shootMotion` does. This is a small additive edit to a shared gate file.
- **Shared gate files**: edits are small and additive (the `expectNoMotion` target form). The stub, the fixtures, the configuration, and the CI jobs are not changed.
- **Pull request**: the new frames have no baseline, so the gate job reports differences. The pull request carries the `visual-change` label once the frames are final, and its body says so.

## Testing Decisions

- A good test asserts what the player sees or what the user-facing contract promises, never an internal call.
- **App-level test** (in the existing App test file, beside the theme toggle test): without the View Transitions API, the toggle flips the theme on the page and stores it. The test makes sure that `document.startViewTransition` is absent, so it does not depend on the jsdom default. A second App-level test installs the existing fake View Transitions API and asserts that the toggle still flips and stores the theme, and that the helper got the `theme` type. The type is an accepted exception to the rule above: the stylesheet keys the motion on it, so it is part of the contract. This second test checks the criterion of #234 that the toggle runs through the helper with the `theme` type.
- **Gate**: the frames are the test of the motion. Proof of the freeze: the 60, 125, and 190 ms frames differ from the 0 ms and 250 ms frames (the agent reads the frames once and records the result in the pull request body). The gate runs twice with no difference in the pinned Docker image.
- **Quality**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- Prior art: the theme toggle test and `stubViewTransitions` in the App tests; the tile pop test in the gate.

## Out of Scope

- Any other motion, including the Rounds disclosure height (#233).
- A circle reveal from the toggle, and color transitions on every element (the rejected variants B and C of #220).
- A View Transitions polyfill.
- WebKit and Firefox frames (a later ticket adds the engines).
- Changes to the stub, the fixtures, the gate configuration, and the CI jobs.
- Any change to how the theme is stored or chosen (the system theme rule stays).

## Further Notes

### Author calls

The owner accepted all nine calls on 2026-10-05.

1. Frame times 0, 60, 125, 190, and 250 ms: five frames at about even steps over the 250 ms duration, with both end points.
2. `mix-blend-mode: plus-lighter` under `theme`. The untyped rules set `normal` for the root and the shell, which would dip through the page background in the middle of a crossfade. `plus-lighter` is the browser default for a crossfade of the old and new snapshots.
3. The `theme` rules cover every named region (`*`), so the `screen` region and the regions that exist on some screens crossfade with the same timing, and no browser default remains.
4. The group animation is zeroed under `theme` (the groups do not move).
5. The helper file is not edited, because it already takes a list of types and its comment names none.
6. A second App-level test (with the fake API, asserting the `theme` type) is added beside the required no-API test, to cover the criterion of #234 that the toggle uses the helper with the `theme` type.
7. The gate frames use the fresh Daily screen and `::view-transition-new(root)` as the freeze target. The toggle has no transition of its own, so no hover step is needed.
8. `expectNoMotion` is extended to accept a pseudo-element target. Without it, the reduced-motion check on a pseudo-element would pass with no meaning.
9. The pull request gets the `visual-change` label.

### Facts checked

- `runViewTransition` takes a `string[]` of types and calls `document.startViewTransition({ update, types })` when the API and the `:active-view-transition-type()` selector exist.
- Today the root and the two shell regions have `animation: none` with or without a type, so the Top bar and the Nav hold still.
- The theme class is applied in a layout effect, so `flushSync` in the helper puts the new theme in the page before the browser captures the new snapshot.
- `expectNoMotion` compares the CSS `animationName` only, so it needs the pseudo-element form.
- The existing `reorder` rule uses `animation-duration` with `(*)` selectors, and the `screen, phase` rule is nested. The new `theme` rules use the flat form of `switcher` and `reorder`.
- The reduced-motion rule is outside the layer and zeroes the view-transition animations.

### Reminders

- Add the `visual-change` label to the pull request once the frames are final, and say so in the body.
- Rebase on `origin/master` before the pull request opens (other wave-2 tickets edit the shared gate files).
