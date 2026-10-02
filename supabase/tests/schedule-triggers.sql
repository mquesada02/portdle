-- Owner-run in the Supabase SQL editor after the catalog migrations, and run
-- in CI. Raises on the first failed assertion; prints a notice on success.
-- Schedule triggers: only the generator role writes; no change to a row on or
-- before the frozen-through day; no move into the frozen past; a missing past
-- day may be inserted; no truncate. It inserts its own rows (a day before the
-- epoch, and days 30 or more after the last stored Schedule day) and rolls
-- back, so it depends on no live rows past the import. The second
-- transaction moves the switch-over day past the server's date.

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
	future_day date := greatest((select max(day) from public.schedule), public.server_utc_date()) + 30;
begin
	grant schedule_generator to postgres;
	insert into public.catalog_entries (id, kind, name, port, transport, description, answer_eligible)
	values ('t184-trg', 'protocol', 'Trg', 80, 'tcp', 'd', true);

	-- Only the generator role writes, whatever the day.
	perform pg_temp.expect_error('postgres', format('insert into public.schedule values (%L, %L, %L, %L)', 'mixed', future_day, 't184-trg', future_day), '%only the schedule generator%');
	perform pg_temp.expect_error('postgres', $q$update public.schedule set cycle_start = cycle_start where category = 'mixed' and day = date '2026-09-09'$q$, '%only the schedule generator%');
	perform pg_temp.expect_error('postgres', $q$delete from public.schedule where category = 'mixed' and day = date '2026-09-09'$q$, '%only the schedule generator%');

	-- The generator inserts a missing past day (before the epoch) and a future day.
	set local role schedule_generator;
	insert into public.schedule (category, day, entry_id, cycle_start) values ('mixed', date '2026-09-01', 't184-trg', date '2026-09-01');
	insert into public.schedule (category, day, entry_id, cycle_start) values ('mixed', future_day, 't184-trg', future_day);
	-- A future row updates and deletes (this runs both helper functions).
	update public.schedule set cycle_start = future_day - 1 where category = 'mixed' and day = future_day;
	update public.schedule set day = future_day + 1 where category = 'mixed' and day = future_day;
	delete from public.schedule where category = 'mixed' and day = future_day + 1;
	insert into public.schedule (category, day, entry_id, cycle_start) values ('mixed', future_day, 't184-trg', future_day);
	reset role;

	-- A past day that has a row cannot be replaced: the primary key stops it.
	perform pg_temp.expect_error('schedule_generator', $q$insert into public.schedule values ('mixed', date '2026-09-09', 't184-trg', date '2026-09-09')$q$, '%duplicate key%');

	-- No update or delete on or before the frozen-through day, even by the generator.
	perform pg_temp.expect_error('schedule_generator', $q$update public.schedule set cycle_start = date '2026-09-10' where category = 'mixed' and day = date '2026-09-09'$q$, '%cannot change%');
	perform pg_temp.expect_error('schedule_generator', $q$delete from public.schedule where category = 'mixed' and day = date '2026-09-09'$q$, '%cannot change%');
	perform pg_temp.expect_error('schedule_generator', $q$delete from public.schedule where category = 'mixed' and day = date '2026-09-01'$q$, '%cannot change%');

	-- No move into the frozen past.
	perform pg_temp.expect_error('schedule_generator', format('update public.schedule set day = date %L where category = %L and day = %L', '2026-09-02', 'mixed', future_day), '%cannot move%');

	-- No truncate.
	perform pg_temp.expect_error('postgres', 'truncate public.schedule', '%truncate is not allowed on schedule%');

	raise notice 'schedule-triggers.sql (server date): all assertions passed';
end
$$;

rollback;

-- The switch-over day after the server's date: it must come first in the
-- transaction, before anything uses the function. A row between the two dates
-- is then frozen, although it is in the server's future. The days are beyond
-- the last stored Schedule day (the generator fills whole cycles past
-- the server's date), so no stored row collides.
begin;

do $$
begin
	execute format(
		'create or replace function public.switch_over_day() returns date language sql immutable set search_path = %L as %L',
		'', format('select date %L', greatest((select max(day) from public.schedule), public.server_utc_date()) + 30)
	);
end
$$;

do $$
declare
	last_day date := greatest((select max(day) from public.schedule), public.server_utc_date());
	frozen_future date := last_day + 20;
	open_future date := last_day + 40;
begin
	assert public.schedule_frozen_through() = last_day + 30, 'frozen through is the later date';
	grant schedule_generator to postgres;
	insert into public.catalog_entries (id, kind, name, port, transport, description, answer_eligible)
	values ('t184-trg2', 'protocol', 'Trg2', 80, 'tcp', 'd', true);

	set local role schedule_generator;
	insert into public.schedule (category, day, entry_id, cycle_start) values ('mixed', frozen_future, 't184-trg2', frozen_future);
	insert into public.schedule (category, day, entry_id, cycle_start) values ('mixed', open_future, 't184-trg2', open_future);
	update public.schedule set cycle_start = open_future - 1 where category = 'mixed' and day = open_future;
	reset role;
	perform pg_temp.expect_error('schedule_generator', format('update public.schedule set cycle_start = %L where category = %L and day = %L', frozen_future - 1, 'mixed', frozen_future), '%cannot change%');
	perform pg_temp.expect_error('schedule_generator', format('delete from public.schedule where category = %L and day = %L', 'mixed', frozen_future), '%cannot change%');
	-- The entry the frozen row uses keeps its name and port.
	perform pg_temp.expect_error('postgres', $q$update public.catalog_entries set name = 'Trg3' where id = 't184-trg2'$q$, '%used by a past Daily%');

	raise notice 'schedule-triggers.sql (switch-over after server date): all assertions passed';
end
$$;

rollback;
