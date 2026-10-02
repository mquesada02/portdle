# Ticket spec: Catalog and Schedule in Postgres

Spec for #184. Tracker: https://github.com/mquesada02/portdle/issues/184. Parent: Spec 5 (Dailies from the backend), https://github.com/mquesada02/portdle/issues/181 (`docs/superpowers/specs/2026-09-30-spec5-dailies-backend.md`, "Terms used in this spec", "Backend schema", "Owner steps at release"). Map: https://github.com/mquesada02/portdle/issues/169. Decisions: #172, #173, #177. Base branch: `spec5`.

## Problem Statement

The catalog and the Schedule exist only as JSON files in the site bundle. Nobody can protect a past Daily from a mistaken edit, hide future answers, or change an entry without a commit. The backend has no table for either, no role for the Schedule Action, and no way for a client to ask "what is today's Daily" from the server's clock.

## Solution

The catalog and the Schedule live in Postgres on the Supabase project, with every protection the spec lists. Anyone can read the catalog and the Schedule up to the server's UTC date. Nobody can change the past. Only the generator role writes Schedule rows. One constant in the repository, the switch-over day, feeds the one generated migration that imports every row from 2026-09-09 through that day. A SQL function returns the server's time, its UTC date, and the three current Dailies. The ticket hands the owner a pooler check for the generator role before ticket #185 builds on it.

No client behavior changes in this ticket. The client still reads the JSON files until ticket #186; the constant file is not imported by the client until then.

## User Stories

1. As the owner, I want the catalog in a table, so that I can edit entries in the Supabase dashboard without a commit.
2. As the owner, I want every committed entry imported with its fields unchanged, so that nothing about the catalog is lost.
3. As the owner, I want every committed Schedule row from 2026-09-09 through the switch-over day imported, so that every past Daily keeps its answer.
4. As the owner, I want each imported row to store the start day of its cycle, so that the generator can rebuild cycles exactly (#185).
5. As the owner, I want one constant to name the switch-over day, so that the import and every rule that depends on the day move together.
6. As the owner, I want a test to fail when the generated migration differs from the committed files, so that a catalog edit merged from `master` forces a regeneration.
7. As the owner, I want the database to reject a port outside 0 to 65535, an unknown transport, an unknown catalog kind, and an empty name, so that the dashboard cannot store a broken entry.
8. As the owner, I want the database to reject every delete of an entry, for any role, including truncate, and every change of an entry id, so that no History row or Codex card loses its entry.
9. As the owner, I want the database to reject a change to the name or port of an entry that a Schedule row on or before the frozen-through day uses, so that old results and shares stay true.
10. As the owner, I want `retired`, `answer-eligible`, and the text fields to stay editable on every entry, so that I can retire and fix entries.
11. As a visitor (anon) or signed-in player, I want to read all entries, so that Blitz and the Codex can load the catalog (#186).
12. As a visitor or signed-in player, I want to read Schedule rows dated on or before the server's UTC date only, so that no future answer is readable.
13. As a visitor or signed-in player, I want to be unable to insert, update, or delete a catalog or Schedule row, so that nobody tampers with Dailies.
14. As the owner, I want the database to reject any Schedule write by a role other than the generator role, so that only the Action writes Schedule rows.
15. As the owner, I want the database to reject an update or delete of a Schedule row dated on or before the frozen-through day, for every role, so that a mistake in the dashboard cannot rewrite a past Daily.
16. As the owner, I want the database to reject an update that moves a Schedule row to a day on or before the frozen-through day, so that no row slips into the frozen past.
17. As the owner, I want the generator to insert a past day that has no row yet, so that a missing day can be filled after an outage.
18. As the owner, I want the frozen-through day to be the later of the server's UTC date and the switch-over day, so that imported rows stay safe whenever the server's date is before the switch-over day (the local stack and CI before the release day, and the tests that move the day).
19. As a client developer, I want one SQL function to return the server's current time, its UTC date, and the Daily entry id of each of the three categories, so that the client never computes "today" itself (#186).
20. As a client developer, I want that function to return three rows even when a category has no row for the date (entry id null), so that a missing day is told apart from a failed read; ticket #186 treats a null entry id as a failed read.
21. As a client developer, I want visitors and signed-in players to be able to call that function, so that no sign-in is needed to load the Daily.
22. As the owner, I want a login role for the generator with no password in the repository, created by a migration that is safe to run twice, so that no secret is committed and an early apply does not break the release.
23. As the owner, I want that role to read entries and the Schedule and write the Schedule only, so that a leaked Action secret cannot touch player data.
24. As the owner, I want to apply only the role migration to the live project before the switch-over day, so that I can check the pooler early.
25. As the owner, I want exact steps for the pooler check (session mode, port 5432, user `schedule_generator.<project ref>`), so that I can run it without guessing.
26. As the owner, I want the result of the pooler check recorded on this ticket, so that ticket #185 builds on a verified role.
27. As the owner, I want work to stop and go back to me if the pooler rejects the role, so that there is no silent fallback to the service key.
28. As a developer, I want SQL tests for every rule above to pass in CI on the local stack, so that a migration mistake fails the pull request.
29. As a developer, I want a SQL test to move the switch-over day inside a rolled-back transaction, so that the case "switch-over after the server's date" is tested without waiting for a date.
30. As a developer, I want the new SQL tests to leave no rows behind, so that the local stack and CI stay clean (an entry can never be deleted).

## Implementation Decisions

### The switch-over constant

- One constant, `SWITCH_OVER_DAY`, lives in one TypeScript file, `src/engine/switch-over.ts` (covered by `pnpm typecheck` through the app tsconfig; the new script follows `scripts/gen-schedule.ts`, which `tsconfig.node.json` does not list, and is linted and run by `tsx` and Vitest), so a later ticket's client build can import it. Placeholder value `2026-10-01` (owner call, 2026-10-02; it is earlier than the server's date on purpose, since the frozen-through day takes the later of the two); ticket #194 sets the release day and regenerates.
- A new generator script (`scripts/gen-catalog-migration.ts` with a test beside it; package script `gen:catalog-migration`, distinct from the existing `gen:schedule`) reads the committed catalog JSON files, the committed schedule files, and the constant, and writes one migration. It has a `--check` mode that exits non-zero when the committed migration differs from what it would write. A Vitest test runs the same comparison, so the build job fails on drift; CI gets no new step. This is the owner's decision (Q1): the literal day lives in the one generated file, not in hand-written SQL.
- The generated migration holds (1) `public.switch_over_day()`, an `immutable` `language sql` function with `set search_path = ''` returning the constant as a date, and (2) the import: every entry, and every Schedule row from 2026-09-09 through the switch-over day.
- The import maps the committed files: each category's schedule gives, for a day index from the epoch, the entry id of the cycle covering it and that cycle's `startDay` converted to a date. The catalog kind comes from the file an entry sits in. An entry without `aliases` gets an empty array and one without `blurb` gets null. The migration quotes every text value safely (aliases, descriptions with quotes, source labels).
- The generator script throws when any day from the epoch through `SWITCH_OVER_DAY` has no covering cycle, so a gap can never pass silently.
- All hand-written SQL calls `public.switch_over_day()`. The criterion "one constant feeds every artifact the spec names" is met here by `switch_over_day()` (which the frozen-day triggers call through `schedule_frozen_through()`) plus the import; the `late` migration and the client build, in later tickets, read the same constant.

### Conventions for all new SQL

- Every function sets `search_path = ''` and uses schema-qualified names, as the Spec 4 migrations do. Volatility: `switch_over_day()` is `immutable`; `server_utc_date()`, `schedule_frozen_through()`, and `current_dailies()` are `stable`.
- Immediately after each new table is created, `revoke all on ... from public, anon, authenticated`, then explicit grants. "Automatically expose new tables" is off.
- Every new function starts with `revoke all on function ... from public, anon, authenticated` (as the Spec 4 migrations do; Supabase's default privileges grant `execute` on new functions to `anon` and `authenticated`), then explicit grants. Each migration that creates a function holds the grants for it. `anon` and `authenticated` get `execute` only on `server_utc_date()` and `current_dailies()`.
- In prose the term is "answer-eligible" (glossary); in SQL it is the column `answer_eligible`.

### Migrations, in filename order (owner call, 2026-10-02)

The files are `20261001000007_schedule_generator_role.sql`, `20261001000008_catalog_schedule_tables.sql`, `20261001000009_catalog_schedule_import.sql` (generated), `20261001000010_catalog_schedule_protections.sql`, and `20261001000011_current_dailies.sql`; the text below calls them 0007 to 0011.

1. **Generator role** (0007, alone). Creates `schedule_generator` only if it does not exist yet, in one plpgsql `do` block that checks `pg_roles` (`login`, `nosuperuser`, `nocreatedb`, `nocreaterole`, `noinherit`, `nobypassrls`, no password). If the role exists, the file changes nothing and never touches a password. This makes the file safe to run twice: the owner applies it alone and early for the pooler check, and applies it again with the other migrations on the switch-over day. Migration 0007 holds no `begin` or `commit`, like the Spec 4 migrations, so the rollback in its test holds. The early apply is an owner-approved exception to "never earlier", for this role-only file, because the parent spec's "Generator role" requires the pooler check before any ticket builds on the role (owner decision, Q3). It grants nothing: table and schema grants are in 0008, and each function's grants are in the migration that creates the function. `connect` needs no grant, since it goes to `public` by default.
2. **Tables** (0008): `public.catalog_entries` and `public.schedule`, their `CHECK`s, the foreign key, row-level security and its policies, and all table and schema grants and revokes, including the generator role's table grants and `usage` on schema `public`. It also creates `public.server_utc_date()` (the policy needs it) with its grants.
3. **Generated import** (0009): see above. It holds the grants of `switch_over_day()`.
4. **Protections** (0010): `public.schedule_frozen_through()` and its grants, the triggers, and the truncate guards. It runs after the import, so the triggers need no exception.
5. **Current Dailies** (0011): the function.

### Entries table

- `public.catalog_entries`, one row per catalog entry (names are a public contract for tickets #186 onward): `id` (text, primary key, permanent), `kind`, `name`, `aliases` (text array, not null, default empty), `port`, `transport`, `description` (not null), `blurb` (nullable), `answer_eligible`, `retired` (not null, default false), `sources` (jsonb array of `{label, url}`, not null, default empty). Every column is not null except `blurb`.
- `CHECK`s: port 0 to 65535; transport one of `tcp`, `udp`, `both`; kind one of `protocol`, `application`; non-empty name (`btrim(name) <> ''`).
- No row-level security on this table (owner call). `anon` and `authenticated` get `select` only; the generator role gets `select`.
- A row-level `before delete` trigger raises for every role. A statement-level `before truncate` trigger raises for every role; and `truncate public.catalog_entries cascade` is stopped by the catalog's own guard first, with the Schedule table's guard as a second line (owner call: it closes the truncate hole in "rejects every delete").
- A row-level `before update` trigger raises when `id` changes (permanent id; owner call, Q3), and when `name` or `port` changes while a Schedule row dated on or before the frozen-through day uses the entry. Other columns stay editable. The trigger functions are `security invoker`. Entry edits are supported as `postgres` (the dashboard and SQL editor role), which owns the functions and is not subject to the Schedule table's row-level security; a `service_role` edit is not supported, since it has no `execute` on the revoked helper functions (author call, listed in Further Notes).

### Schedule table

- `public.schedule`: `category` (text, `CHECK` in `mixed`, `protocols`, `applications`), `day` (date), `entry_id` (not null, foreign key to `catalog_entries`), `cycle_start` (date, not null). Primary key `(category, day)`.
- Row-level security on. Policies: `anon` and `authenticated` may `select` rows with `day` on or before the server's UTC date; the generator role may `select` every row, and `insert`, `update`, `delete` with `using (true)` / `with check (true)`.
- Grants: `anon` and `authenticated` get `select`; the generator role gets `select, insert, update, delete`; none of the three gets `truncate`, `references`, or `trigger`. `service_role` keeps Supabase's default grants and is stopped by the triggers; the privilege tests cover `anon`, `authenticated`, and `schedule_generator`.
- Row-level `before insert or update or delete` trigger, `security invoker`: raises when `current_user` is not `schedule_generator`; on update and delete raises when the old `day` is on or before the frozen-through day; on update also raises when the new `day` is on or before it. Insert of a missing past day is allowed (spec review decision); the primary key stops a replacement.
- A statement-level `before truncate` trigger raises for every role.
- The owner disables a trigger on purpose as table owner to fix a real mistake (runbook in #194).

### Helper functions and the frozen-through day

- `public.server_utc_date()`: returns `(now() at time zone 'utc')::date`. Never reads the session time zone.
- `public.schedule_frozen_through()`: returns the later of `server_utc_date()` and `switch_over_day()`.
- `execute` grants: `server_utc_date()` goes to `anon` and `authenticated` (the read policy and `current_dailies()` call it) and to the generator role (it calls the helper functions below). `switch_over_day()` and `schedule_frozen_through()` go to the generator role, because the Schedule trigger runs as the invoker and calls them on update and delete (an insert calls neither); the entries trigger calls `schedule_frozen_through()` too, but runs as `postgres`, the owner, and needs no grant. With `execute` revoked from `public`, a missing grant makes a generator update or delete fail with "permission denied for function"; a test updates and deletes a future row (server date plus 30 days) under `set role schedule_generator`, which exercises both functions.

### Current Dailies function

- `public.current_dailies()` (rows join `schedule` on `s.day = public.server_utc_date()`), `language sql`, `stable`, `security invoker`, no arguments, `set search_path = ''`. Returns a table `(server_time timestamptz, utc_date date, category text, entry_id text)` with always three rows, built by a left join from a `values` list of the three categories with an ordinal that fixes the order `mixed`, `protocols`, `applications` (the body qualifies every column, since the output names `category` and `entry_id` match columns of `schedule`); `entry_id` is null when the Schedule has no visible row for the date (owner call). `server_time` is `now()`, `utc_date` is `server_utc_date()`.
- A null `entry_id` is the "no row for that date" case of the parent spec; ticket #186 must treat it as a failed read and show the error panel's server message.
- `anon` and `authenticated` get `execute`; revoked from `public`. The client calls it by POST (ticket #186).

### Generator role

- Login role `schedule_generator`, created with no password in the repository. The dev and CI setup step sets a fixed local password later (ticket #185). The owner sets the live password in the SQL editor and keeps it only as a repository secret.
- Rights: `usage` on schema `public`; `select` on `catalog_entries`; `select, insert, update, delete` on `schedule`; `execute` as listed above; nothing else. The role has no right on any Spec 4 table. The role does not create objects: a test asserts that `has_schema_privilege('schedule_generator', 'public', 'create')` is false. If it fails, the question goes to the owner; the migration never revokes `create` from `public`.
- The Schedule triggers identify the role by `current_user`. The role needs no row-level security policy on `catalog_entries`, which has none.

### Pooler check hand-off

- UNVERIFIED in the spec: Supabase's pooler accepts a custom login role on the Free plan (user `schedule_generator.<project ref>`). The Action connects in session mode (port 5432).
- Migration 0007 is separate, creates only the role, and is safe to run twice. So the owner can apply just that file to the live project, set a password, and connect through the pooler, and apply it again at release with no harm. The release step "set the role's password" is not repeated by a re-run of 0007.
- When migration 0007 exists, the worker sends the owner (through the coordinator) the exact steps: the SQL to run (migration 0007; `alter role schedule_generator with password '...'`), the connection string shape for the pooler in session mode, and a test that runs a two-statement transaction (`begin; select current_user; select 1; commit;`). The owner reports the result; the worker records it on #184.
- Ticket #184 closes by hand only after the recorded result (the pull request targets `spec5`, so "Closes #184" does not close it). Ticket #185 stays blocked until then.
- If the check fails, work stops and the question goes to the owner. There is no fallback to the service key.

## Testing Decisions

- A good test runs the real stack: real migrations, real `psql`, real triggers. It checks that a statement raises or succeeds and what rows remain. It never mocks the database.
- Seam: the local Supabase stack from #183, through the existing runner (`pnpm test:sql`). New SQL test files follow the Spec 4 pattern (`assert` or `raise exception`, a notice on success, no rows left behind). A test file that changes data, roles, or functions has the shape `begin; do $$ ... $$; rollback;`: one plpgsql block (so `assert` and `raise exception` work, as in Spec 4), a notice raised at its end, and a rollback after it, so role grants and a replaced `switch_over_day()` or `server_utc_date()` never leak. Inside the block: `set local role` then `reset role` around each case; an expected failure is caught in a nested `begin ... exception when others then ... end` block that matches the guard's own message or `SQLSTATE` (so a trigger error is told apart from `permission denied`, and the case runs as the role that reaches the trigger, such as `postgres` or `schedule_generator`); the role grant and every `create or replace` come first in the block. The runner and CI job are extended by new files only, not replaced.
- Entry tests do not depend on live data: each inserts its own throwaway entries as `postgres` inside the transaction (the Schedule's frozen days rise every day and soon cover every real entry). The editable name and port cases use a throwaway entry no Schedule row uses; the frozen name, port, delete, and id-change cases use an entry used by an imported row (2026-09-09) or a throwaway entry with its own frozen Schedule row.
- New SQL test files (names: `catalog-import.sql`, `catalog-entries.sql`, `schedule-rls.sql`, `schedule-triggers.sql`, `current-dailies.sql`, `generator-role.sql`): catalog import; entries protection (checks, no delete, no truncate and the `truncate ... cascade` case, frozen name and port, permanent id, editable fields, read grants, `has_table_privilege` for no write, truncate, references, or trigger grant for `anon`, `authenticated`, and `schedule_generator`; `service_role` holds Supabase's default grants and is stopped by the triggers instead); Schedule row-level security (the test inserts its own row per category at the server's UTC date plus 30 days (valid while the switch-over day stays within 30 days of the server's date) under `set role schedule_generator` in the rolled-back transaction; `anon` and `authenticated` see none of those rows, the generator sees them; the positive case for `anon` and `authenticated` reads an imported row such as 2026-09-09); Schedule triggers (writer by `current_user`, the generator inserts a missing past day under `set role` (a day before the epoch, such as 2026-09-01, since the import leaves no gap), no update or delete of a frozen row, no move into the frozen past, no truncate); current Dailies (three rows in the fixed order; `execute` rights; the cases do not depend on stored data past the switch-over day: inside the rolled-back transaction the test replaces `public.server_utc_date()` with a function returning a fixed date, the switch-over day for the non-null case and 2026-08-01 for the all-null case); generator role (login, not superuser, no createdb, createrole, or bypassrls, grants, no `create` on schema `public`, no right on Spec 4 tables, and running migration 0007's SQL twice leaves the same `pg_roles` row, with the same oid and attributes). The test cannot assert "no password": `postgres` cannot read `pg_authid` on Supabase, and ticket #185 sets a local password. That property is checked by reviewing the migration.
- A failed assertion under `ON_ERROR_STOP` ends the session, so the open transaction rolls back and no row stays on failure either. The truncate test uses `truncate ... cascade` only and matches the guard's own error message: a plain truncate of `catalog_entries` fails on the foreign key from `schedule` before the guard, so it is not tested.
- Schedule trigger tests that need a row after the frozen-through day (a move into the frozen past, an update to a future day) insert their own row at the server's UTC date plus 30 days (valid while the switch-over day stays within 30 days of the server's date) under `set role schedule_generator`, inside the rolled-back transaction, and do not depend on rows that exist.
- Role tests always run `grant schedule_generator to postgres` inside the rolled-back transaction (on Postgres 17 the creator of a role gets `admin` only, without the right to `set role`).
- The idempotency test sits outside any `do` block, because `\i` is a psql command: `begin;`, a `do` block that copies the role's `pg_roles` row into a temporary table, `\i supabase/migrations/20261001000007_schedule_generator_role.sql` twice, a `do` block that asserts the row is unchanged, `rollback;`. It runs inside the rolled-back transaction (`psql` runs from the repository root, because the runner changes to it); the role already exists from the stack's migrations, which is the case under test.
- Cases that need "switch-over after the server's date" run `create or replace function public.switch_over_day()` first in the rolled-back transaction, before any statement or trigger path that uses it in that session (a precaution, because the function is `immutable`).
- Import test (SQL, structural only; a SQL test cannot read the JSON files): every `catalog_entries` row has a valid kind (only the Vitest check below proves the rows equal the JSON); for rows with `day <= public.switch_over_day()` each category starts at 2026-09-09, has no gap (`count = max(day) - min(day) + 1`), and ends at the switch-over day; every Schedule row has an existing entry and a `cycle_start`. Rows after the switch-over day (added by ticket #185's generator run in the same CI job) are not asserted.
- Vitest: the generator's output holds exactly the entries of the two catalog JSON files and, per category, one row for each day from 2026-09-09 through `SWITCH_OVER_DAY`, each with its cycle's start date, and the committed migration equals that output (prior art: `scripts/gen-schedule.test.ts`); the generator's pure functions (day-index to date, SQL quoting) have unit tests.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:sql`, and `pnpm build` pass; CI is green.

## Out of Scope

- The generator reading or writing stored rows, the secret seed, and the dev and CI generator run (#185).
- The `dailies.late` column and its `CHECK`, and the global stats view (later tickets).
- Any client change: the client keeps importing the JSON files until #186. The files, `identity.json`, and the `gen:schedule --check` step stay until #194.
- The Schedule Action workflow and the owner runbook (#194).
- Applying anything to the live project, except the owner's early run of migration 0007 for the pooler check.
- Setting the release day: #194 sets `SWITCH_OVER_DAY` and regenerates.

## Further Notes

- Author calls, all accepted by the owner (Q1 and Q2, 2026-10-02): the constant and `switch_over_day()` function (option A); migration split and names; role name `schedule_generator` with `login` and no password and its grants; the Schedule table columns, primary key, and policies; no row-level security on entries; the extra guard on updates that move a row into the frozen past; truncate triggers; the shape of `current_dailies()` (three rows, null entry id); placeholder `2026-10-01`; the list of SQL test files and `set role` for role tests; the pooler check flow. `service_role` entry edits are not supported (the dashboard edits as `postgres`). Entries have no row-level security by the owner's call, which Supabase's advisor flags; a Schedule row may point to an entry that is retired or not answer-eligible, since the generator (ticket #185) owns that rule. Added after spec review round 1 (Q3): the id-change guard, the table and column names, the idempotent role migration and its early apply, and the `execute` grants for the generator.
- Glossary: "switch-over day" and "frozen-through day" stay spec terms (parent spec, "Terms used in this spec"), not `CONTEXT.md` terms.
- Facts to verify during implementation: that the migration's `create role` works for the `postgres` role on the local stack and on the live SQL editor; that `set role schedule_generator` works from the test connection (the test may need `grant schedule_generator to postgres`; that grant lives in the test, not in a migration).
- Daily freezes on `master` change `identity.json` and may append cycles after the switch-over day; neither changes the import, which stops at the switch-over day. A freeze that changes catalog JSON, or a schedule row on or before that day, fails the drift test; the worker tells the coordinator.
- The pull request targets `spec5` with title `feat(db): catalog and Schedule in Postgres` and "Closes #184" in the body. The keyword is only a link (the base is not the default branch); the issue is closed by hand after the pooler result is recorded.
