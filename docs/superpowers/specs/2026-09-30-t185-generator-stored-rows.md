# Ticket spec: Schedule generator on stored rows

Spec for #185. Tracker: https://github.com/mquesada02/portdle/issues/185. Parent: Spec 5 (Dailies from the backend), https://github.com/mquesada02/portdle/issues/181 (`docs/superpowers/specs/2026-09-30-spec5-dailies-backend.md`, "Schedule Action and generator", "Development and CI", "Terms used in this spec"). Map: https://github.com/mquesada02/portdle/issues/169. Decisions: #171, #173, #177. Predecessor: #184 (`docs/superpowers/specs/2026-09-30-t184-catalog-schedule.md`). Base branch: `spec5`.

## Problem Statement

The Schedule generator works on JSON files that the daily freeze commits to the repository. The backend now holds the catalog and the Schedule (#184), but nothing writes the Schedule there. The shuffles use a public seed, so the code alone predicts every future order. The generator also depends on `identity.json`, which the database triggers replace.

## Solution

The generator runs against Postgres as the `schedule_generator` role. It reads the catalog and the stored Schedule rows, rebuilds each category's cycles from the rows, plans the missing and future days, and writes the result in one transaction. Every shuffle is driven by HMAC-SHA256 keyed with a secret, so revealed days do not give the future (owner decision Q1, 2026-10-02). An invalid catalog fails the run with no writes. `pnpm dev` and CI run the generator once on the local stack with a dev secret and a fixed local password, which fills the Schedule through the frozen-through day + 7. The live workflow and the file-based `gen:schedule` stay as they are until #194.

## User Stories

1. As the owner, I want the generator to rebuild each cycle exactly from the stored rows (entry ids in day order, grouped by `cycle_start`), so that no state outside the database is needed.
2. As the owner, I want no row on or before the frozen-through day to change, so that a past Daily keeps its answer.
3. As the owner, I want the generator to insert a past day that has no row yet, so that a missing day is filled after an Action outage or, on the local stack, after the switch-over day.
4. As the owner, I want rows after the frozen-through day replaced when the catalog changed (A2: a new or retired answer-eligible entry re-shuffles into the current cycle's future tail only), so that Dailies follow the catalog.
5. As the owner, I want the first run after the import to fill each current cycle's tail from the day after the switch-over day with the cycle's unused entries, so that each entry is used once per cycle and no exposed future order survives.
6. As the owner, I want every shuffle keyed by a secret, so that the code alone cannot predict a future Daily and revealed days do not give the rest of a cycle.
7. As the owner, I want the run to fail with no writes when the secret is missing or empty, or when the catalog breaks a whole-catalog rule, so that a bad edit or a bad setup never produces a bad Schedule.
8. As the owner, I want all writes in one transaction, so that a failure leaves the Schedule as it was.
9. As the owner, I want coverage through the frozen-through day + 7 and same-day distinctness across the three Daily categories, so that the Schedule never runs out and never repeats an entry across categories on a day.
10. As a developer, I want `pnpm dev` to fill the local Schedule through the frozen-through day + 7 with the generator role and a dev secret, so that I develop against the real rules.
11. As a developer, I want the CI job to run the same fill once before the SQL tests, so that the database write path is tested.
12. As the owner, I want the generator on stored rows to need no `identity.json`, so that ticket #194 can delete the file.

## Implementation Decisions

### Pure engine (`src/engine/schedule-gen.ts`)

- New export `generateFromRows(input)` with input `{ frozenThrough, protocols, applications, rows, random }`:
  - `frozenThrough`: date string, the later of the server's UTC date and the switch-over day, read from the database by the runner (never computed in TypeScript).
  - `rows`: stored rows `{ category, day, entryId, cycleStart }` (dates as `YYYY-MM-DD`).
  - `random`: `(seedKey: string) => () => number`, a factory the caller supplies. The engine imports no `node:crypto`, so it stays browser-safe under `tsconfig.app.json`.
  - Output: `{ insert: StoredRow[], remove: StoredRow[], issues: string[] }`. `remove` holds stored rows dated after `frozenThrough` that the plan changes or drops; `insert` holds new rows (days the plan adds, including missing days on or before `frozenThrough`, and the replacement for each removed row). When `issues` is not empty, the caller writes nothing.
- Cycles are rebuilt per category by grouping rows by `cycleStart` (start day = index from the epoch 2026-09-09; order = entry ids by day). A category with no rows is a fresh start from the epoch (days from the epoch through `frozenThrough` come out as `insert`). A row set that is not one unbroken range from the epoch, or a cycle whose first row is not on its `cycleStart` or whose days are not consecutive, is reported as an issue (the run fails with no writes), because the planner would otherwise write from a wrong picture.
- For each category, A2 runs with "today" = `min(frozenThrough, last stored day)`: A2's "today" is the frozen-through day (parent spec) clamped to the last stored day when that is earlier, because a cycle can only be completed from its last stored row. Coverage runs with `frozenThrough`: every category reaches at least `frozenThrough` + 7 with no gap. Coverage appends whole cycles, so a category can reach further. Together this plans each category from the day after the earlier of its last stored day and the frozen-through day (parent spec). A partial last cycle (as the import leaves it) is completed with its unused answer-eligible entries, shuffled with the secret, so the cycle uses each entry once. Days between the last stored day and `frozenThrough` are missing days and come out as `insert`; days after `frozenThrough` that already have a row come out as `remove` and `insert` only if the plan changes them.
- When A2 changes the current cycle (its length changes), every cycle after it is dropped and re-appended by coverage, because the later cycles' start days no longer fit; their stored rows come out as `remove` and `insert`. When A2 changes nothing, later cycles stay, so a retired entry that sits in a later cycle stays served until that cycle becomes the current one (the old behavior, and the "current cycle's future tail only" rule).
- In this path Mixed distinctness swaps only inside one cycle (a later day first, then an earlier day), only with days that are movable (a row the plan inserts, or a stored row dated after the frozen-through day; never a stored row on or before it), and only when both days stay distinct from the other two categories after the swap. A collision on a new past day (a missing day on or before `frozenThrough`) is therefore fixed by a swap like any other. A swap across cycles would leave one cycle with a duplicate and another without an entry, which breaks "each entry once per cycle" and makes the next run's A2 see a changed cycle. If a collision has no such swap, the run reports an issue and writes nothing; the old path's collision fallbacks (replace with an unused entry, or append a cycle and retry the day) become that same issue in this mode, since they break "each entry once per cycle" or can loop. Appending a whole Mixed cycle for a day Mixed does not cover yet (another category's coverage reached further) is not a collision fallback: it stays, and its rows are new rows whose days are then checked. The old path keeps its swap and fallbacks (`sameCycleOnly` is a parameter, off by default).
- Distinctness runs from the first day that is not stored-and-frozen in Mixed (`min(frozenThrough, last stored Mixed day) + 1`), so no frozen stored row ever moves.
- The existing internals (`applyA2`, `coverThrough`, `resolveDistinctness`, `appendCycle`, `shuffleSorted`) take the `random` factory as a parameter. The default factory is the current `mulberry32(hashSeed(key))`, so `generateSchedules` and `gen:schedule` behave exactly as before and every existing test passes unchanged.
- Validation of the result reuses `validateSchedules` (catalog rules, pool floors, miss-only entries, coverage through `frozenThrough` + 7, same-day collisions after `frozenThrough`). The whole-catalog checks stay whole-catalog. Only the unknown-id check on cycles concerns frozen rows (an id missing from the category's catalog kind, which can arise if the owner edits the catalog kind of a past answer, #177): `validateSchedules` gains an optional `stored: { fromDay }` option so that check starts after the frozen-through day; the same option makes its issue text name categories and days, never entry ids. The old call sites do not pass it. The engine also reports an issue when the plan would change a stored row dated on or before `frozenThrough`, and when a row the plan inserts, dated on or before `frozenThrough`, collides with a stored row of another category on that day that cannot move (a collision between two stored rows is old history and never fails a run; the run fails with no writes instead of writing a collision).
- `remove` and `insert` are a diff keyed by `(category, day)`: a stored row after `frozenThrough` is changed when the plan gives that day another `entryId` or another `cycleStart`, and a row the plan keeps unchanged is neither removed nor inserted. The same key decides "the plan would change a stored row on or before `frozenThrough`". This is a deliberate refinement of the parent spec's "replaces rows after the frozen-through day": the resulting rows are the same.

### Secret seed

- The secret comes from the environment variable `SCHEDULE_SEED`. It must be non-empty after trimming; a missing, empty, or whitespace-only value fails the run with no writes.
- `scripts/hmac-random.ts`: `hmacRandom(secret)` returns a factory. For a seed key it yields a stream: the `i`-th number is the first 6 bytes of `HMAC-SHA256(secret, "<seedKey>:<i>")` divided by 2^48. The shuffle is the existing Fisher-Yates over the sorted ids.
- Losing the secret changes no stored answer (parent spec).

### Database runner (`scripts/schedule-store.ts`)

- `runGenerator(client, secret)` validates the secret first (through `hmacRandom`, which throws on an empty or whitespace-only value) before any query, so a missing-secret run sends no query at all. It takes a minimal `Queryable` (`query(text, params?) => Promise<{ rows }>`), so unit tests drive it with a recording fake. Steps, all inside `begin` ... `commit`: take `pg_advisory_xact_lock` as the first query; read `select public.schedule_frozen_through()::text`; read all `catalog_entries`; read all `schedule` rows ordered by category and day, selecting `day::text` and `cycle_start::text` (the `pg` driver turns `date` columns into local-time `Date` objects, which would shift days on a non-UTC machine); map them to `CatalogEntry` (`answer_eligible` to `answerEligible`, `retired`, `aliases`, `sources`, null `blurb` to undefined, and `id`, `name`, `port`, `transport`, `description` unchanged (a test checks the mapped object has every `CatalogEntry` field), `kind` splits protocols and applications) and `StoredRow`; call `generateFromRows`; if `issues` is not empty, `rollback` and throw with the issue list; else delete the `remove` rows, then insert the `insert` rows, `commit`. Any error rolls back.
- Writes go through the Schedule's own triggers and policies, so a bug that touches a frozen row fails in the database as well.
- The run takes `pg_advisory_xact_lock` on a fixed key right after `begin`, so two runs at once (two worktrees on the shared local stack, or a manual run during a scheduled one) queue instead of failing on the primary key. The Action's concurrency group (#194) is a second line.
- The connection string goes to `pg` unchanged in `schedule-generator.ts`, with no SSL override. The live string uses user `schedule_generator.<project ref>` and the pooler's SSL settings; #194 owns them.

### CLI and scripts

- `scripts/schedule-generator.ts` (package script `schedule:generate`): reads `SCHEDULE_DATABASE_URL` (a Postgres connection string for the generator role; on the live project the pooler in session mode, port 5432) and `SCHEDULE_SEED`, connects with `pg`, runs `runGenerator`, prints one summary line (rows inserted and removed per category), exits non-zero on failure.
- `scripts/fill-local-schedule.ts` (package script `dev:schedule`; it exports its function and runs its command-line body only when it is the entry file, because `dev.ts` imports it): connects to the local stack's database as `postgres` (`DATABASE_URL`; `scripts/dev.ts` passes the `DB_URL` that `supabase status -o env` prints, which `scripts/stack-env.ts` gains; the CI default is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, as `scripts/run-sql-tests.sh`), runs `alter role schedule_generator with password 'schedule-generator-local'` (a fixed local password; nothing secret), then runs `runGenerator` as the generator role with that password and the dev secret `portdle-dev-seed`. It parses `DATABASE_URL` with `new URL`, decodes the percent-encoded user and password (`decodeURIComponent`), and refuses to run unless the parsed host is `127.0.0.1`, `localhost`, or `::1`; both connections (the `postgres` one and the generator one) are built from the parsed user, password, host, port, and database (never from the raw string), and a non-empty query string is refused (it could carry `host=` or `hostaddr=`), so the check and the connections cannot disagree; the host compares in the bracketed form `[::1]` that `URL.hostname` returns, and so a mistaken override can never set a known password on a live role; a unit test covers the check, including a userinfo trick, a multi-host string, `?host=`, and `?hostaddr=`. The dev data is never synced with the live project.
- `scripts/dev.ts` calls the fill after `supabase migration up` and before it starts Vite; a failed fill stops `pnpm dev` with the error.
- CI: the `sql-tests` job gains pnpm, Node, and `pnpm install --frozen-lockfile` steps (same pattern as the `build` job), then `pnpm dev:schedule`, then `scripts/run-sql-tests.sh`. The `build` job's `pnpm gen:schedule --check` stays until #194.
- Dependencies: `pg` and `@types/pg` (dev). `scripts/*.ts` are linted and run by `tsx`; the new non-test scripts are added to `tsconfig.node.json` `include`, so `pnpm typecheck` checks them. The engine files use extensionless imports, which `module: nodenext` rejects, so the node config moves to `module: esnext` with `moduleResolution: bundler` if that is the smallest change that typechecks. `pnpm typecheck` must stay green, `pg` is imported in the form that typechecks under the chosen module settings, and the pull request records the result. If the config change needs more than that, the new scripts are left out of `include` (the existing gap) rather than loosening the engine imports, and the pull request says so.

### Out of scope

- The Schedule Action workflow, repository secrets, and the owner runbook (#194). The old file-based generator, `identity.json`, the committed schedule files, and `gen:schedule` stay until #194. Any client change. The `late` column and the global stats view.

## Testing Decisions

- Good tests assert the plan and the written rows through the highest seam: pure unit tests on `generateFromRows`, and `runGenerator` against a recording fake `Queryable`. Real-database behavior (triggers, grants, the pooler) is covered by the CI run and a local run on the stack.
- Unit tests (`src/engine/schedule-gen.test.ts`, `scripts/schedule-store.test.ts`, `scripts/hmac-random.test.ts`):
  - cycles are rebuilt from rows (a full cycle and a partial last cycle) and a broken row set is reported;
  - no row on or before `frozenThrough` appears in `remove`, and none changes;
  - a different secret gives a different order, and the same secret gives the same order;
  - the first run after an import-shaped row set (rows built from the committed catalog and schedule files through the switch-over day, so the old file generator's cycle swaps are in the data, with cycles cut at the switch-over day) fills each current cycle's tail so each entry appears once per cycle, and every new row carries its cycle's `cycleStart`. Any completed import cycle that does not hold each entry once is reported to the coordinator, not hidden;
  - missing days up to `frozenThrough` come out as `insert` (switch-over day before the server's date);
  - an A2 case: a retired entry in the future tail is replaced, and `remove` and `insert` hold only rows after `frozenThrough`;
  - an invalid catalog and a broken row set write nothing: the fake records no `delete` or `insert`, a `rollback` is sent, and the run throws; a missing or whitespace-only secret throws before any query is sent;
  - same-day distinctness and coverage through `frozenThrough` + 7 hold in the output, also when the last stored day is before `frozenThrough`;
  - A2 that changes a cycle followed by another cycle leaves no overlap and no gap (later cycles re-appended);
  - a retired entry is out of the pool (the mapping carries `retired`);
  - a collision of an inserted past row with a frozen row of another category is reported and writes nothing;
  - `delete` statements are sent before `insert` statements inside the transaction;
  - the A2 clamp with a complete last cycle and a last stored day before `frozenThrough`: a new eligible entry joins that cycle as a past missing day, and nothing stored changes;
  - A2 that shrinks a cycle (retired entry, no replacement) and A2 that grows one, each with a later cycle;
  - Mixed distinctness swaps stay inside one cycle (each cycle still holds each entry once) and a re-run on that output plans nothing; a collision with no same-cycle swap writes nothing;
  - a re-appended cycle that carries the same entry on a day but another `cycleStart` is a changed row;
  - Mixed distinctness never moves a frozen stored row;
  - a stored cycle id missing from its category's catalog kind, dated on or before `frozenThrough`, does not fail the run;
  - an empty category is a fresh start;
  - Mixed has no cycle for a day that another category's coverage reaches: a whole Mixed cycle is appended, no issue;
  - a collision between two stored rows on or before `frozenThrough` does not fail the run;
  - a swap whose displaced Mixed entry would equal another category's entry on the partner day is not used; a swap with an earlier movable day is used when no later day fits;
  - the advisory lock is the first query after `begin`, and issue text names no future entry id;
  - the `date::text` mapping gives the same rows with `TZ=America/Los_Angeles`;
  - `fill-local-schedule` refuses a non-local host.
- The pure engine tests use the existing `entry` helpers and the injected `random`; no test uses `node:crypto` except the `hmacRandom` test.
- A local run on the stack: `pnpm dev:schedule` twice (the second changes nothing), then a `psql` check that each category's `max(day)` is at least the frozen-through day + 7 and the range has no gap; then, as `postgres`, flip `answer_eligible` of one entry used in a future row, rerun (the delete and insert path runs against the real triggers), check, and flip it back; `pnpm test:sql` stays green after the fill.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:sql`, and `pnpm build` pass; CI is green.

## Acceptance Criteria Map (#185)

- Unit tests (cycles rebuilt, frozen rows unchanged, secret changes order, first run fills tails once per cycle, missing past days inserted, invalid catalog writes nothing) → unit tests above.
- A local-stack run as the generator role fills the Schedule through today + 7 → `dev:schedule` and the local check. Deliberate reading: "today + 7" is the frozen-through day + 7 (the parent's coverage rule); the two are equal whenever the switch-over day is on or before the server's date, as the placeholder is.
- `pnpm dev` and the CI job include that run → `scripts/dev.ts` and the `sql-tests` job.
- The generator on stored rows no longer needs `identity.json` → `generateFromRows` takes no identity.

## Further Notes

- Author calls to confirm with the owner before implementing: the `pg` dependency; the names `SCHEDULE_DATABASE_URL`, `SCHEDULE_SEED`, `schedule:generate`, `dev:schedule`; the fixed local password and dev secret values; diff-based writes (delete only changed rows after the frozen day, insert changed and new rows) instead of replacing every row after it; the same-cycle-only Mixed swap in this path; the `DB_URL` in `stack-env.ts`; the local-host guard; the clamp of A2's "today" to the last stored day; dropping and re-appending cycles after a changed cycle; the `fromDay` option for the unknown-id check; the collision issue on frozen days; adding the new scripts to `tsconfig.node.json`; the local default `DATABASE_URL` port 54322; failing on a broken stored row set; the generator reading the frozen-through day from `public.schedule_frozen_through()`; the sql-tests job running the fill before the SQL tests.
- The local stack is shared by every worktree of the repository (one `project_id`); the fill is idempotent and takes the advisory lock, so concurrent worktrees do not conflict.
- The parent spec's single CI job (generator run, SQL tests, Playwright) is built up over the tickets; this ticket adds the fill to the existing `sql-tests` job and #193 adds Playwright. `dev.ts` stopping on a failed fill is checked by a local run with the role missing, not by a unit test.
- The secret is checked (non-empty after trimming) in `hmacRandom`, before any connection or `begin`, so a missing-secret run sends no query at all; the rollback assertion in the tests applies to issue runs (invalid catalog, broken rows, collisions).
- `scripts/stack-env.test.ts` fixtures gain `DB_URL`.
- If CI goes red on a new UTC day at `gen:schedule --check`, the coordinator syncs `spec5` with `master`.
- The generator appends whole cycles, so after the fill the Schedule can extend well past `frozenThrough` + 7 (a Mixed cycle spans the whole pool). The Spec 4 and #184 SQL tests insert rows at fixed offsets from the server's date (+20, +30, +40 days). This is certain, not a risk: `schedule-triggers.sql` and `schedule-rls.sql` (including its `count = 3` assertion and the comment about the seven-day horizon) derive their future days from the Schedule's `max(day)` plus a margin instead of fixed offsets (every fixture, and the `switch_over_day()` override in the trigger test, sits beyond that maximum; the edits are checked with `pnpm test:sql` after a fill), so they also survive catalog growth. This is a #184 test edit, inside this ticket because the CI job runs the fill first.
- The issue text that `runGenerator` throws and the CLI prints carries categories and days only, never an entry id dated after the frozen-through day, because CI and Action logs are not a place for future answers. `validateSchedules` messages that name such ids are mapped to day-and-category text.
- The frozen-through day is read once per run. A run that straddles UTC midnight can try to delete a row that just became frozen; the guard rejects it, the transaction rolls back, and the next run fixes it.
- Live TLS and the pooler are untested by this ticket; `pg` reads `sslmode=require` as verify-full, which the pooler's certificate chain may not satisfy. #194 owns it and the owner's pooler check covers it.
- A collision on a frozen day, or a Mixed collision with no same-cycle swap, fails every run until the owner fixes it by hand in SQL (the runbook in #194 names it). Both are rare: the three categories are written together.
- The pull request targets `spec5` with title `feat(schedule): generator on stored rows` and "Closes #185" in the body.
