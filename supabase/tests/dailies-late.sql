-- Run in CI with psql (scripts/run-sql-tests.sh runs from the repository
-- root, which the \i path below needs); not for the SQL editor. Raises on the
-- first failed assertion; prints a notice on success.
-- It drops the `late` column and its constraint inside a transaction, seeds
-- Dailies around the switch-over day, runs the real migration file, and
-- asserts the delete, the `late = false` update, the CHECK, the column shape,
-- and that `authenticated` can write a row (the CHECK needs execute on
-- switch_over_day). It rolls back, so it leaves nothing behind.

begin;

alter table public.dailies drop constraint if exists dailies_late_required;
alter table public.dailies drop column if exists late;

do $$
declare
	user_id uuid := '00000000-0000-0000-0000-000000000189';
	cutoff date := public.switch_over_day();
begin
	insert into auth.users (id, raw_app_meta_data, raw_user_meta_data)
	values (user_id, '{"provider":"github"}', '{"user_name":"dailies-late-test"}');
	insert into public.dailies (account_id, category, day, status, guesses) values
		(user_id, 'mixed', cutoff - 1, 'won', '[]'),
		(user_id, 'mixed', cutoff, 'playing', '[]'),
		(user_id, 'mixed', cutoff + 1, 'playing', '[]'),
		(user_id, 'protocols', cutoff + 5, 'won', '[]');
end
$$;

\i supabase/migrations/20261001000012_dailies_late.sql

do $$
declare
	user_id uuid := '00000000-0000-0000-0000-000000000189';
	cutoff date := public.switch_over_day();
begin
	assert not exists (select 1 from public.dailies where account_id = user_id and dailies.day > public.switch_over_day()), 'rows after the switch-over day are deleted';
	assert (select count(*) from public.dailies where account_id = user_id) = 2, 'rows on or before the day stay';
	assert not exists (select 1 from public.dailies where account_id = user_id and late is distinct from false), 'the rest are set to false';

	assert (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'dailies' and column_name = 'late') = 'boolean', 'late is boolean';
	assert (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'dailies' and column_name = 'late') = 'YES', 'late is nullable';
	assert (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'dailies' and column_name = 'late') is null, 'late has no default';

	begin
		insert into public.dailies (account_id, category, day, status, guesses)
			values (user_id, 'applications', cutoff + 1, 'playing', '[]');
		raise exception 'a null late after the switch-over day was accepted';
	exception when check_violation then
		null;
	end;
	insert into public.dailies (account_id, category, day, status, guesses, late) values
		(user_id, 'applications', cutoff + 1, 'playing', '[]', true),
		(user_id, 'applications', cutoff + 2, 'playing', '[]', false);
	insert into public.dailies (account_id, category, day, status, guesses)
		values (user_id, 'applications', cutoff - 1, 'playing', '[]');
	assert (select late from public.dailies where account_id = user_id and category = 'applications' and day = cutoff - 1) is null, 'a null late on or before the day is accepted';
	begin
		update public.dailies set late = null where account_id = user_id and category = 'applications' and day = cutoff + 1;
		raise exception 'an update to a null late after the switch-over day was accepted';
	exception when check_violation then
		null;
	end;

	assert has_function_privilege('authenticated', 'public.switch_over_day()', 'execute'), 'authenticated executes switch_over_day';
	assert not has_function_privilege('anon', 'public.switch_over_day()', 'execute'), 'anon does not execute switch_over_day';

	perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
	set local role authenticated;
	insert into public.dailies (account_id, category, day, status, guesses, late)
		values (user_id, 'protocols', cutoff + 3, 'playing', '[]', false);
	update public.dailies set late = true where account_id = user_id and category = 'protocols' and day = cutoff + 3;
	begin
		insert into public.dailies (account_id, category, day, status, guesses)
			values (user_id, 'protocols', cutoff + 4, 'playing', '[]');
		raise exception 'authenticated wrote a null late after the switch-over day';
	exception when check_violation then
		null;
	end;
	reset role;
	perform set_config('request.jwt.claims', '', true);
	assert (select late from public.dailies where account_id = user_id and category = 'protocols' and day = cutoff + 3) = true, 'authenticated updated late';

	raise notice 'dailies-late.sql: all assertions passed';
end
$$;

rollback;
