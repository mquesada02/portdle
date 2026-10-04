# Research: screenshot tooling for a motion gate

Resolves [issue #213](https://github.com/mquesada02/portdle/issues/213), child of map [#212](https://github.com/mquesada02/portdle/issues/212).

## Question

Can Playwright 1.63 (pinned in `package.json` as `@playwright/test` 1.63.0) take a true mid-motion frame at a fixed time after an interaction, in Chromium, Firefox, and WebKit? Four parts:

1. Freezing CSS animations, CSS transitions, and view transitions (with `::view-transition-*` pseudo-elements) at N ms.
2. `toHaveScreenshot` determinism: Docker image, fonts, thresholds.
3. Baseline storage: PNG size, plain git vs Git LFS.
4. A gallery in CI.

This is **facts only**. No design is recommended. Decisions belong to later grilling tickets on map #212.

Observation date: **2026-10-04 (UTC)**. Sources are primary: Playwright docs and source, W3C/CSSWG specs, GitHub docs. Anything not confirmed is marked UNVERIFIED. "Experiment" means I ran it myself on this machine (Linux, headless): Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6, all from `playwright install` for Playwright 1.63.0. Experiment files lived in `/tmp` and are not committed.

## Part 1: freezing motion at N ms

### What the tools do

- **`document.getAnimations()` + `pause()` + `currentTime`.** `getAnimations()` returns the animations that are relevant for the document, including CSS animations, CSS transitions, and animations on pseudo-elements. [Web Animations spec, `DocumentOrShadowRoot.getAnimations()`](https://drafts.csswg.org/web-animations-1/#dom-documentorshadowroot-getanimations). Setting `currentTime` on a paused animation moves it to that time without playing it. The prior-art note used this in headless Chrome over CDP (agent memory `motion-probe-headless-chrome.md`, local, verified 2026-09-28). It works the same through `page.evaluate`, with no CDP.
- **`page.clock`.** Per the [Clock docs](https://playwright.dev/docs/clock), it replaces `Date`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `requestIdleCallback`, `performance`, and `Event.timeStamp`. CSS animations and transitions are not on that list. Source: [clock.md at v1.63.0](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/clock.md).
- **`animations: "disabled"` screenshot option.** From the [params docs](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/api/params.md): "finite animations are fast-forwarded to completion ... infinite animations are canceled to initial state, and then played over after the screenshot." The source, [`screenshotter.ts` at v1.63.0](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/screenshotter.ts), loops `root.getAnimations()` and calls `animation.finish()` on finite ones and `animation.cancel()` on infinite ones. It also listens to `transitionrun` and `animationstart` to catch new ones. For WebKit it first forces a style sync (`shouldToggleStyleSheetToSyncAnimations`).
- **`toHaveScreenshot` defaults to `animations: "disabled"`.** The option block for `toHaveScreenshot` uses the "default-disabled" variant in [class-pageassertions.md at v1.63.0](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/api/class-pageassertions.md). `page.screenshot` defaults to `"allow"`.
- **View transition timing.** The pseudo-element animations only exist once the transition reaches the "animating" phase, when the `ready` promise resolves. [CSS View Transitions Level 1, activate the view transition](https://drafts.csswg.org/css-view-transitions-1/#activate-view-transition) (the spec source resolves `ready` right after setting phase to "animating").

### Experiment: one page, three motions, three engines

Page: 375 px wide viewport; three 50 px boxes, each moving `left: 0 -> 300px` over 1000 ms, linear. One by a CSS transition, one by a `@keyframes` animation, one by a view transition (`view-transition-name`, `::view-transition-group(*)` duration 1000 ms linear, old/new `animation: none`). All three start on one click-equivalent `page.evaluate`. I awaited `transition.ready`, then froze, then took `page.screenshot`. I read the box's left edge from the PNG. Target: 150 px (the 50% point of 0 -> 300).

| Method | Chromium 153 | Firefox 155 | WebKit 26.6 |
|---|---|---|---|
| `getAnimations()` lists the CSS transition | yes | yes | yes |
| `getAnimations()` lists the CSS animation | yes | yes | yes |
| `getAnimations()` lists the view-transition pseudo-element animation (`::view-transition-group(vt)`, `effect.pseudoElement` set) | yes | yes | yes |
| `pause()` + `currentTime = 500`, then `screenshot({animations:"allow"})`: transition | 150 (6 of 6 runs) | 150 (6 of 6) | 150 (6 of 6) |
| same: CSS animation | 150 (6 of 6) | 150 (6 of 6) | 150 (6 of 6) |
| same: view transition | **150 (6 of 6)** | **300 (6 of 6): wrong, not frozen in the shot** | **150 (6 of 6)** |
| `page.clock.install()` + `runFor(500)` then screenshot | box at ~5-14 px, i.e. real elapsed wall time, not 500 ms: clock does not drive CSS motion | same | same |
| `animations:"disabled"` screenshot, taken right after the click | end state (300) for all three, 6 of 6 | end state (300), 6 of 6 | transition and animation at 300 in 3 of 6 runs, **at ~10 px (not finished) in the other 3**; view transition at 300 in 6 of 6 |
| plain wall-clock wait (`waitForTimeout(500)`) | 160 px | 170 px | 152 px (box positions vary by run: not a fixed-time frame) |

Observations that go with the table:

- The pause-then-screenshot result held with the screenshot taken immediately after the pause, and with two `requestAnimationFrame` ticks in between. An earlier run (single trial each) showed one miss in Chromium (view transition at ~5 px) and one in WebKit (transition and animation at ~18 px), when the pause and the first read were not separated. I did not reproduce it in the 6-run trials above. Treat it as UNVERIFIED whether a one-tick settle is needed.
- After `screenshot`, the animation state was unchanged: still `paused`, `currentTime` 500. The screenshot does not resume it.
- The animations have `currentTime` 0 for transitions and animations in Chromium and Firefox right after `ready`. In WebKit they were already at 8 to 17 ms. So "N ms after the interaction" is whatever `currentTime` is set to, not elapsed time.
- **Firefox and view transitions.** Firefox 155 lists the pseudo-element animation and accepts `pause()` and `currentTime`, but its screenshot shows the live DOM, not the view-transition overlay. Evidence: with the transition in progress, I changed the real box's `background` to yellow, and the Firefox screenshot showed it yellow at once; in Chromium the overlay (old/new snapshot) would hide a DOM change. Also, with the view transition paused at `currentTime = 0`, Firefox still drew the box at 300 (the post-update DOM position). So `page.screenshot` in Firefox did not capture a mid-view-transition frame. The cause (Playwright's Firefox screenshot path vs the Firefox build) is UNVERIFIED.
- `toHaveScreenshot` default drops the frame. With the same paused-at-500 page, `expect(page).toHaveScreenshot()` with default options wrote a baseline with all three boxes at 300 in all three engines (the paused animations were `finish()`ed). With `{ animations: "allow" }` the baselines had 150 (Chromium, WebKit) and 150/150/300 (Firefox). Both baselines then passed on the second run (runs on one machine).
- The first run of `toHaveScreenshot` with no baseline writes the file and fails; the second run passes. Documented: [Visual comparisons](https://playwright.dev/docs/test-snapshots) ("Generating screenshots").
- In the [Playwright docs for `toHaveScreenshot`](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/api/class-pageassertions.md): it "will wait until two consecutive page screenshots yield the same result". A paused frame is stable, so this passes at once. A running animation would never match twice (that is why the default is `"disabled"`).

### Facts about the app's motion (repo, for context)

- Screen, switcher, reorder, and phase changes use `document.startViewTransition` through `src/ui/view-transition.ts`. `src/styles.css` keys the CSS on `:root:active-view-transition-type(...)` and `::view-transition-group/old/new(...)` for the regions `root`, `shell-top`, `shell-nav`, `screen`, and `*`.
- Non-view-transition motion: `@keyframes pop`, `shake`, `draw`, `rise`, `popover-in`, `popover-out`. Durations are in `src/styles.css` and in [Spec 3](../superpowers/specs/2026-09-13-spec3-motion-polish.md).
- The test uses a plain, constant-time group transform. I did **not** test the app's own `::view-transition-old/new` opacity-and-translate animations, or `::view-transition-*` pseudo-elements with `inert` or `pointer-events` state, in Firefox. In Chromium the prior-art note showed those can be read with `getComputedStyle(html, '::view-transition-old(name)')`.
- Spec 3 requires reduced-motion handling. `page.emulateMedia({ reducedMotion: "reduce" })` is a Playwright option; not tested here.
- The existing e2e config (`playwright.config.ts`) has one project, `chromium` (Desktop Chrome), `workers: 1`, and CI installs `chromium` only (`.github/workflows/ci.yml`: `playwright install --with-deps chromium`). Firefox and WebKit are not installed in CI today.

## Part 2: `toHaveScreenshot` determinism

### Official Docker image

- Playwright publishes `mcr.microsoft.com/playwright:v<version>-<distro>` images. Tags for 1.63.0 exist: `v1.63.0`, `-noble`, `-jammy`, `-resolute`, with `-amd64` and `-arm64` variants. I checked the live tag list at `https://mcr.microsoft.com/v2/playwright/tags/list` on 2026-10-04. The docs confirm: "`:v%%VERSION%%-noble` - ... Ubuntu 24.04 LTS", `-jammy` is 22.04, `-resolute` is 26.04. Source: [docker.md at v1.63.0](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/docker.md).
- The image contains the browsers and the browser system dependencies, but not the Playwright npm package ([docker.md](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/docker.md)). Docs advise pinning the image to a specific version; if the image's Playwright version does not match the project's, "Playwright will be unable to locate browser executables".
- Recommended flags: `--init` and `--ipc=host` (Chromium can run out of memory without it). Same page.
- The Dockerfile at [`utils/docker/Dockerfile.noble`](https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/Dockerfile.noble) runs `playwright-core install-deps` and installs chromium and firefox in layers. UNVERIFIED from the head of the file I read: whether it installs webkit (it printed the chromium and firefox layers in the part I read).
- In GitHub Actions, a job can run in a container with `container: image: ...`. UNVERIFIED here (not fetched); Playwright's [CI intro](https://playwright.dev/docs/ci-intro) shows the plain `playwright install --with-deps` route.
- The docs' own advice for stable baselines: "For consistent screenshots, run tests in the same environment where the baseline screenshots were generated." and "Browser rendering can vary based on the host OS, version, settings, hardware, power source ..., headless mode". Source: [test-snapshots.md at v1.63.0](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/test-snapshots-js.md).
- Baseline names include browser and platform: `<name>-<project>-<platform>.png`, for example `f-allow-chromium-linux.png` (I saw exactly this in my run). Configurable with `snapshotPathTemplate`. Same page.

### Fonts

- The app declares no font file or `font-family` of its own in `src/`. It uses Tailwind CSS 4 (`@import "tailwindcss"`). Tailwind's default `--font-sans` stack is `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif, ...emoji fonts` ([theme.css on tailwindlabs/tailwindcss `main`](https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/theme.css), read 2026-10-04; the installed version is `^4.3.3`, so UNVERIFIED that it is identical).
- So on Linux the glyphs come from whatever system fonts match. On my machine fontconfig mapped `sans-serif` to Noto Sans (`fc-match sans-serif`). The fonts differ between a dev machine and the image.
- The Docker image installs fonts through `install-deps`: the package list in [`nativeDeps.ts`](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/registry/nativeDeps.ts) includes `fonts-liberation`, `fonts-noto-color-emoji`, `fonts-ipafont-gothic`, `fonts-wqy-zenhei`, `fonts-freefont-ttf`, `fonts-unifont`. UNVERIFIED which of these is the first match for the app's stack, and whether it is Noto Sans.
- Playwright waits for `document.fonts.ready` before a screenshot (set by default; the env var `PW_TEST_SCREENSHOT_NO_FONTS_READY` turns it off). [screenshotter.ts](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/screenshotter.ts).

### Threshold and masking options

All from [params.md](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/api/params.md) and [test-snapshots.md](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/test-snapshots-js.md):

- `threshold`: perceived colour difference per pixel in YIQ, 0 strict to 1 lax. Default **0.2**.
- `maxDiffPixels`: allowed count of different pixels. Unset by default.
- `maxDiffPixelRatio`: allowed ratio 0 to 1. Unset by default.
- Playwright uses [pixelmatch](https://github.com/mapbox/pixelmatch).
- `caret`: default `"hide"`.
- `mask` and `maskColor`: cover elements with a coloured box.
- `stylePath`: a stylesheet applied during the shot, pierces Shadow DOM and frames.
- `scale`: default `"css"`.
- Defaults can be set under `expect.toHaveScreenshot` in `playwright.config.ts` (per project too).
- Not on that list: any option to freeze a view transition or a time. Freezing is done by the page code (Part 1).

## Part 3: baseline storage

### Format

- Both PNG and WebP are accepted. "Both formats are lossless." Name the file `.webp` to get WebP ([test-snapshots.md](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/test-snapshots-js.md), [class-pageassertions.md](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/api/class-pageassertions.md)).

### Measured sizes

Method: built the app (`vite build`, dummy Supabase URL), served it with `vite preview`, routed all requests to the backend host to HTTP 500, and shot six routes (`/`, `/help`, `/codex`, `/blitz`, `/history`, `/protocols`) at 375x812 and 1024x768 in each engine, with `animations: "disabled"`. **Caveat: the backend was not running, so the pages are the shell plus the How-to modal or an empty state, not real puzzle content.** Real frames (Codex cards, the board, the Reveal) have more content and could be larger. Treat these as a proxy and a lower bound.

| Engine | Width | Size of one PNG (avg of 6) | Total, 6 frames | Same frame as lossless WebP (avg) |
|---|---|---|---|---|
| Chromium | 375x812 | 44.3 KB | 266 KB | 16.6 KB |
| Chromium | 1024x768 | 52.7 KB | 316 KB | 17.0 KB |
| Firefox | 375x812 | 51.9 KB | 311 KB | 15.4 KB |
| Firefox | 1024x768 | 62.2 KB | 373 KB | 16.0 KB |
| WebKit | 375x812 | 55.6 KB | 334 KB | 15.3 KB |
| WebKit | 1024x768 | 61.7 KB | 370 KB | 15.6 KB |

WebP numbers are from re-encoding Playwright's PNG with Pillow (`lossless=True`, method 6), not from Playwright's own `.webp` output. UNVERIFIED whether Playwright's encoder gives the same size.

Arithmetic, not a measurement: one frame at both widths in all three engines is about 6 PNGs, 6 x ~55 KB, or about 330 KB. 40 frames would be ~13 MB of PNG and ~4 MB of WebP at these sizes. The number of frames is a design choice (undecided).

An update to a baseline stores a whole new file in git history; each re-baseline adds that file's full size again to the repo's history (git stores a new blob per changed file). UNVERIFIED how well git packfile deltas compress PNG changes.

### Plain git on a private GitHub repo

From [GitHub docs, "About large files on GitHub"](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) and ["Repository limits"](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits):

- Files over 50 MiB give a warning; files over **100 MiB** are blocked. (Values from the docs variables `warning_size` and `max_github_size`, [data/variables/large_files.yml](https://github.com/github/docs/blob/main/data/variables/large_files.yml).)
- Repository size: "ideally less than 1 GB, and less than 5 GB is strongly recommended". Limits page: on-disk recommendation 10 GB; push size enforced at 2 GB.
- Single object: recommended maximum 1 MB per object; enforced at 100 MB. A PNG of 50 to 60 KB is well under 1 MB.
- Pull request diffs: no more than **25 renderable files** (images among them) in a single diff; no more than 300 files in a diff; no more than 1 MB of raw diff data. (Repository limits page above.) A PR that changes more than 25 baseline PNGs exceeds that stated limit, so the diff UI may not render all of them.

### Git LFS on a private GitHub repo

From [GitHub docs, "Git Large File Storage billing"](https://docs.github.com/en/billing/concepts/product-billing/git-lfs) and ["About Git LFS"](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage). Free quotas from [`large_files.yml`](https://github.com/github/docs/blob/main/data/variables/large_files.yml).

- Free and Pro accounts: **10 GiB storage and 10 GiB bandwidth** per month included. Team and Enterprise Cloud: 250 GiB each. (UNVERIFIED which plan the repo owner `mquesada02` is on; a personal account is Free or Pro.)
- Public and private repositories count the same. Storage counts every LFS object ever associated with the repository, whenever uploaded; deleting objects mid-month does not lower that month's usage.
- Every push of a changed LFS file stores a new full version against the owner's storage.
- Every download counts as bandwidth, against the repository owner. That includes downloads by GitHub Actions: "If GitHub Actions downloads a 500 MB file that is tracked with Git LFS, it will use 500 MB of the repository owner's bandwidth." So each CI checkout with `lfs: true` counts. Without `lfs: true`, checkout gets only pointer files (the pointer-file behaviour is also described for over-quota clones).
- Over quota: with the budget at $0, LFS use is blocked for the rest of the calendar month; with the budget deleted, overage is billed. Over storage quota with no payment method: you can clone (pointer files only) but cannot push. Over bandwidth: LFS support is disabled until next month.
- Max LFS file size on Free and Pro: 2 GB.
- Costs per GiB over quota: see the [pricing calculator](https://github.com/pricing/calculator?feature=lfs). UNVERIFIED current price (not stated in the pages I read).
- LFS objects can be included in source archives through a repository setting; if included, archive downloads count as bandwidth (stated on the billing page above).
- `git lfs` is not installed on this machine (`git lfs version` failed), so I did not run an LFS experiment. UNVERIFIED: anything beyond the docs.
- Arithmetic example using the measured sizes: at ~330 KB per 6-engine/width set, 10 GiB of storage is about 31,000 such sets of pushed versions. Not a recommendation; the real number depends on frame count and re-baseline frequency.

## Part 4: a gallery in CI

### What GitHub Actions can show

- **Artifacts.** `actions/upload-artifact@v7` stores files from a run. Default: files are zipped; retention 90 days by default, set 1 to 90 with `retention-days`; "Artifacts created by upload-artifact@v4 are immutable". Source: [upload-artifact README](https://github.com/actions/upload-artifact) and [action.yml](https://github.com/actions/upload-artifact/blob/main/action.yml). Download from the run page as a zip. The Playwright docs say the same for the HTML report: "click on the playwright-report to download your report in the format of a zip file" ([CI intro](https://playwright.dev/docs/ci-intro)).
- **Unzipped single file.** `archive: false` uploads one file as-is; "only a single file can be uploaded" and the file name becomes the artifact name (README above). So a contact sheet (one image or one self-contained HTML file) can go up unzipped. UNVERIFIED whether the GitHub UI then displays it inline or still downloads it; I could not test this without a workflow run.
- **Storage quota for artifacts (private repos).** Artifact storage included: Free **500 MB**, Pro 1 GB, Free for organizations 500 MB, Team 2 GB, Enterprise Cloud 50 GB. Shared with GitHub Packages storage. Charged hourly. Source: [billing reusable `actions-included-quotas.md`](https://github.com/github/docs/blob/main/data/reusables/billing/actions-included-quotas.md) and ["GitHub Actions billing"](https://docs.github.com/en/billing/concepts/product-billing/github-actions) (the pooled-storage statement). Public repos are free for these.
- **Job summary.** Markdown written to `$GITHUB_STEP_SUMMARY` is shown on the run's summary page and supports GitHub Flavored Markdown. Each step is capped at **1 MiB**. Source: [workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands) ("Adding a job summary", "Step isolation and limits"). UNVERIFIED: whether a job summary can show an image from an artifact, and whether a base64 `data:` image survives GitHub's Markdown sanitiser. I did not test either.
- The Playwright docs themselves call the download-zip route "not very convenient" and give an Azure Storage static-site recipe instead ([CI intro](https://playwright.dev/docs/ci-intro), the section on publishing the report on the web). That is the doc's example, not a requirement.

### Playwright's HTML reporter

- Output is "a self-contained folder ... that can be served as a web page" ([test-reporters.md](https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/test-reporters-js.md)). Default folder `playwright-report`, moved with `PLAYWRIGHT_HTML_OUTPUT_DIR`. `open: "never"` for CI.
- It "needs a web server" locally: "Locally opening the report does not work as expected as you need a web server for everything to work correctly" and the fix is `npx playwright show-report <folder>` ([CI intro](https://playwright.dev/docs/ci-intro)). So the downloaded zip is not open-and-view without that command (needs Node and Playwright).
- Experiment: a passing test that does `testInfo.attach(name, {body: png, contentType: "image/png"})` three times (frames at 100, 500, 900 ms) produced a report with `index.html` (519 KB, mostly the app bundle) and `data/` with the three PNGs, 522 KB total. So frames attached from passing tests are in the report, not only from failures. I did not render the report in a browser, so UNVERIFIED how the viewer lays the attachments out (gallery or list).
- For a failing `toHaveScreenshot`, the runner writes `-expected`, `-actual`, and `-diff` PNGs under `test-results/<test>/` and attaches them to the report (I saw the "attachment" lines and the `Expected:` / `Received:` paths in the failing run). The report's image-diff slider UI is described in the docs; I did not render it. UNVERIFIED beyond the file layout.

## Trade-offs (facts, not a recommendation)

- Firefox cannot be gated on view-transition frames through `page.screenshot` as tested (Part 1). Chromium and WebKit can. CSS animation and transition frames freeze in all three.
- `toHaveScreenshot` must be called with `animations: "allow"` for a paused mid-motion frame; the default turns it into an end-state shot.
- Plain git is free of quotas but each re-baseline adds the file to history; Git LFS keeps history small but adds a storage and bandwidth quota that every CI run with `lfs: true` consumes.
- The 25-image render limit in PR diffs applies to plain git PNGs in a PR. With LFS, UNVERIFIED whether GitHub renders the diff of LFS-tracked images.
- Baselines are per engine, per width, per OS. Only one Linux render exists if the Docker image (or the same CI runner image) is used for generation and checking.
- CI today installs Chromium only and has no Docker container; adding Firefox and WebKit adds download and run time. Not measured.
- Artifacts: 500 MB on Free for private repos, shared with Packages; 90-day default retention.

## Sources

- Playwright 1.63.0 docs source: [`docs/src`](https://github.com/microsoft/playwright/tree/v1.63.0/docs/src) (`clock.md`, `docker.md`, `test-snapshots-js.md`, `test-reporters-js.md`, `ci-intro.md`, `api/params.md`, `api/class-pageassertions.md`), [`screenshotter.ts`](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/screenshotter.ts), [`Dockerfile.noble`](https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/Dockerfile.noble), [`nativeDeps.ts`](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/registry/nativeDeps.ts).
- Published Playwright docs: [Visual comparisons](https://playwright.dev/docs/test-snapshots), [Clock](https://playwright.dev/docs/clock), [Docker](https://playwright.dev/docs/docker), [CI intro](https://playwright.dev/docs/ci-intro), [Reporters](https://playwright.dev/docs/test-reporters).
- MCR tag list: https://mcr.microsoft.com/v2/playwright/tags/list (fetched 2026-10-04).
- [CSS View Transitions Level 1](https://drafts.csswg.org/css-view-transitions-1/) and [Web Animations Level 1](https://drafts.csswg.org/web-animations-1/) (source: [w3c/csswg-drafts](https://github.com/w3c/csswg-drafts)).
- GitHub docs source: [`large_files.yml`](https://github.com/github/docs/blob/main/data/variables/large_files.yml), [Git LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs), [About Git LFS](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage), [About large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github), [Repository limits](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits), [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands).
- [actions/upload-artifact](https://github.com/actions/upload-artifact).
- [Tailwind `theme.css`](https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/theme.css).
- Experiments: my own, 2026-10-04, described in Parts 1 to 4. Prior art: agent memory `motion-probe-headless-chrome.md` (local).
