# Reaching mobile performance 100

Ticket: Prototype: reach mobile performance 100 (#275), map "Lighthouse targets and CI guard" (#266). Measured 2026-11-12 on master 024f172.

## Method

- Developer PC, Lighthouse 12.8.2 simulated mobile, 3 runs per page audit, one Lighthouse at a time, `vite preview` of a build with the live Supabase data (no stub server yet). Pages: Daily (first visit), Archive list, board, History (first visit and returning).
- `scripts/exp.sh` builds each variant from master's `index.html`, restores the file, and audits; `scripts/run.mjs` and `scripts/summary.mjs` as in the baseline.
- Variants:
  - **v0:** master.
  - **v1:** v0 plus `<link rel="preconnect">` to the Supabase origin.
  - **v2:** v1 plus static placeholder markup (header, heading, one paragraph) inside `#root`.
  - **v3:** v2 plus the module bundle requested only after the `load` event (an inline loader script replaces the `<script type="module">`).

## Findings

- **Why FCP is 1.5 s:** the HTML is an empty shell; the app paints only after the 127 KB (gzip) bundle. In v2 the page paints at once (observed FCP 57 ms), but the **simulated** FCP stays at 1.5 s: Lighthouse's simulation charges the bundle requested at load time to the first paint.
- **LCP elements on master:** first visit: a list item of the How-to dialog (~2.1–2.9 s); returning Archive list and board: data content after the JavaScript, the Schedule read and the Daily read (~2.8–3.1 s). Render delay is 79–85% of LCP.
- **v1 (preconnect):** no gain. **v2 (static markup):** no clear gain.
- **v3 (static markup, late bundle):** 98–100 on every audited page; FCP 0.76–1.16 s, LCP 0.9–1.7 s. Caveat: its LCP element is the placeholder text, so v3 shows the ceiling of an HTML-first page, not a real fix.
- **The real fix (owner decision):** prerender each route's real markup into its `.html` copy at build time (render to string, then hydrate), and load the bundle after the first paint.
- **Not tested:** code splitting. While the bundle loads before the first paint, its size alone is unlikely to reach 100 (v1/v2 kept FCP at 1.5 s).

## Results (median of 3, range when the runs differ)

### v0

| Page audit | n | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | CLS ×1000 | SI ms |
|---|---|---|---|---|---|---|---|---|---|---|
| archive-first-mobile | 3 | 93 (91–95) | 100 | 100 | 89 | 1505 | 2873 | 165 | 0 | 1505 |
| archive-returning-mobile | 3 | 95 | 100 | 100 | 90 | 1505 | 2821 | 54 | 0 | 1505 |
| board-first-mobile | 3 | 95 (94–95) | 100 | 100 | 89 | 1506 | 2869 | 69 | 0 | 1506 |
| board-returning-mobile | 3 | 94 (94–95) | 96 | 100 | 90 | 1506 | 2986 | 75 | 0 | 1506 |
| daily-mixed-first-mobile | 3 | 95 (94–98) | 100 | 100 | 89 | 1508 | 2711 | 133 | 0 | 1508 |
| history-first-mobile | 3 | 89 (86–95) | 100 | 100 | 89 | 1557 | 2980 | 252 | 0 | 1631 |
| history-returning-mobile | 3 | 94 (68–99) | 100 | 100 | 90 | 1627 | 2839 | 129 | 18 | 1627 |

### v1

| Page audit | n | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | CLS ×1000 | SI ms |
|---|---|---|---|---|---|---|---|---|---|---|
| archive-first-mobile | 3 | 87 (73–89) | 100 | 100 | 89 | 1653 | 2957 | 314 | 0 | 1653 |
| archive-returning-mobile | 3 | 95 | 100 | 100 | 90 | 1508 | 2806 | 46 | 0 | 1508 |
| board-first-mobile | 3 | 95 (92–95) | 100 | 100 | 89 | 1504 | 2840 | 55 | 0 | 1504 |
| board-returning-mobile | 3 | 95 (94–95) | 96 | 100 | 90 | 1503 | 2795 | 0 | 0 | 1503 |
| daily-mixed-first-mobile | 3 | 88 (73–89) | 100 | 100 | 89 | 1652 | 2878 | 312 | 0 | 1812 |
| history-first-mobile | 3 | 95 (95–98) | 100 | 100 | 89 | 1504 | 2845 | 34 | 0 | 1504 |
| history-returning-mobile | 3 | 95 (68–99) | 100 | 100 | 90 | 1596 | 2672 | 108 | 18 | 1596 |

### v2

| Page audit | n | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | CLS ×1000 | SI ms |
|---|---|---|---|---|---|---|---|---|---|---|
| archive-first-mobile | 3 | 82 (75–92) | 100 | 100 | 89 | 1545 | 2875 | 500 | 0 | 1569 |
| archive-returning-mobile | 3 | 95 (95–96) | 100 | 100 | 90 | 1505 | 2799 | 20 | 0 | 1505 |
| board-first-mobile | 3 | 95 | 100 | 100 | 89 | 1503 | 2834 | 52 | 0 | 1503 |
| board-returning-mobile | 3 | 94 (94–100) | 96 | 100 | 90 | 1503 | 2928 | 13 | 0 | 1503 |
| daily-mixed-first-mobile | 3 | 96 (79–99) | 100 | 100 | 89 | 1510 | 2725 | 103 | 0 | 1510 |
| history-first-mobile | 3 | 94 (91–95) | 100 | 100 | 89 | 1510 | 2878 | 121 | 0 | 1510 |
| history-returning-mobile | 3 | 97 (86–99) | 100 | 100 | 90 | 1504 | 1611 | 161 | 0 | 1504 |

### v3

| Page audit | n | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | CLS ×1000 | SI ms |
|---|---|---|---|---|---|---|---|---|---|---|
| archive-first-mobile | 3 | 100 (98–100) | 100 | 100 | 89 | 1143 | 1682 | 61 | 0 | 1143 |
| archive-returning-mobile | 3 | 99 (96–100) | 100 | 100 | 90 | 760 | 904 | 6 | 0 | 760 |
| board-first-mobile | 3 | 98 (95–100) | 100 | 100 | 89 | 1155 | 1702 | 157 | 0 | 1326 |
| board-returning-mobile | 3 | 100 (93–100) | 96 | 100 | 90 | 1162 | 1683 | 52 | 0 | 1162 |
| daily-mixed-first-mobile | 3 | 100 | 100 | 100 | 89 | 760 | 910 | 24 | 0 | 927 |
| history-first-mobile | 3 | 98 (98–100) | 100 | 100 | 89 | 761 | 911 | 155 | 0 | 1216 |
| history-returning-mobile | 3 | 99 (98–100) | 100 | 100 | 90 | 755 | 1682 | 33 | 18 | 755 |

