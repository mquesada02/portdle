-- Owner-run in the Supabase SQL editor after the account deletion migration.
-- Raises on the first failed assertion; prints a notice on success.
-- It inserts two auth.users rows (user A and user B), each with a row in the
-- four private tables. It calls delete_account() as anon (refused), as
-- authenticated with no user (refused), and as authenticated with A's claims
-- (A and every row of A go, B stays). B is deleted at the end. The SQL editor
-- role bypasses row-level security, so the final reads run after reset role.

do $$
declare
	a_id uuid := gen_random_uuid();
	b_id uuid := gen_random_uuid();
	target uuid;
begin
	insert into auth.users (id, raw_app_meta_data, raw_user_meta_data) values
		(a_id, '{"provider":"github"}', '{"user_name":"delete-test-a"}'),
		(b_id, '{"provider":"github"}', '{"user_name":"delete-test-b"}');

	foreach target in array array[a_id, b_id] loop
		insert into public.codex_entries (account_id, entry_id, state) values (target, 'http', 'correct');
		insert into public.blitz_bests (account_id, category, orientation, mode, score, time_to_score_ms)
			values (target, 'mixed', 'default', 'sprint', 3, 1234.5);
		insert into public.blitz_runs (account_id, ended_at, category, orientation, mode, ended, score, rounds)
			values (target, '2026-09-29T10:00:00.123Z', 'mixed', 'default', 'sprint', 'lives', 3, '[]');
		insert into public.dailies (account_id, category, day, status, guesses)
			values (target, 'mixed', '2026-09-29', 'playing', '[]');
	end loop;

	assert not has_function_privilege('anon', 'public.delete_account()', 'execute'), 'anon cannot execute';
	assert has_function_privilege('authenticated', 'public.delete_account()', 'execute'), 'authenticated can execute';

	set local role anon;
	begin
		perform public.delete_account();
		raise exception 'anon deleted an account';
	exception when insufficient_privilege then
		null;
	end;
	reset role;

	perform set_config('request.jwt.claims', '', true);
	set local role authenticated;
	begin
		perform public.delete_account();
		raise exception 'a call with no signed-in user succeeded';
	exception when invalid_authorization_specification then
		null;
	end;
	reset role;

	perform set_config('request.jwt.claims', json_build_object('sub', a_id, 'role', 'authenticated')::text, true);
	set local role authenticated;
	perform public.delete_account();
	reset role;
	perform set_config('request.jwt.claims', '', true);

	assert not exists (select 1 from auth.users where id = a_id), 'A auth user is gone';
	assert not exists (select 1 from public.accounts where id = a_id), 'A account row is gone';
	assert not exists (select 1 from public.codex_entries where account_id = a_id), 'A Codex rows are gone';
	assert not exists (select 1 from public.blitz_bests where account_id = a_id), 'A Bests are gone';
	assert not exists (select 1 from public.blitz_runs where account_id = a_id), 'A runs are gone';
	assert not exists (select 1 from public.dailies where account_id = a_id), 'A Dailies are gone';

	assert exists (select 1 from auth.users where id = b_id), 'B auth user stays';
	assert exists (select 1 from public.accounts where id = b_id), 'B account row stays';
	assert exists (select 1 from public.codex_entries where account_id = b_id), 'B Codex rows stay';
	assert exists (select 1 from public.blitz_bests where account_id = b_id), 'B Bests stay';
	assert exists (select 1 from public.blitz_runs where account_id = b_id), 'B runs stay';
	assert exists (select 1 from public.dailies where account_id = b_id), 'B Dailies stay';

	delete from auth.users where id = b_id;
	assert not exists (select 1 from public.accounts where id = b_id), 'cascade removes B';

	raise notice 'account-deletion.sql: all assertions passed';
end
$$;
