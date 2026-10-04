-- Owner-run in the Supabase SQL editor after the catalog migrations, and run
-- in CI. Raises on the first failed assertion; prints a notice on success.
-- Structural check of the generated import (a SQL test cannot read the JSON
-- files; the rows equalled the files when the import was generated).
-- Read-only. Rows after the switch-over day (added by the Schedule
-- generator) are not asserted.

do $$
declare
	category_name text;
	first_day date;
	last_day date;
	day_count bigint;
begin
	assert (select count(*) from public.catalog_entries) > 0, 'the catalog is imported';
	assert not exists (
		select 1 from public.catalog_entries where kind not in ('protocol', 'application')
	), 'every entry has a valid kind';

	foreach category_name in array array['mixed', 'protocols', 'applications'] loop
		select min(day), max(day), count(*) into first_day, last_day, day_count
		from public.schedule
		where category = category_name and day <= public.switch_over_day();
		assert first_day = date '2026-09-09', category_name || ' starts at the epoch';
		assert last_day = public.switch_over_day(), category_name || ' reaches the switch-over day';
		assert day_count = last_day - first_day + 1, category_name || ' has no gap';
	end loop;

	assert not exists (
		select 1 from public.schedule s
		left join public.catalog_entries e on e.id = s.entry_id
		where e.id is null or s.cycle_start is null
	), 'every Schedule row has an entry and a cycle start';

	raise notice 'catalog-import.sql: all assertions passed';
end
$$;
