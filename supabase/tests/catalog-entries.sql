-- Owner-run in the Supabase SQL editor after the catalog migrations, and run
-- in CI. Raises on the first failed assertion; prints a notice on success.
-- Entry protections: CHECKs, no delete or truncate, a permanent id, a frozen
-- name and port for an entry a past Daily used, editable other columns, and
-- grants. It inserts throwaway entries and Schedule rows and rolls back, so it
-- depends on no live data beyond the imported 2026-09-09 row.

-- Runs a statement as a role and asserts it fails with a message like the
-- pattern, so a trigger error is told apart from "permission denied".
create function pg_temp.expect_error(as_role text, statement text, pattern text)
returns void
language plpgsql
as $$
begin
	execute format('set local role %I', as_role);
	begin
		execute statement;
	exception when others then
		reset role;
		assert sqlerrm like pattern, format('%s: expected an error like %L, got %L', statement, pattern, sqlerrm);
		return;
	end;
	reset role;
	raise exception '%: expected an error like %', statement, pattern;
end
$$;

begin;

do $$
declare
	used_id text;
begin
	grant schedule_generator to postgres;

	insert into public.catalog_entries (id, kind, name, port, transport, description, answer_eligible)
	values ('t184-free', 'protocol', 'Free', 80, 'tcp', 'unused by any Daily', true),
		('t184-used', 'protocol', 'Used', 81, 'tcp', 'used by a past Daily', true);

	-- CHECK constraints.
	perform pg_temp.expect_error('postgres', $q$insert into public.catalog_entries (id, kind, name, port, transport, description, answer_eligible) values ('t184-a', 'protocol', 'A', 70000, 'tcp', 'd', true)$q$, '%check constraint%');
	perform pg_temp.expect_error('postgres', $q$insert into public.catalog_entries (id, kind, name, port, transport, description, answer_eligible) values ('t184-a', 'protocol', 'A', -1, 'tcp', 'd', true)$q$, '%check constraint%');
	perform pg_temp.expect_error('postgres', $q$insert into public.catalog_entries (id, kind, name, port, transport, description, answer_eligible) values ('t184-a', 'protocol', 'A', 80, 'sctp', 'd', true)$q$, '%check constraint%');
	perform pg_temp.expect_error('postgres', $q$insert into public.catalog_entries (id, kind, name, port, transport, description, answer_eligible) values ('t184-a', 'service', 'A', 80, 'tcp', 'd', true)$q$, '%check constraint%');
	perform pg_temp.expect_error('postgres', $q$insert into public.catalog_entries (id, kind, name, port, transport, description, answer_eligible) values ('t184-a', 'protocol', '  ', 80, 'tcp', 'd', true)$q$, '%check constraint%');

	-- An entry no Schedule row uses: every column stays editable.
	update public.catalog_entries set name = 'Free 2', port = 8080 where id = 't184-free';
	update public.catalog_entries
	set description = 'changed', blurb = 'blurb', aliases = array['x'], answer_eligible = false, retired = true, transport = 'udp', kind = 'application'
	where id = 't184-free';

	-- The id is permanent, for any entry.
	perform pg_temp.expect_error('postgres', $q$update public.catalog_entries set id = 't184-moved' where id = 't184-free'$q$, '%permanent%');

	-- No delete and no truncate, for any role.
	perform pg_temp.expect_error('postgres', $q$delete from public.catalog_entries where id = 't184-free'$q$, '%cannot be deleted%');
	perform pg_temp.expect_error('postgres', $q$truncate public.catalog_entries cascade$q$, '%truncate is not allowed on catalog_entries%');

	-- An entry a frozen Schedule row uses: name and port stay, the rest edits.
	select entry_id into used_id from public.schedule where category = 'mixed' and day = date '2026-09-09';
	perform pg_temp.expect_error('postgres', format('update public.catalog_entries set name = %L where id = %L', 'Renamed', used_id), '%used by a past Daily%');
	perform pg_temp.expect_error('postgres', format('update public.catalog_entries set port = 1 where id = %L', used_id), '%used by a past Daily%');
	update public.catalog_entries set description = 'edited', retired = false, answer_eligible = true where id = used_id;

	-- The same for a throwaway entry with its own frozen Schedule row (a missing
	-- past day, before the epoch, which the generator may insert).
	set local role schedule_generator;
	insert into public.schedule (category, day, entry_id, cycle_start) values ('mixed', date '2026-09-01', 't184-used', date '2026-09-01');
	reset role;
	perform pg_temp.expect_error('postgres', $q$update public.catalog_entries set name = 'Used 2' where id = 't184-used'$q$, '%used by a past Daily%');
	perform pg_temp.expect_error('postgres', $q$update public.catalog_entries set port = 82 where id = 't184-used'$q$, '%used by a past Daily%');
	update public.catalog_entries set description = 'still editable' where id = 't184-used';

	-- Grants: visitors and players read only; the generator reads only.
	assert has_table_privilege('anon', 'public.catalog_entries', 'select'), 'anon reads entries';
	assert has_table_privilege('authenticated', 'public.catalog_entries', 'select'), 'authenticated reads entries';
	assert has_table_privilege('schedule_generator', 'public.catalog_entries', 'select'), 'the generator reads entries';
	assert not has_table_privilege('anon', 'public.catalog_entries', 'insert, update, delete, truncate, references, trigger'), 'anon has no write grant on entries';
	assert not has_table_privilege('authenticated', 'public.catalog_entries', 'insert, update, delete, truncate, references, trigger'), 'authenticated has no write grant on entries';
	assert not has_table_privilege('schedule_generator', 'public.catalog_entries', 'insert, update, delete, truncate, references, trigger'), 'the generator has no write grant on entries';
	-- Every reader sees rows through the read policy (20261004000014).
	set local role anon;
	assert (select count(*) from public.catalog_entries) > 0, 'anon reads the catalog';
	reset role;
	set local role authenticated;
	assert (select count(*) from public.catalog_entries) > 0, 'authenticated reads the catalog';
	reset role;
	set local role schedule_generator;
	assert (select count(*) from public.catalog_entries) > 0, 'the generator reads the catalog';
	reset role;
	perform pg_temp.expect_error('anon', $q$update public.catalog_entries set name = 'x' where id = 't184-free'$q$, '%permission denied%');

	raise notice 'catalog-entries.sql: all assertions passed';
end
$$;

rollback;
