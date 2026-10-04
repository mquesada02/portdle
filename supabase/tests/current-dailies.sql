-- Owner-run in the Supabase SQL editor after the catalog migrations, and run
-- in CI. Raises on the first failed assertion; prints a notice on success.
-- The current Dailies function: three rows in a fixed order, the server time
-- and UTC date, a null entry id for a category with no visible row, and the
-- execute rights. It pins the server's date by replacing server_utc_date()
-- inside a transaction that rolls back, so it depends on no live rows past the
-- import.

begin;

do $$
begin
	assert has_function_privilege('anon', 'public.current_dailies()', 'execute'), 'anon executes current_dailies';
	assert has_function_privilege('authenticated', 'public.current_dailies()', 'execute'), 'authenticated executes current_dailies';
	assert not has_function_privilege('public', 'public.current_dailies()', 'execute'), 'public does not execute current_dailies';
end
$$;

-- The switch-over day: every category has an imported row, so no entry id is null.
do $$
begin
	execute format(
		'create or replace function public.server_utc_date() returns date language sql stable set search_path = %L as %L',
		'', format('select date %L', public.switch_over_day())
	);
end
$$;

do $$
declare
	rec record;
	categories text[];
	ids text[];
	pinned date := public.switch_over_day();
begin
	set local role anon;
	select array_agg(category), array_agg(entry_id) into categories, ids from public.current_dailies();
	assert (select count(*) from public.current_dailies()) = 3, 'three rows';
	assert categories = array['mixed', 'protocols', 'applications'], 'fixed category order';
	assert array_position(ids, null) is null, 'no null entry id on an imported day';
	for rec in select * from public.current_dailies() loop
		assert rec.utc_date = pinned, 'the UTC date is the server date';
		assert rec.server_time is not null, 'the server time is set';
		assert rec.entry_id = (select entry_id from public.schedule where category = rec.category and day = rec.utc_date), 'the entry id is the Schedule row';
	end loop;
	reset role;
end
$$;

-- A date before the epoch: three rows, all null.
do $$
begin
	create or replace function public.server_utc_date()
	returns date
	language sql
	stable
	set search_path = ''
	as 'select date ''2026-08-01''';
end
$$;

do $$
begin
	set local role anon;
	assert (select count(*) from public.current_dailies()) = 3, 'three rows with no Schedule row';
	assert (select count(*) from public.current_dailies() where entry_id is null) = 3, 'all entry ids are null';
	assert (select min(utc_date) from public.current_dailies()) = date '2026-08-01', 'the UTC date is the server date';
	reset role;
	raise notice 'current-dailies.sql: all assertions passed';
end
$$;

rollback;
