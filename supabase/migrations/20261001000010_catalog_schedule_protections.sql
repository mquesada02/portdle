-- Catalog and Schedule protections (Spec 5, ticket #184). Apply in the
-- Supabase SQL editor after 20261001000009, the generated import, so the
-- triggers need no exception for it.
--
-- Frozen through: the later of the server's UTC date and the switch-over day.
-- No Schedule row dated on or before it can change or go away. On the live
-- project it equals the server's UTC date, since the migrations are applied on
-- the switch-over day; on the local stack and in CI, before that day, the
-- imported rows lie in the future and stay safe.
--
-- To fix a real mistake in a past answer the owner disables a trigger on
-- purpose as the table owner (runbook: ticket #194). Every trigger function
-- is security invoker. The entries triggers run as the dashboard role
-- (postgres), which owns the functions; a service_role entry edit is not
-- supported.

create function public.schedule_frozen_through()
returns date
language sql
stable
set search_path = ''
as $$ select greatest(public.server_utc_date(), public.switch_over_day()) $$;

revoke all on function public.schedule_frozen_through() from public, anon, authenticated;
grant execute on function public.schedule_frozen_through() to schedule_generator;

-- Only the generator role writes Schedule rows, and no row on or before the
-- frozen-through day changes or goes away, whatever the role. An insert of a
-- day that has no row yet is allowed whatever its date: the primary key stops
-- a replacement, and no player can have played a day that had no row. An
-- update also cannot move a row into the frozen past.
create function public.guard_schedule_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	frozen date;
begin
	if current_user <> 'schedule_generator' then
		raise exception 'only the schedule generator role writes the Schedule';
	end if;
	if tg_op = 'INSERT' then
		return new;
	end if;
	frozen := public.schedule_frozen_through();
	if old.day <= frozen then
		raise exception 'a Schedule row on or before the frozen-through day cannot change';
	end if;
	if tg_op = 'UPDATE' then
		if new.day <= frozen then
			raise exception 'a Schedule row cannot move to or before the frozen-through day';
		end if;
		return new;
	end if;
	return old;
end
$$;

-- An entry id is permanent. The name and port of an entry that a frozen
-- Schedule row uses stay as they were, so old results and shares stay true.
-- Other columns stay editable.
create function public.guard_entry_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if new.id is distinct from old.id then
		raise exception 'an entry id is permanent';
	end if;
	if (new.name is distinct from old.name or new.port is distinct from old.port)
		and exists (
			select 1 from public.schedule
			where entry_id = old.id and day <= public.schedule_frozen_through()
		) then
		raise exception 'the name and port of an entry used by a past Daily cannot change';
	end if;
	return new;
end
$$;

create function public.reject_entry_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	raise exception 'an entry cannot be deleted; retire it instead';
end
$$;

-- Row triggers do not fire on truncate, so a statement trigger closes that
-- hole on both tables.
create function public.reject_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	raise exception 'truncate is not allowed on %', tg_table_name;
end
$$;

revoke all on function public.guard_schedule_write() from public, anon, authenticated;
revoke all on function public.guard_entry_update() from public, anon, authenticated;
revoke all on function public.reject_entry_delete() from public, anon, authenticated;
revoke all on function public.reject_truncate() from public, anon, authenticated;

create trigger guard_schedule_write
	before insert or update or delete on public.schedule
	for each row execute function public.guard_schedule_write();
create trigger reject_schedule_truncate
	before truncate on public.schedule
	for each statement execute function public.reject_truncate();

create trigger guard_entry_update
	before update on public.catalog_entries
	for each row execute function public.guard_entry_update();
create trigger reject_entry_delete
	before delete on public.catalog_entries
	for each row execute function public.reject_entry_delete();
create trigger reject_entry_truncate
	before truncate on public.catalog_entries
	for each statement execute function public.reject_truncate();
