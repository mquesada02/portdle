# Lighthouse spread on GitHub runners

Ticket: Task: measure Lighthouse spread on GitHub runners (#273), map "Lighthouse targets and CI guard" (#266). Measured 2026-11-12 on master 024f172.

## Method

- Throwaway branch `diag/t273-lh-spread` (never merged): workflow `lh-spread.yml`, run 43144776370, 3 attempts: 1 at ~02:50 UTC, 2 at ~03:00 UTC, 3 at ~11:47 UTC.
- `ubuntu-latest`, one job per page (10 jobs), one Chrome and one Lighthouse run at a time per job, 5 runs per page audit, Lighthouse 12.8.2, the 28 page audits of #269 (first visit and returning player, mobile and desktop).
- Data: `pnpm build` with the live Supabase URL and anon key (repo variables), served by `vite preview` on the runner. The cheapest setup and the same as the baseline (#270).
- Analysis: `scripts/spread.mjs` (included). Single runs = all runs; median-of-3 = runs 1–3 of each attempt; median-of-5 = all 5 runs of an attempt; min–max and SD across attempts.

## Findings

- **Only mobile performance spreads.** Accessibility, best practices and SEO gave the same score on every one of the 410 runs. Desktop performance stays at 98–100 (SD ≤ 0.9).
- **Cold first run:** every run below 92 in all 3 attempts (18 runs, scores 54–90) is run 1 of the first audit in its job, that is the first Lighthouse run on a fresh runner. No other run scored below 92. A discarded warm-up run removes them.
- **Medians are stable:** median-of-3 and median-of-5 stay within 1–2 points across attempts and hours (SD ≤ 1.0 everywhere). Median-of-5 is not clearly better than median-of-3, even with the cold run inside it.
- **Runners differ:** CPUs seen: AMD EPYC 7763 and 9V74, Intel Xeon Platinum 8370C and 8573C; `benchmarkIndex` 109–4241 (median ~2760; the lowest values are the cold runs).
- **Launch flake:** 1 of 30 jobs (attempt 2, `daily-mixed`) failed before any audit: Chrome did not start (`waiting for dynamic debugging port in chrome-err.log`). A guard must retry a launch failure, separately from a low score.
- **Time:** 75–207 s per job for its 10–20 audit runs, plus ~1.5 min of setup; the 10 jobs ran in parallel in about 4–5 minutes wall time.

## Spread over 3 attempts (performance and accessibility rows that are not always 100)

### Perf

| Page audit | single runs | median-of-3 | median-of-5 |
|---|---|---|---|
| archive-first-desktop | 98–100 (SD 0.6) | 99–100 (SD 0.5) | 99–100 (SD 0.5) |
| archive-first-mobile | 70–99 (SD 8.6) | 96–98 (SD 0.9) | 96–98 (SD 0.9) |
| archive-returning-desktop | 98–100 (SD 0.8) | 98–100 (SD 0.9) | 98–100 (SD 0.9) |
| archive-returning-mobile | 92–95 (SD 1.1) | 93–95 (SD 0.9) | 93–95 (SD 0.9) |
| blitz-first-desktop | 98–100 (SD 0.5) | 98–99 (SD 0.5) | 99–99 (SD 0.0) |
| blitz-first-mobile | 84–99 (SD 4.2) | 98–98 (SD 0.0) | 98–99 (SD 0.5) |
| board-first-desktop | 99–100 (SD 0.5) | 99–100 (SD 0.5) | 99–99 (SD 0.0) |
| board-first-mobile | 74–99 (SD 7.9) | 98–98 (SD 0.0) | 98–99 (SD 0.5) |
| board-returning-desktop | 98–100 (SD 0.5) | 99–99 (SD 0.0) | 99–99 (SD 0.0) |
| board-returning-mobile | 93–95 (SD 0.7) | 93–95 (SD 0.8) | 94–95 (SD 0.5) |
| codex-first-desktop | 99–100 (SD 0.4) | 99–100 (SD 0.5) | 99–100 (SD 0.5) |
| codex-first-mobile | 76–99 (SD 6.1) | 98–99 (SD 0.5) | 98–99 (SD 0.5) |
| daily-applications-first-desktop | 99–100 (SD 0.2) | 99–99 (SD 0.0) | 99–99 (SD 0.0) |
| daily-applications-first-mobile | 86–99 (SD 4.0) | 98–99 (SD 0.5) | 98–99 (SD 0.5) |
| daily-mixed-first-desktop | 99–100 (SD 0.5) | 99–100 (SD 0.5) | 99–100 (SD 0.5) |
| daily-mixed-first-mobile | 83–99 (SD 5.2) | 98–99 (SD 0.5) | 98–99 (SD 0.5) |
| daily-protocols-first-desktop | 99–100 (SD 0.4) | 99–100 (SD 0.5) | 99–99 (SD 0.0) |
| daily-protocols-first-mobile | 54–99 (SD 11.1) | 98–99 (SD 0.5) | 98–99 (SD 0.5) |
| history-blitz-first-mobile | 65–99 (SD 9.0) | 98–99 (SD 0.5) | 98–99 (SD 0.5) |
| history-blitz-returning-mobile | 99–99 (SD 0.0) | 99–99 (SD 0.0) | 99–99 (SD 0.0) |
| history-first-mobile | 82–99 (SD 4.1) | 97–98 (SD 0.5) | 97–98 (SD 0.5) |
| history-returning-mobile | 98–99 (SD 0.3) | 98–99 (SD 0.5) | 99–99 (SD 0.0) |

### A11y

| Page audit | single runs | median-of-3 | median-of-5 |
|---|---|---|---|
| board-returning-desktop | 96–96 (SD 0.0) | 96–96 (SD 0.0) | 96–96 (SD 0.0) |
| board-returning-mobile | 96–96 (SD 0.0) | 96–96 (SD 0.0) | 96–96 (SD 0.0) |


benchmarkIndex over all runs: 108.5–4241 (median 2763.5)
Rows where every single run scored 100 are left out.
