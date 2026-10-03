# Owner runbook

Three jobs: edit entries, run the Schedule Action by hand, and fix a real mistake in a past answer. The Schedule Action is the GitHub workflow `.github/workflows/schedule-action.yml`. It runs the Schedule generator every day at 00:05 UTC.

Repository secrets the Action uses: `SCHEDULE_DATABASE_URL` and `SCHEDULE_SEED`. Repository variables the keep-alive job uses: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. This runbook holds no value of any of them.

## 1. Edit entries

1. Open the Supabase dashboard, Table Editor, table `catalog_entries`.
2. Edit the row. These fields stay editable on every entry: `retired`, `answer_eligible`, and the text fields (`aliases`, `description`, `blurb`, `sources`).
3. For a new entry, insert a row. For an entry that must leave play, set `retired` to true. The database rejects a delete, a changed `id`, and a changed `name` or `port` of an entry that a Schedule row on or before today uses.
4. Run the Schedule Action by hand (job 2), so a new or retired entry reaches the future days. Players read the catalog directly, so a text edit shows at once.

## 2. Run the Schedule Action by hand

1. Open the repository on GitHub, tab Actions, workflow "Schedule Action".
2. Press "Run workflow". Pick the default branch (`master`). A manual run uses the code of the branch you pick.
3. Wait for the run to end. Both jobs must be green: `generate` and `keep-alive`.

A run fills every missing day, so this is also the fix after an outage. The Schedule reaches today + 7, so an outage shorter than seven days loses no Daily. A failed run sends GitHub's failure email.

## 3. Fix a real mistake in a past answer

Use this only for a real mistake, for example a wrong port on an answer that players already saw. The database protects past rows on purpose.

1. Open the Supabase dashboard, SQL editor. It runs as the table owner (`postgres`).
2. Disable the trigger:

   ```sql
   alter table public.schedule disable trigger guard_schedule_write;
   -- for an entry: alter table public.catalog_entries disable trigger guard_entry_update;
   ```

3. Fix the row in the same session. The truncate and entry-delete triggers stay on, so you update a row and never delete and re-insert it.
4. Enable the trigger again in the same session:

   ```sql
   alter table public.schedule enable trigger guard_schedule_write;
   -- for an entry: alter table public.catalog_entries enable trigger guard_entry_update;
   ```

5. Check that every trigger is on. Every `tgenabled` must be `O`:

   ```sql
   select tgname, tgenabled from pg_trigger
   where tgrelid in ('public.schedule'::regclass, 'public.catalog_entries'::regclass)
     and not tgisinternal;
   ```
