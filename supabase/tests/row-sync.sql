-- Owner-run in the Supabase SQL editor after the row sync migration.
-- Raises on the first failed assertion; prints a notice on success.
-- It inserts one auth.users row (whose account row the seed trigger creates)
-- and deletes it at the end; the cascade must remove the rows of all four
-- tables. It also asserts that the players' role has no delete grant on the
-- four tables and does have select, insert, and update. The SQL editor runs as
-- a role that bypasses row-level security.

do $$
declare
	user_id uuid := gen_random_uuid();
begin
	insert into auth.users (id, raw_app_meta_data, raw_user_meta_data)
	values (user_id, '{"provider":"github"}', '{"user_name":"row-sync-test"}');

	insert into public.codex_entries (account_id, entry_id, state) values (user_id, 'http', 'correct');
	insert into public.blitz_bests (account_id, category, orientation, mode, score, time_to_score_ms)
		values (user_id, 'mixed', 'default', 'sprint', 3, 1234.5);
	insert into public.blitz_runs (account_id, ended_at, category, orientation, mode, ended, score, rounds)
		values (user_id, '2026-09-29T10:00:00.123Z', 'mixed', 'default', 'sprint', 'lives', 3, '[]');
	insert into public.dailies (account_id, category, day, status, guesses)
		values (user_id, 'mixed', '2026-09-29', 'playing', '[]');

	assert not has_table_privilege('authenticated', 'public.codex_entries', 'delete'), 'no delete on Codex entries';
	assert not has_table_privilege('authenticated', 'public.blitz_bests', 'delete'), 'no delete on Bests';
	assert not has_table_privilege('authenticated', 'public.blitz_runs', 'delete'), 'no delete on runs';
	assert not has_table_privilege('authenticated', 'public.dailies', 'delete'), 'no delete on Dailies';
	assert has_table_privilege('authenticated', 'public.codex_entries', 'select'), 'Codex select grant';
	assert has_table_privilege('authenticated', 'public.codex_entries', 'insert'), 'Codex insert grant';
	assert has_table_privilege('authenticated', 'public.codex_entries', 'update'), 'Codex update grant';
	assert has_table_privilege('authenticated', 'public.blitz_bests', 'select'), 'Bests select grant';
	assert has_table_privilege('authenticated', 'public.blitz_bests', 'insert'), 'Bests insert grant';
	assert has_table_privilege('authenticated', 'public.blitz_bests', 'update'), 'Bests update grant';
	assert has_table_privilege('authenticated', 'public.blitz_runs', 'select'), 'run select grant';
	assert has_table_privilege('authenticated', 'public.blitz_runs', 'insert'), 'run insert grant';
	assert has_table_privilege('authenticated', 'public.blitz_runs', 'update'), 'run update grant';
	assert has_table_privilege('authenticated', 'public.dailies', 'select'), 'Daily select grant';
	assert has_table_privilege('authenticated', 'public.dailies', 'insert'), 'Daily insert grant';
	assert has_table_privilege('authenticated', 'public.dailies', 'update'), 'Daily update grant';

	begin
		insert into public.codex_entries (account_id, entry_id, state) values (user_id, 'dns', 'wrong');
		raise exception 'an invalid Codex state was accepted';
	exception when check_violation then
		null;
	end;
	begin
		insert into public.blitz_runs (account_id, ended_at, category, orientation, mode, ended, score, rounds)
			values (user_id, now(), 'mixed', 'default', 'sprint', 'lives', 1, '{}');
		raise exception 'a non-array round log was accepted';
	exception when check_violation then
		null;
	end;
	begin
		insert into public.dailies (account_id, category, day, status, guesses)
			values (user_id, 'mixed', '2026-09-30', 'playing', '"x"');
		raise exception 'a non-array guess list was accepted';
	exception when check_violation then
		null;
	end;

	delete from auth.users where id = user_id;
	assert not exists (select 1 from public.codex_entries where account_id = user_id), 'cascade removes Codex entries';
	assert not exists (select 1 from public.blitz_bests where account_id = user_id), 'cascade removes Bests';
	assert not exists (select 1 from public.blitz_runs where account_id = user_id), 'cascade removes runs';
	assert not exists (select 1 from public.dailies where account_id = user_id), 'cascade removes Dailies';

	raise notice 'row-sync.sql: all assertions passed';
end
$$;
