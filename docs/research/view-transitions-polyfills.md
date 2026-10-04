# Research: View Transitions polyfills

Resolves [issue #215](https://github.com/mquesada02/portdle/issues/215), child of [map #212](https://github.com/mquesada02/portdle/issues/212).

## Question

What can a browser without the View Transitions API (`document.startViewTransition`) get from a polyfill? Which polyfills exist, what do they cover, and how big and how maintained are they? Which current browsers lack the same-document API, and which lack types? What does the repo do today on a browser without the API?

This is **facts only**. No recommendation is made here. The decision belongs to a later ticket on map #212.

Checked on **2026-10-04 (UTC)**. Anything not confirmed is marked UNVERIFIED.

## Summary

- Two packages exist: `view-transitions-polyfill` (draws the animation, no types) and `view-transitions-mock` (no animation, full JS API including types).
- Neither can make the repo's type-keyed CSS (`:root:active-view-transition-type(...)`) match. Both leave `CSS.supports("selector(:active-view-transition-type(a))")` false, so the router and the helper call the callback form.
- caniuse (data of 2026-09-30) lists 5.52% of global usage without the same-document API, and 8.07% without types (this includes the 5.52%). The repo's no-API fallback is an instant update.

## Part 1: polyfills that exist

I found them with `npm search`, a web search, and the GitHub search. I list every candidate that implements `startViewTransition`. Other npm packages with "view transitions" in the name are helpers, framework wrappers, or type definitions, not polyfills.

### 1. `view-transitions-polyfill` (demarketed)

- Source: https://github.com/demarketed/view-transitions-polyfill. npm: https://www.npmjs.com/package/view-transitions-polyfill.
- Version 1.0.6, published 2025-07-29 (npm registry, `npm view view-transitions-polyfill time`). GitHub releases list 1.0.6 on 2025-07-29 as the newest.
- License: ISC (npm `license` field, GitHub license API, and the file header in the dist).
- Maintenance: last commit on the default branch is 2026-02-13 (a README link update, via the GitHub commits API). The last code change is the 1.0.6 release of 2025-07-29. Open issues: 1 (#3, an idea to PR the code to `mrhenry/polyfill-library`, from 2024-11-22). Open PRs: 0. Not archived. 73 stars. (GitHub API, 2026-10-04.)
- Size, measured by installing 1.0.6 in `/tmp`:
  - shipped file `dist/view-transitions-polyfill.js`: 291,403 bytes; gzip -9: 69,217 bytes.
  - same file re-minified with esbuild: 224,495 bytes; gzip -9: 61,840 bytes.
  - Brotli was not measured (no tool available). jsDelivr serves its own `.min.js` (https://data.jsdelivr.com/v1/package/npm/view-transitions-polyfill@1.0.6/flat lists it as the default); I did not measure that file.
- Loading: `if (!document.startViewTransition) import('view-transitions-polyfill')` is the documented conditional load (README). The module itself only installs when `document.startViewTransition` is missing (`src/view-transitions-api-polyfill.ts`).
- Browser requirements (README "Compatibility"): Chrome and Edge 88+, Opera 74+, Safari 14+, Firefox 78+. It needs `Element.animate()`, `Document.getAnimations()`, `requestAnimationFrame`, custom elements, shadow DOM, and `:where()`.
- How it works (source): it replaces `Document.prototype.startViewTransition`, patches `HTMLHtmlElement.prototype.animate` and `Document.prototype.getAnimations` so that `::view-transition-*` pseudo-elements map to real custom elements (`view-transition`, `view-transition-group`, `view-transition-image-pair`, `view-transition-old`, `view-transition-new`) injected into the DOM. It parses the page's stylesheets with its own CSS parser (`src/style-parsing/`). Sources: https://github.com/demarketed/view-transitions-polyfill/tree/main/src.

Coverage, from reading `polyfill-functions.ts`, `view-transition-manager.ts`, `polyfill-utils.ts`, and the dist file (version 1.0.6):

| Feature | Covered? | Evidence |
| --- | --- | --- |
| `document.startViewTransition(callback)` | Yes | `startViewTransitionPolyfill(callback)` |
| `ViewTransition.ready`, `finished`, `updateCallbackDone`, `skipTransition()` | Yes | class `ViewTransition` in `polyfill-utils.ts` |
| Animation of `::view-transition-*` (group, image-pair, old, new) | Yes, via DOM elements | `view-transition-manager.ts`, UA stylesheet text in it |
| `view-transition-name` | Yes (read from stylesheets and the style attribute) | `mapViewTransitionName`, `style-parsing/` |
| Options-object form `startViewTransition({ update, types })` | No. The signature takes only a callback, and the code does `await callback()`, so an object would throw. The runtime behavior with an object was not run: UNVERIFIED | `startViewTransitionPolyfill(callback)`; `view-transition-manager.ts` lines 133, 178, 231 |
| Transition types (`ViewTransition.types`, `ViewTransitionTypeSet`) | No | no `types` handling in the source or the dist (the only `types` hits are unrelated strings; no `ViewTransitionTypeSet` or `activeViewTransition` in the dist) |
| `:active-view-transition-type()` selector | No | 0 matches for `active-view-transition-type` in the dist |
| `view-transition-class` | No | 0 matches in the dist (only the `view-transition-name` family) |
| `match-element`, element-scoped, cross-document transitions | No | no references in the dist |

The README does not state which features are missing. It points to Web Platform Tests (`css/css-view-transitions`) as the way to test it; I did not find a published pass rate: UNVERIFIED.

### 2. `view-transitions-mock` (GoogleChromeLabs, by Bramus)

- Source: https://github.com/GoogleChromeLabs/view-transitions-mock. npm: https://www.npmjs.com/package/view-transitions-mock. Announcement: https://www.bram.us/2026/03/11/view-transitions-mock-is-a-non-visual-polyfill-for-same-document-view-transitions/.
- Version 1.1.0, published 2026-02-17 (npm registry and GitHub releases). First published 2026-01-13.
- License: Apache-2.0 (npm, GitHub license API, README). The README says it is not an officially supported Google product.
- Maintenance: last push 2026-09-17 (GitHub API). Open issues: 1 (#2, a TypeScript error, 2026-03-20). Open PRs: 3 (#4 and #5 dependency bumps; #6 "Make the package resolvable from Node and TypeScript", 2026-09-20). Not archived. 70 stars. (GitHub API, 2026-10-04.)
- Size, measured by installing 1.1.0 in `/tmp`:
  - shipped file `dist/index.js` (not minified): 12,457 bytes; gzip -9: 2,825 bytes.
  - re-minified with esbuild: 5,278 bytes; gzip -9: 1,748 bytes.
- It is an ES module with a `register()` function (README). It does not install itself on import.
- It is **not a visual polyfill**. The README says it "doesn't replicate the pseudo-tree or the animations". The announcement says it leaves out "the pseudo-tree, the CSS properties, and the animations themselves".
- What it provides (README): `document.startViewTransition` (callback form and the options-object form with `update` and `types`), `document.activeViewTransition`, `ViewTransition.transitionRoot`, `ViewTransitionTypeSet`, and the `ViewTransition` promises. The update callback runs and the DOM changes; nothing animates.
- `register()` options (README): `requireTypes` (default `true`) and `forced` (default `false`). With `requireTypes: true`, the mock also registers on a browser that has the API but not types, and replaces the native `startViewTransition`. That includes Firefox 144 to 146 (the README names them). With `requireTypes: false` it leaves those browsers alone.
- Tested (README): Chromium 110 and Firefox 142 (no support), Chromium 145 (full), Firefox 146 (no types), WebKit 26.0 (full), with Playwright.

Coverage table:

| Feature | Covered? |
| --- | --- |
| `document.startViewTransition(callback)` and the options-object form | Yes (JS only) |
| Transition types in JS (`ViewTransition.types`, `ViewTransitionTypeSet`) | Yes (JS only) |
| `view-transition-name` | No (the property has no effect; the README example just sets the style) |
| `::view-transition-*` styling and animation | No |
| `:active-view-transition-type()` selector | No (a CSS selector cannot be provided by JS; I did not run a browser to confirm: UNVERIFIED) |
| `view-transition-class` | No |

### Other candidates checked and excluded

- `view-transitions-toolkit`, `vt-helper`, `safe-view-transition`, `use-view-transitions`, `@vtbag/*`, `velvette`, framework wrappers (Vue, Astro, Next, Angular, Ember, Svelte): helpers or wrappers around the native API, not polyfills. I did not read each one: UNVERIFIED for any that might ship a fallback.
- `mrhenry/polyfill-library`: issue #3 on the demarketed repo suggests adding the polyfill there. I did not check whether that happened: UNVERIFIED.
- Search sources: `npm search` (2026-10-04) for "view transitions", "startViewTransition", "view-transition polyfill".

### What the repo's CSS needs from a polyfill

From `src/styles.css`: it uses `::view-transition-group/old/new(root | shell-top | shell-nav | screen | switcher-content | codex-*)` and the `:root:active-view-transition-type(screen, phase | switcher | reorder)` selector, written with CSS nesting (`&::view-transition-*`). Page code also sets `view-transition-name` from React (`style={{ viewTransitionName: ... }}` in `src/ui/codex-page.tsx`).

- The untyped rules (root and the two shell regions held still) use only `::view-transition-*` and `view-transition-name`. The visual polyfill covers those names in principle. How it handles nested rules, `z-index` on `::view-transition-group`, the `*` wildcard (`::view-transition-group(*)`), and `@layer components` is UNVERIFIED (not run).
- The type-keyed rules need `:active-view-transition-type()`. No polyfill listed here implements it, so those rules would not match. Browsers without native support also drop a rule whose selector they do not parse. Whether the visual polyfill's CSS parser tolerates such a selector is UNVERIFIED.
- `view-transition-class` is not used in `src/` (grep found no use).

## Part 2: which browsers lack the API

Source for support data: caniuse data, https://github.com/Fyrd/caniuse (`features-json/view-transitions.json` and `data.json`, commit `ce66e8e`, data `updated` 2026-09-30 05:34 UTC), cross-checked with MDN browser-compat-data 8.1.4 (npm `@mdn/browser-compat-data`) and the web-features package 3.40.1 (https://github.com/web-platform-dx/web-features). Usage share is caniuse's `usage_global` per browser version; I did not confirm the underlying statistics source or month: UNVERIFIED. caniuse tracks 97.27% of global use in this data set; the rest is not attributed to any browser.

### First version with each feature

| Feature | Chrome, Edge | Firefox | Safari | Opera | Samsung Internet |
| --- | --- | --- | --- | --- | --- |
| `startViewTransition` (callback form), `view-transition-name`, `::view-transition-*` | 111 | 144 | 18.0 | 97 | 22 (BCD) |
| Options-object form, `ViewTransition.types`, `:active-view-transition-type()` | 125 | 147 | 18.2 | 111 | 27 (BCD) |
| `view-transition-class` | 125 | 144 | 18.2 | 111 | not listed in the web-features output: UNVERIFIED |

Android and iOS follow the same engines: Chrome Android 111 and 125, Firefox Android 144 and 147, Safari iOS 18.0 and 18.2 (BCD and web-features). Sources: `api.Document.startViewTransition`, `api.ViewTransition.types`, `css.selectors.active-view-transition-type`, `css.properties.view-transition-class` in https://github.com/mdn/browser-compat-data. web-features (`view-transitions`, `active-view-transition`, `view-transition-class`) gives Baseline "low" (newly available) dates: 2025-10-14 for the callback form, 2026-01-13 for types.

caniuse differs from BCD in places: it lists Samsung Internet 23 as the first supporting version, and Chrome 109 and 110 as "no" (BCD lists the pseudo-element selectors from 109). I counted caniuse's "no" as "no API".

### Share of global usage (caniuse, data of 2026-09-30)

- Supports the same-document API: 91.75% (caniuse `usage_perc_y`).
- Lacks it: 5.52% (sum of "no" versions across all browsers). Together with the supporting share, that is the 97.27% tracked.
- Lacks types (no API, plus API without types, using BCD's version thresholds above): 8.07%. So 2.55% have the API but not types.

Breakdown of the 5.52% with no API:

| Browser | Share with no API | Versions that carry it (share) |
| --- | --- | --- |
| Chrome (desktop) | 1.66% | 109 (0.56), 70 and 103 to 110 (rest) |
| iOS Safari | 1.13% | 15.6 to 15.8 (0.21), 16.6 to 16.7 (0.28), 17.6 to 17.7 (0.16), 11.0 to 11.2 (0.10), others |
| Firefox (desktop) | 1.08% | 121 (0.41), 120 (0.22), 115 (0.13), 135 (0.13), 140 (0.07), others |
| UC Browser (Android) | 0.64% | 15.5 |
| Safari (desktop) | 0.53% | 17.6 (0.13), 16.6 (0.10), 15.6 (0.06), others |
| IE | 0.24% | 11 |
| Opera (desktop) | 0.10% | |
| QQ (Android) | 0.09% | 14.9 |
| Edge | 0.04% | |
| Samsung Internet | 0.01% | |

Browsers with the API but without types, in addition (2.55% in total): Chrome 111 to 124 (1.75%), Edge 111 to 124 (0.45%), Opera 97 to 110 (0.18%), iOS Safari 18.0 and 18.1 (0.10%), Samsung Internet 22 to 26 (0.05%), Safari desktop 18.0 and 18.1 (0.02%), Firefox 144 to 146 (0.01%). Firefox 144 to 146 is the band the Spec 3 "API without types" case describes.

Counts I did not verify: Chrome and Firefox ESR or enterprise lag, in-app webviews other than caniuse's listed browsers, and per-country usage. caniuse also has region data (`region-usage-json/`) that I did not read.

### Whether a polyfill could even run on the 5.52%

The visual polyfill needs Chrome and Edge 88+, Safari 14+, Firefox 78+, and so on (README). Of the no-API groups above, IE 11 (0.24%) fails that. The mock has no listed minimum; I did not test its floor: UNVERIFIED. I did not check UC Browser 15.5 or QQ 14.9 against the polyfill's requirements (UC and QQ engine versions): UNVERIFIED.

## Part 3: what the repo does today without the API

- `src/ui/view-transition.ts` (`runViewTransition`): if reduced motion matches, or `document.startViewTransition` is not a function, it runs `update()` directly. If the API exists, it checks `CSS.supports("selector(:active-view-transition-type(a))")`. Support: `startViewTransition({ update: () => flushSync(update), types })`. No support: `startViewTransition(() => flushSync(update))`.
- `src/router.tsx` sets `defaultViewTransition: { types: ... }`. The types function returns `false` on the first load and under reduced motion; otherwise `["switcher"]` for a change inside one screen, `["screen"]` for a change of screen.
- TanStack Router's own gate (`@tanstack/router-core`, `router.js`, `startViewTransition`; checked in 1.170.33 and in 1.171.28, the version the lockfile pins for router-core): it starts a transition only when `typeof document.startViewTransition === "function"`. It passes `{ update, types }` only when `CSS.supports("selector(:active-view-transition-type(a))")` is true. Otherwise it passes the plain callback. Without the API it calls the update directly.
- Spec 3 (`docs/superpowers/specs/2026-09-13-spec3-motion-polish.md`): "Browsers without the View Transitions API: screen, switcher, and Blitz state changes are instant, the Codex reorder jumps, and everything else (popover, dialogs, disclosures, colors) still animates, since those are plain CSS." User stories 5 and 59 require that fallback. "A polyfill for browsers without the View Transitions API" is listed under Out of Scope.
- Tests: the test runner has no API, so the fallback path runs in every test except those that install a fake (`stubViewTransitions` in the test helpers).

How each polyfill meets this gate (from the gate code above and the coverage tables):

- Both polyfills define `document.startViewTransition`, so the router's first test passes and the helper no longer takes its "no API" branch.
- Neither makes the selector check true, so both the router and the helper pass the callback form. `types` are never passed, so the polyfills' type handling is never reached by this code.
- With the visual polyfill, the callback form runs a polyfill transition; the untyped CSS rules might apply and the type-keyed ones would not. The result is not tested: UNVERIFIED. With the mock, the update runs and nothing animates, which looks the same as today.
- The helper wraps the update in `flushSync`. The router passes an `async` function. The visual polyfill awaits the callback (`await callback()`), so both shapes fit the code read; not run: UNVERIFIED.

## Trade-offs (not a recommendation)

- Visual polyfill: adds about 62 to 69 KB gzip, can run only on browsers that have `Element.animate()` and the other listed features, and has no types or `:active-view-transition-type()`. The repo's screen, switcher, phase, and reorder motions are all keyed on types, so they would likely not play. It would add an extra dependency with one maintainer (the last code release is 2025-07-29).
- Mock: adds about 1.7 to 2.8 KB gzip, gives the repo no animation on browsers without the API (the update runs, as today), and the repo's selector check would still be needed.
- The no-API share is 5.52% of tracked usage, of which IE 11 (0.24%) and old Chrome, Firefox, Safari, and iOS Safari versions are most of it.

## Sources

- https://github.com/demarketed/view-transitions-polyfill (README, `src/`, releases, commits, issues)
- https://www.npmjs.com/package/view-transitions-polyfill (registry data via `npm view`, 2026-10-04)
- https://github.com/GoogleChromeLabs/view-transitions-mock (README, releases, issues, PRs)
- https://www.npmjs.com/package/view-transitions-mock (registry data via `npm view`, 2026-10-04)
- https://www.bram.us/2026/03/11/view-transitions-mock-is-a-non-visual-polyfill-for-same-document-view-transitions/
- https://github.com/Fyrd/caniuse (`features-json/view-transitions.json`, `data.json`, commit `ce66e8e`, updated 2026-09-30)
- https://github.com/mdn/browser-compat-data (npm `@mdn/browser-compat-data` 8.1.4)
- https://github.com/web-platform-dx/web-features (npm `web-features` 3.40.1)
- https://github.com/TanStack/router (`@tanstack/router-core` 1.170.33 and 1.171.28 from npm, `router.js`)
- https://www.w3.org/TR/css-view-transitions-1/ and https://www.w3.org/TR/css-view-transitions-2/ (spec names only; I did not quote them)
- Repo files: `src/ui/view-transition.ts`, `src/router.tsx`, `src/styles.css`, `src/ui/codex-page.tsx`, `docs/superpowers/specs/2026-09-13-spec3-motion-polish.md`
