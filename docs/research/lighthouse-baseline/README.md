# Lighthouse baseline of the Spec 7 page set

Ticket: Task: baseline every measured route (#270), map "Lighthouse targets and CI guard" (#266). Measured 2026-11-11 on master 024f172.

## Method

- Lighthouse 12.8.2 (Node API), Google Chrome headless, default simulated throttling; mobile = default config, desktop = `desktopConfig`. One Chrome and one Lighthouse run at a time, 3 runs per page audit, on a developer PC (not a CI runner).
- **Live:** https://mquesada02.github.io/portdle/ for `/` and `/privacy.html` only. Lighthouse refuses the other 8 pages on the live site: GitHub Pages answers them with HTTP 404 (the `404.html` copy of the app), and Lighthouse stops with `ERRORED_DOCUMENT_REQUEST` and no scores.
- **Local:** all 28 page audits on `vite preview` (port 4317) of a master build made with the live Supabase URL and anon key (repo variables), so the data is the real Dailies. `vite preview` answers 200 on every route. Local scores have no Pages network (gzip, cache, latency), but the mobile simulation models the network.
- **First visit:** Lighthouse's storage reset (empty storage, signed out; the How-to dialog opens).
- **Returning player:** `disableStorageReset`, with `localStorage` seeded before the run: How-to seen, 30 days (2026-10-12 to 2026-11-10) of Dailies in all three categories (mixed won/lost results), 20 Blitz runs, two Blitz bests. Pages: `/history`, `/history/blitz`, `/archive`, the board.
- **Fixed board:** `/archive/mixed/2026-11-01`.
- Files: `scripts/run.mjs` (the runner), `scripts/summary.mjs` (this table), `reports/<live|local>/<page>-<state>-<form factor>.json.gz` (the median-performance run of each page audit).

## Findings

- **404 on every deep link (live):** 8 of 10 pages cannot be audited on the live site at all, and Google does not index them (see Research: GitHub Pages limits, #268).
- **SEO:** `meta-description` fails on every page; it is the only failed SEO audit (89–90 everywhere).
- **Accessibility:** 100 everywhere except a finished board (96): the Share button, white on `bg-emerald-500` (#00bc7d), has a contrast of 2.47 (needs 4.5). It shows on every finished Daily, so it is not board-only.
- **Best practices:** 100 everywhere.
- **Performance, desktop:** 100 everywhere.
- **Performance, mobile:** local medians 95–99; LCP 2.1–2.9 s is the main cost (FCP ~1.5 s); TBT 0–98 ms. Live `/` median 92 with a spread of 79–93 over 3 runs (the first single run today gave 80): the live site spreads far more than local.
- **Not a failure but a residual:** the cache audit (Pages fixed `max-age=600`).
- The first-visit SEO score shows 89 and the returning one 90 with the same single failure (`meta-description`); the 1-point difference is not explained.

## Results (median, with the range when the 3 runs differ)

### Live
| Page audit | n | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | CLS ×1000 | SI ms |
|---|---|---|---|---|---|---|---|---|---|---|
| daily-mixed-first-desktop | 3 | 100 | 100 | 100 | 89 | 366 | 660 | 0 | 0 | 492 |
| daily-mixed-first-mobile | 3 | 92 (79–93) | 100 | 100 | 89 | 1844 | 2952 | 193 | 0 | 1870 |
| privacy-first-desktop | 3 | 100 | 100 | 100 | 90 | 214 | 214 | 0 | 0 | 214 |
| privacy-first-mobile | 3 | 100 (99–100) | 100 | 100 | 90 | 782 | 782 | 0 | 0 | 782 |

Failed audits (score < 0.9, weighted, not a metric), with the page audits where at least one run failed:

- seo: meta-description: all

### Local
| Page audit | n | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | CLS ×1000 | SI ms |
|---|---|---|---|---|---|---|---|---|---|---|
| archive-first-desktop | 3 | 100 | 100 | 100 | 89 | 364 | 707 | 0 | 3 | 394 |
| archive-first-mobile | 3 | 95 (95–96) | 100 | 100 | 89 | 1503 | 2813 | 52 | 0 | 1503 |
| archive-returning-desktop | 3 | 100 | 100 | 100 | 90 | 362 | 687 | 0 | 3 | 362 |
| archive-returning-mobile | 3 | 95 | 100 | 100 | 90 | 1503 | 2785 | 0 | 0 | 1503 |
| blitz-first-desktop | 3 | 100 | 100 | 100 | 89 | 364 | 703 | 0 | 0 | 419 |
| blitz-first-mobile | 3 | 96 (91–96) | 100 | 100 | 89 | 1502 | 2674 | 38 | 0 | 1502 |
| board-first-desktop | 3 | 100 | 100 | 100 | 89 | 363 | 703 | 0 | 0 | 384 |
| board-first-mobile | 3 | 95 (95–98) | 100 | 100 | 89 | 1503 | 2834 | 33 | 0 | 1503 |
| board-returning-desktop | 3 | 100 | 96 | 100 | 90 | 363 | 741 | 0 | 3 | 363 |
| board-returning-mobile | 3 | 95 | 96 | 100 | 90 | 1503 | 2929 | 0 | 0 | 1503 |
| codex-first-desktop | 3 | 100 | 100 | 100 | 89 | 364 | 706 | 0 | 3 | 414 |
| codex-first-mobile | 3 | 96 | 100 | 100 | 89 | 1502 | 2677 | 33 | 0 | 1502 |
| daily-applications-first-desktop | 3 | 100 | 100 | 100 | 89 | 363 | 705 | 0 | 0 | 374 |
| daily-applications-first-mobile | 3 | 96 | 100 | 100 | 89 | 1504 | 2700 | 34 | 0 | 1504 |
| daily-mixed-first-desktop | 3 | 100 | 100 | 100 | 89 | 364 | 712 | 0 | 0 | 409 |
| daily-mixed-first-mobile | 3 | 96 (96–99) | 100 | 100 | 89 | 1504 | 2704 | 62 | 0 | 1504 |
| daily-protocols-first-desktop | 3 | 100 | 100 | 100 | 89 | 363 | 703 | 0 | 0 | 370 |
| daily-protocols-first-mobile | 3 | 96 | 100 | 100 | 89 | 1504 | 2672 | 37 | 0 | 1504 |
| history-blitz-first-desktop | 3 | 100 | 100 | 100 | 89 | 365 | 534 | 0 | 0 | 424 |
| history-blitz-first-mobile | 3 | 96 (93–96) | 100 | 100 | 89 | 1504 | 2696 | 69 | 0 | 1504 |
| history-blitz-returning-desktop | 3 | 100 | 100 | 100 | 90 | 368 | 502 | 0 | 0 | 368 |
| history-blitz-returning-mobile | 3 | 99 | 100 | 100 | 90 | 1502 | 2102 | 13 | 0 | 1502 |
| history-first-desktop | 3 | 100 | 100 | 100 | 89 | 382 | 596 | 0 | 0 | 496 |
| history-first-mobile | 3 | 95 (92–95) | 100 | 100 | 89 | 1569 | 2864 | 98 | 0 | 1569 |
| history-returning-desktop | 3 | 100 | 100 | 100 | 90 | 364 | 524 | 0 | 8 | 364 |
| history-returning-mobile | 3 | 99 | 100 | 100 | 90 | 1505 | 2105 | 14 | 18 | 1505 |
| privacy-first-desktop | 3 | 100 | 100 | 100 | 90 | 172 | 203 | 0 | 0 | 172 |
| privacy-first-mobile | 3 | 100 | 100 | 100 | 90 | 601 | 752 | 0 | 0 | 601 |

Failed audits (score < 0.9, weighted, not a metric), with the page audits where at least one run failed:

- accessibility: color-contrast: board-returning-desktop, board-returning-mobile
- seo: meta-description: all
