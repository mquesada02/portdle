-- Owner-run in the Supabase SQL editor after the preferences migration.
-- Raises on the first failed assertion; prints a notice on success.
-- It inserts one auth.users row (whose account row the seed trigger creates)
-- and deletes it at the end. The SQL editor runs as a role that bypasses
-- row-level security and grants, so the grants are asserted with
-- has_column_privilege and the trigger is tested here.

do $$
declare
	user_id uuid := gen_random_uuid();
	stamped timestamptz;
	kept timestamptz;
begin
	insert into auth.users (id, raw_app_meta_data, raw_user_meta_data)
	values (user_id, '{"provider":"github"}', '{"user_name":"preferences-test"}');

	-- Insert: a set value is stamped, an unset one is not, and a supplied
	-- timestamp is overwritten.
	insert into public.preferences (account_id, theme, how_to_seen, codex_sort_updated_at)
	values (user_id, 'dark', true, '2000-01-01');
	select theme_updated_at into stamped from public.preferences where account_id = user_id;
	assert stamped is not null and stamped > '2020-01-01', 'insert stamps a set theme';
	assert (select how_to_seen_updated_at from public.preferences where account_id = user_id) is not null, 'insert stamps a set flag';
	assert (select codex_sort_updated_at from public.preferences where account_id = user_id) is null, 'insert overwrites a supplied timestamp';

	-- Stamps are the time of the write, so a sleep tells a kept stamp from a
	-- new one. Update of another column keeps the theme's timestamp; the same
	-- value keeps it too; a change re-stamps; a supplied timestamp is overwritten.
	perform pg_sleep(0.02);
	update public.preferences set codex_sort = 'port' where account_id = user_id;
	assert (select theme_updated_at from public.preferences where account_id = user_id) = stamped, 'update of another column keeps the theme stamp';
	assert (select codex_sort_updated_at from public.preferences where account_id = user_id) is not null, 'null to a value stamps';
	perform pg_sleep(0.02);
	update public.preferences set theme = 'dark' where account_id = user_id;
	assert (select theme_updated_at from public.preferences where account_id = user_id) = stamped, 'the same value keeps its stamp';
	perform pg_sleep(0.02);
	update public.preferences set theme = 'light', how_to_seen_updated_at = '2000-01-01' where account_id = user_id;
	select theme_updated_at into kept from public.preferences where account_id = user_id;
	assert kept > stamped, 'a change stamps';
	assert (select how_to_seen_updated_at from public.preferences where account_id = user_id) > '2020-01-01', 'update overwrites a supplied timestamp';
	update public.preferences set codex_sort = null where account_id = user_id;
	assert (select codex_sort_updated_at from public.preferences where account_id = user_id) is null, 'a value to null clears the stamp';

	assert has_table_privilege('authenticated', 'public.preferences', 'select'), 'select grant';
	assert not has_table_privilege('authenticated', 'public.preferences', 'delete'), 'no delete grant';
	assert has_column_privilege('authenticated', 'public.preferences', 'theme', 'insert'), 'theme insert grant';
	assert has_column_privilege('authenticated', 'public.preferences', 'theme', 'update'), 'theme update grant';
	assert has_column_privilege('authenticated', 'public.preferences', 'account_id', 'update'), 'account id update grant (upsert)';
	assert not has_column_privilege('authenticated', 'public.preferences', 'theme_updated_at', 'insert'), 'no timestamp insert grant';
	assert not has_column_privilege('authenticated', 'public.preferences', 'theme_updated_at', 'update'), 'no timestamp update grant';
	assert not has_column_privilege('anon', 'public.preferences', 'theme', 'select'), 'no anonymous read';

	begin
		update public.preferences set theme = 'purple' where account_id = user_id;
		raise exception 'an invalid theme was accepted';
	exception when check_violation then
		null;
	end;
	begin
		update public.preferences set codex_sort = 'size' where account_id = user_id;
		raise exception 'an invalid Codex sort was accepted';
	exception when check_violation then
		null;
	end;
	begin
		update public.preferences set how_to_seen = false where account_id = user_id;
		raise exception 'a false How-to seen flag was accepted';
	exception when check_violation then
		null;
	end;

	delete from auth.users where id = user_id;
	assert not exists (select 1 from public.preferences where account_id = user_id), 'cascade removes the row';

	raise notice 'preferences.sql: all assertions passed';
end
$$;
