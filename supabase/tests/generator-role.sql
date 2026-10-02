-- Owner-run in the Supabase SQL editor after the catalog migrations, and run
-- in CI. Raises on the first failed assertion; prints a notice on success.
-- The generator role: login, no superuser or other power, the grants the
-- Schedule Action needs and no more, and a role migration that is safe to run
-- twice. It cannot assert "no password": postgres cannot read pg_authid on
-- Supabase, and the local stack sets a password. That is checked by reading
-- the migration. The \i path is relative to the repository root, where
-- scripts/run-sql-tests.sh runs psql.

begin;

do $$
declare
	other_table text;
begin
	assert (select rolcanlogin from pg_roles where rolname = 'schedule_generator'), 'the role can log in';
	assert not (select rolsuper or rolcreatedb or rolcreaterole or rolbypassrls or rolinherit from pg_roles where rolname = 'schedule_generator'), 'the role has no other power';
	assert not has_schema_privilege('schedule_generator', 'public', 'create'), 'the role cannot create objects';
	assert has_schema_privilege('schedule_generator', 'public', 'usage'), 'the role uses the public schema';

	assert has_table_privilege('schedule_generator', 'public.catalog_entries', 'select'), 'reads entries';
	assert not has_table_privilege('schedule_generator', 'public.catalog_entries', 'insert, update, delete, truncate, references, trigger'), 'does not write entries';
	assert has_table_privilege('schedule_generator', 'public.schedule', 'select'), 'reads the Schedule';
	assert has_table_privilege('schedule_generator', 'public.schedule', 'insert'), 'inserts Schedule rows';
	assert has_table_privilege('schedule_generator', 'public.schedule', 'update'), 'updates Schedule rows';
	assert has_table_privilege('schedule_generator', 'public.schedule', 'delete'), 'deletes Schedule rows';
	assert not has_table_privilege('schedule_generator', 'public.schedule', 'truncate, references, trigger'), 'no truncate, references, or trigger on the Schedule';

	-- No right on any other table or view (the Spec 4 player tables).
	select string_agg(c.relname, ', ') into other_table
	from pg_class c
	join pg_namespace n on n.oid = c.relnamespace
	where n.nspname = 'public'
		and c.relkind in ('r', 'v', 'm', 'p')
		and c.relname not in ('catalog_entries', 'schedule')
		and has_table_privilege('schedule_generator', c.oid, 'select, insert, update, delete, truncate, references, trigger');
	assert other_table is null, 'no right on other tables: ' || coalesce(other_table, '');

	-- Function rights.
	assert has_function_privilege('schedule_generator', 'public.server_utc_date()', 'execute'), 'executes server_utc_date';
	assert has_function_privilege('schedule_generator', 'public.switch_over_day()', 'execute'), 'executes switch_over_day';
	assert has_function_privilege('schedule_generator', 'public.schedule_frozen_through()', 'execute'), 'executes schedule_frozen_through';
	assert has_function_privilege('anon', 'public.server_utc_date()', 'execute'), 'anon executes server_utc_date';
	assert has_function_privilege('authenticated', 'public.server_utc_date()', 'execute'), 'authenticated executes server_utc_date';
	assert not has_function_privilege('anon', 'public.switch_over_day()', 'execute'), 'anon does not execute switch_over_day';
	assert not has_function_privilege('anon', 'public.schedule_frozen_through()', 'execute'), 'anon does not execute schedule_frozen_through';
	assert not has_function_privilege('authenticated', 'public.guard_schedule_write()', 'execute'), 'authenticated does not execute a trigger function';

	raise notice 'generator-role.sql (role): all assertions passed';
end
$$;

rollback;

-- Running the role migration again changes nothing: the same pg_roles row.
begin;

create temp table role_before as select * from pg_roles where rolname = 'schedule_generator';

\i supabase/migrations/20261001000007_schedule_generator_role.sql
\i supabase/migrations/20261001000007_schedule_generator_role.sql

do $$
begin
	assert (select count(*) from pg_roles where rolname = 'schedule_generator') = 1, 'one role';
	assert not exists (
		(select * from role_before except select * from pg_roles where rolname = 'schedule_generator')
		union all
		(select * from pg_roles where rolname = 'schedule_generator' except select * from role_before)
	), 'the role row is unchanged';
	raise notice 'generator-role.sql (idempotent migration): all assertions passed';
end
$$;

rollback;
