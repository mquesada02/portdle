-- Owner-run in the Supabase SQL editor after the catalog migrations, and run
-- in CI. Raises on the first failed assertion; prints a notice on success.
-- Schedule row-level security: visitors and players read only rows up to the
-- server's UTC date; the generator reads every row. It inserts its own future
-- rows (server date plus 30 days) and rolls back, so it depends on no live
-- rows past the import.

begin;

do $$
declare
	future_day date := public.server_utc_date() + 30;
begin
	grant schedule_generator to postgres;
	insert into public.catalog_entries (id, kind, name, port, transport, description, answer_eligible)
	values ('t184-rls', 'protocol', 'Rls', 80, 'tcp', 'd', true);

	set local role schedule_generator;
	insert into public.schedule (category, day, entry_id, cycle_start)
	select category, future_day, 't184-rls', future_day
	from unnest(array['mixed', 'protocols', 'applications']) as category;
	assert (select count(*) from public.schedule where day = future_day) = 3, 'the generator sees future rows';
	assert (select count(*) from public.schedule where day = date '2026-09-09') = 3, 'the generator sees imported rows';
	reset role;

	set local role anon;
	assert (select count(*) from public.schedule where day > public.server_utc_date()) = 0, 'anon sees no future row';
	assert (select count(*) from public.schedule where day = date '2026-09-09') = 3, 'anon sees past rows';
	reset role;

	set local role authenticated;
	assert (select count(*) from public.schedule where day > public.server_utc_date()) = 0, 'authenticated sees no future row';
	assert (select count(*) from public.schedule where day = date '2026-09-09') = 3, 'authenticated sees past rows';
	reset role;

	assert not has_table_privilege('anon', 'public.schedule', 'insert, update, delete, truncate, references, trigger'), 'anon has no write grant on the Schedule';
	assert not has_table_privilege('authenticated', 'public.schedule', 'insert, update, delete, truncate, references, trigger'), 'authenticated has no write grant on the Schedule';

	raise notice 'schedule-rls.sql: all assertions passed';
end
$$;

rollback;
