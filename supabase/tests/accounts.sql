-- Owner-run in the Supabase SQL editor after the accounts migration.
-- Raises on the first failed assertion; prints a notice on success.
-- The three auth.users rows it inserts are deleted at the end (the cascade
-- removes their account rows).

do $$
declare
	github_id uuid := gen_random_uuid();
	google_id uuid := gen_random_uuid();
	nameless_id uuid := gen_random_uuid();
begin
	assert public.normalize_display_name(null) = 'Player', 'null gives Player';
	assert public.normalize_display_name(repeat('a', 40)) = repeat('a', 30), '40 characters are cut to 30';
	assert public.normalize_display_name('😀😀') = 'Player', 'emoji only gives Player';
	assert public.normalize_display_name('   ') = 'Player', 'spaces only gives Player';
	assert public.normalize_display_name(E'\u0301\u0302') = 'Player', 'marks only gives Player';
	assert public.normalize_display_name('a😀b<c>d') = 'abcd', 'disallowed characters are stripped';
	assert public.normalize_display_name('Zoë-李 O''Neil.') = 'Zoë-李 O''Neil.', 'allowed characters stay';

	insert into auth.users (id, raw_app_meta_data, raw_user_meta_data) values
		(github_id, '{"provider":"github"}', '{"user_name":"octo-cat","full_name":"Ignored Name"}'),
		(google_id, '{"provider":"google"}', '{"full_name":"Ada Lovelace"}'),
		(nameless_id, '{"provider":"github"}', '{"user_name":""}');

	assert (select display_name from public.accounts where id = github_id) = 'octo-cat', 'GitHub uses user_name';
	assert (select display_name from public.accounts where id = google_id) = 'Ada Lovelace', 'Google uses full_name';
	assert (select display_name from public.accounts where id = nameless_id) = 'Player', 'no name gives Player';
	assert not (select bool_or(name_confirmed) from public.accounts where id in (github_id, google_id, nameless_id)), 'confirmed starts off';

	delete from auth.users where id in (github_id, google_id, nameless_id);
	assert not exists (select 1 from public.accounts where id in (github_id, google_id, nameless_id)), 'cascade removes account rows';

	raise notice 'accounts.sql: all assertions passed';
end
$$;
