# Research: Lighthouse in GitHub Actions (ticket #267, map #266)

Date checked: 2026-11-11. Primary sources only. Items I could not confirm are marked UNVERIFIED.
Source keys:
- LHCI-CFG = https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
- LHCI-START = https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md
- LH-VAR = https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md
- LH-THR = https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md
- GH-RUN = https://docs.github.com/en/actions/reference/runners/github-hosted-runners

## Answer

- Use Lighthouse CI (`@lhci/cli`) with `lhci autorun`, or `collect` + `assert`. It gives multi-run collection, a median "representative" run and eslint-style assertions with presets. Plain `lighthouse` gives one run per call, so the looping, median and thresholds would be our own script.
- Gate on the median of 5 runs, not 1. Lighthouse's docs say the median of 5 is twice as stable as 1 run (LH-VAR). The real spread on `ubuntu-latest` is UNVERIFIED: no primary source gives it, and it needs a measurement (section 2).
- LHCI `staticDistDir` has no base-path option, so by the code it cannot serve a `/portdle/` build as-is. Use `startServerCommand` with `vite preview` (the repo already does this for e2e and the gate) and pass full `/portdle/...` URLs.
- Supabase: stubs give the most stable scores, and the repo already has fixtures (`gate/`). But the repo's stub is Playwright request routing, which LHCI's own Chrome does not have, so a stub path needs a separate mechanism (a decision for the map).
- Cost: on a public repo, standard runners are free and unlimited (GH-RUN). Wall-clock is about 30 s per Lighthouse run on a dedicated 2-core machine (LH-VAR), so 5 runs per URL per preset is about 2.5 min; the real number is UNVERIFIED until measured.

## 1. LHCI versus plain `lighthouse`

- LHCI has three phases: `collect` (runs Lighthouse N times per URL), `assert` (checks the results), `upload` (sends reports to a target). `lhci autorun` runs them from one config, `lighthouserc.js` at the repo root (LHCI-START, "GitHub Actions Example", "autorun").
- Collect options: `url` (array), `numberOfRuns` (CLI default 3), `settings` (flags passed to Lighthouse; the docs show `"preset": "desktop"`), `staticDistDir`, `startServerCommand`, `startServerReadyPattern` (default `listen|ready`), `startServerReadyTimeout` (default 10000 ms) (LHCI-CFG, section "Collect").
- Median: LHCI groups runs by URL and computes one median ("representative") run per URL (LHCI-CFG, collect section). The code sorts runs by FCP and by Interactive, takes the median of each, then picks the run with the smallest squared distance to both medians (https://github.com/GoogleChrome/lighthouse-ci/blob/main/packages/utils/src/representative-runs.js). So the representative run is picked by two timing metrics, not by the performance score.
- Assert: `preset` is `lighthouse:all` (every audit perfect), `lighthouse:recommended` (non-performance audits perfect, metrics warn below 90) or `lighthouse:no-pwa` (recommended without PWA audits). Assertions are `level | [level, options]`, levels `off|warn|error`; options include `minScore` (default 1), `maxNumericValue` and `aggregationMethod` = `median`, `optimistic` (default), `pessimistic`, `median-run` (LHCI-CFG, section "Assert"). Whether category scores (for example `categories:performance`) are asserted with that key: UNVERIFIED, the page text I read lists audit IDs and properties only.
- Upload: `temporary-public-storage` is a free, no-setup target; reports are public to anyone with the link, deleted after a few days, and using it means agreeing to its terms and privacy policy (LHCI-CFG, section "Upload"). Other targets exist (an LHCI server, `filesystem`); I did not read them.
- Plain `lighthouse` (CLI): one run per call and a report; looping, median and assertions would be ours. LH-VAR itself points to lighthouse-ci: `lhci collect` with `-n 5`, then the representative run.
- Docs example for Actions: checkout, setup-node 22.x, install, build, `npm install -g @lhci/cli@0.16.x`, `lhci autorun` (LHCI-START). With a GitHub app token LHCI also sets status checks (LHCI-START).

## 2. Score variance and number of runs

- Sources of variability (LH-VAR): page nondeterminism (High), local network (High), client hardware (High), client resource contention (High; "Running multiple instances of Lighthouse at once also typically distorts results"), web server (Low), tier-1 network (Medium), browser nondeterminism (Medium).
- Advice (LH-VAR): use the median, 90th percentile or min/max for pass/fail thresholds; "The median Lighthouse score of 5 runs is twice as stable as 1 run."
- CI advice (LH-VAR): "In continuous integration situations, use dedicated servers when possible"; "Free CI environments and 'burstable' instances are typically quite volatile"; never collect multiple reports at once on one machine; minimum 2 dedicated cores (4 recommended) and 2 GB RAM.
- No source gives a per-category spread for GitHub runners. UNVERIFIED. A measurement would need: the built app served exactly as in CI; many (for example 20 to 30) separate workflow runs spread over different hours (one burst hides shared-runner noise); one Lighthouse process at a time; per URL and per preset, record every category score; then report min, max and standard deviation of single runs and of median-of-3 and median-of-5.
- The docs I read do not state spreads for accessibility, best-practices or SEO. Only the performance category is built from timing metrics (Lighthouse scoring docs, not fetched: UNVERIFIED).

## 3. Simulated throttling, mobile versus desktop

- Default `throttlingMethod` is `simulate` (https://github.com/GoogleChrome/lighthouse/blob/main/core/config/constants.js, `defaultSettings`). LH-THR: "Lighthouse, by default, uses simulated throttling as it provides both quick evaluation and minimized variance." It simulates the load from data observed in an initial unthrottled load; fast, deterministic, can be less accurate on edge cases.
- Mobile default (LH-THR): RTT 150 ms, 1.6 Mbps down, 750 Kbps up, no packet loss ("Slow 4G"); constant 4x CPU slowdown.
- Desktop: the desktop preset uses `throttling: constants.throttling.desktopDense4G` and the desktop screen emulation (https://github.com/GoogleChrome/lighthouse/blob/main/core/config/desktop-config.js). Its numbers (RTT, throughput, CPU multiplier) are in a constants module I could not fetch: UNVERIFIED. LH-THR gives no desktop numbers.
- LH-VAR: simulated throttling mitigates local-network and tier-1-network variability, and partially mitigates client hardware, contention and browser variability. DevTools throttling mitigates less and cannot mitigate hardware or contention. Neither mitigates page nondeterminism. So runner CPU still matters under simulation.
- In LHCI, desktop is selected with `collect.settings.preset: "desktop"`; mobile is the default (LHCI-CFG, `settings`, "Desktop emulation").

## 4. Serving the built app under `/portdle/`

Repo facts: `vite.config.ts` has `base: "/portdle/"`. `pnpm build` is `tsc -b && vite build && tsx scripts/copy-index-html-to-404.ts`, which copies `dist/index.html` to `dist/404.html` (the GitHub Pages deep-link fallback). `playwright.config.ts` and `playwright.gate.config.ts` run `vite preview --outDir dist-e2e|dist-gate --host 127.0.0.1 --port N --strictPort`; the gate opens `/portdle/` and `/portdle/blitz` (gate/signed-in.spec.ts).

- `staticDistDir`: LHCI serves the folder with its `FallbackServer` (express), mounted at `/` and `/app`; the only routing option is `isSinglePageApplication`, which returns `index.html` for unmatched paths (https://github.com/GoogleChrome/lighthouse-ci/blob/main/packages/cli/src/collect/fallback-server.js and `collect.js` in that folder). There is no base-path option. Inference from the code, not tested: `index.html` at `/` references `/portdle/assets/...`, which that server does not map to `dist/assets/`. A `portdle/` subfolder in the served directory might work: UNVERIFIED.
- `startServerCommand` + `vite preview`: LHCI runs the command, waits for the ready pattern and stops it after collection (LHCI-CFG, `startServerCommand`). `vite preview` serves the build and takes `--host`, `--port`, `--strictPort`, `--outDir`, `--base` (https://vite.dev/guide/cli.html). Vite says it is "not designed" as a production server (same page). The repo already uses it with `/portdle/` URLs, so the URLs are `http://127.0.0.1:PORT/portdle/` and deep links such as `/portdle/blitz`.
- Deep links: the Vite docs do not describe `vite preview`'s SPA fallback or `404.html` (https://vite.dev/guide/static-deploy.html, https://vite.dev/config/preview-options.html): UNVERIFIED from docs. Repo evidence only: the gate loads `/portdle/blitz` through `vite preview`. On the live site, GitHub Pages serves `404.html` for unknown paths; whether Lighthouse penalizes the 404 status of a live deep link: UNVERIFIED.
- Build choice: CI's `build` job uses `vars.SUPABASE_URL` and `SUPABASE_ANON_KEY`; a stub build sets `VITE_SUPABASE_URL=http://stub.test` (scripts/gate.ts lines 56 to 57).

## 5. Supabase reads in an audit

- Live project: reads go over the runner's network to production. LH-VAR counts web server and network as variance and page nondeterminism as High impact; daily data (Dailies, catalog) changes every day. It also adds CI traffic to the production project (a policy point for the map). Simulated throttling replays timing from the observed load, so a slow live response still shifts that observation.
- Local stack: `sql-tests` already runs `supabase start -x studio,mailpit` and `pnpm dev:schedule` (ci.yml). Realistic data, no outside network, but longer start-up and a Docker stack in the job (CLAUDE.md section 14 applies).
- Stubs (the repo's approach): `gate/stub.ts` answers every request to `http://stub.test` from committed fixtures with Playwright context routing; an unstubbed request is aborted and fails the test; `pnpm check:fixtures` compares fixtures with the real stack. Deterministic and offline. Gap: LHCI starts its own Chrome, so the Playwright routing does not apply. The stub host would need a real local HTTP server serving the fixtures, or a script-driven flow. UNVERIFIED: LHCI has a `puppeteerScript` collect option that I did not read, and I found no request-interception hook in the pages I read.
- With stubs, responses have near-zero latency, so scores measure app code more than a real user's experience (a limit to state).
- The reads happen in the SPA after load (supabase-js `.from(...).select` in `src/remote/supabase.ts`). Their effect on LCP and Total Blocking Time was not measured.

## 6. Run time and runner minutes

- Runners: public repos get `ubuntu-latest` with 4 vCPU, 16 GB RAM, 14 GB SSD; private repos 2 vCPU, 8 GB (GH-RUN). "Use of the standard GitHub-hosted runners is free and unlimited on public repositories" (GH-RUN). The repo went public on 2026-11-10 (project memory; not re-checked). So minutes cost nothing; wall-clock and queue time matter.
- LH-VAR: about 30 seconds per test on a dedicated 2-core instance. By arithmetic on that figure, 5 runs of one URL at one preset is about 2.5 minutes, so 6 URLs at 2 presets is about 30 minutes serial. Not measured: UNVERIFIED for this app.
- LH-VAR forbids parallel Lighthouse runs on one machine and prefers several small machines, which maps to a job matrix; each job repeats checkout, `pnpm install` and build.
- Existing job timeouts for comparison (ci.yml): `build` 10 min, `sql-tests` 40, `screenshots` 50. The file's convention is a timeout of about 3 times the longest successful run, at least 5. Set the audit job's timeout only after a measured run.

## Not confirmed

Score spread on `ubuntu-latest`; desktop throttling numbers; the `categories:*` assertion key; Vite docs on `vite preview` SPA fallback; LHCI under a base path (inferred from code, untested); LHCI request interception for stubs; Lighthouse treatment of a 404 deep link; per-category spreads other than performance.
