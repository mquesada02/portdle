# Release checklist: Dailies from the backend (Spec 5)

The switch-over day is the release day: **2026-10-04 (UTC)**. Do the steps in order, on that day, never earlier. The import migration holds that day, so a different release day needs a new import first.

Repository secrets to set: `SCHEDULE_DATABASE_URL` and `SCHEDULE_SEED`. Repository variables that must already be set: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. This file holds no value of any of them. Commit none.

1. **Apply the migrations.** In the Supabase SQL editor, apply `20261001000008` through `20261001000013` in filename order. Migration `20261001000007` is already applied on the live project.
2. **Build the connection string.** Use the session pooler string (session mode, port 5432, user `schedule_generator.<project-ref>`) with the generator password that is already in your password manager. The owner set that password on 2026-10-02, so this checklist sets no new password.
3. **Set the repository secrets.** In GitHub, Settings, Secrets and variables, Actions: set `SCHEDULE_DATABASE_URL` to the string from step 2. Set `SCHEDULE_SEED` to a long random string. Keep a copy of the seed in your password manager.
4. **Tell the coordinator that steps 1 to 3 are done.** The coordinator squash-merges `spec5` into `master`. The merge deploys the site.
5. **Run the Schedule Action once by hand.** Follow job 2 in `docs/runbook.md`. The run fills the Schedule after the switch-over day with the secret seed.
6. **Check the result.** The run is green. In the Table Editor, table `schedule`, each category has rows through today + 7.
