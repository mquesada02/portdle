-- Catalog and Schedule tables (Spec 5, ticket #184). Apply in the Supabase SQL
-- editor after 20261001000007 (the owner applies migrations in filename
-- order). "Automatically expose new tables" is off in this project, so every
-- grant below is explicit.
--
-- catalog_entries: one row per catalog entry; the id is permanent. Anyone
-- reads; nobody writes except the owner's dashboard role (service_role keeps
-- Supabase's default grants, as in Spec 4; the triggers stop its writes). Its
-- row-level security and read policy are in 20261004000014 (the original "no
-- row-level security" owner call was reversed on 2026-10-04); the write
-- protections are in 20261001000010.
-- schedule: one row per Daily category and UTC day. Visitors and players read
-- only rows up to the server's UTC date, so no future answer is readable. Only
-- the generator role writes (checked by the triggers in 20261001000010).

-- The server's UTC date, never the session time zone. Policies and the
-- current Dailies function call it.
create function public.server_utc_date()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'utc')::date $$;

revoke all on function public.server_utc_date() from public, anon, authenticated;
grant execute on function public.server_utc_date() to anon, authenticated, schedule_generator;

create table public.catalog_entries (
	id text primary key,
	kind text not null check (kind in ('protocol', 'application')),
	name text not null check (btrim(name) <> ''),
	aliases text[] not null default '{}',
	port integer not null check (port between 0 and 65535),
	transport text not null check (transport in ('tcp', 'udp', 'both')),
	description text not null,
	blurb text,
	answer_eligible boolean not null,
	retired boolean not null default false,
	sources jsonb not null default '[]'
);

revoke all on public.catalog_entries from public, anon, authenticated;
grant select on public.catalog_entries to anon, authenticated, schedule_generator;

create table public.schedule (
	category text not null check (category in ('mixed', 'protocols', 'applications')),
	day date not null,
	entry_id text not null references public.catalog_entries (id),
	-- The start day of the cycle the row belongs to, so the generator can
	-- rebuild cycles exactly.
	cycle_start date not null,
	primary key (category, day)
);

alter table public.schedule enable row level security;

revoke all on public.schedule from public, anon, authenticated;
grant select on public.schedule to anon, authenticated;
grant select, insert, update, delete on public.schedule to schedule_generator;
grant usage on schema public to schedule_generator;

create policy schedule_read_to_server_date on public.schedule
	for select to anon, authenticated
	using (day <= (select public.server_utc_date()));

create policy schedule_generator_select on public.schedule
	for select to schedule_generator using (true);
create policy schedule_generator_insert on public.schedule
	for insert to schedule_generator with check (true);
create policy schedule_generator_update on public.schedule
	for update to schedule_generator using (true) with check (true);
create policy schedule_generator_delete on public.schedule
	for delete to schedule_generator using (true);
