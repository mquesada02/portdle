-- Preferences sync (Spec 4, ticket #137): one row per account with a value and
-- a server-set timestamp per preference. Apply in the Supabase SQL editor
-- after 20260929000003. "Automatically expose new tables" is off in this
-- project, so every grant below is explicit. Only the owning account reads or
-- writes its row. A null value means the preference was never set.
-- Players get select, insert, and update, with no right on the timestamp
-- columns and no delete (the row goes with the account by the cascade).

create table public.preferences (
	account_id uuid primary key references public.accounts (id) on delete cascade,
	theme text check (theme in ('system', 'light', 'dark')),
	theme_updated_at timestamptz,
	-- Only ever true: the flag has no way back.
	how_to_seen boolean check (how_to_seen),
	how_to_seen_updated_at timestamptz,
	codex_sort text check (codex_sort in ('name', 'port')),
	codex_sort_updated_at timestamptz
);

-- Stamps a preference when its value changes, so recency is push time. A
-- timestamp the statement supplies is always overwritten. `is distinct from`
-- is null-safe: null to a value stamps, a value to null clears the stamp. The
-- stamp is the time of the write itself (clock_timestamp), not of the
-- transaction.
create function public.stamp_preferences()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		new.theme_updated_at := case when new.theme is null then null else clock_timestamp() end;
		new.how_to_seen_updated_at := case when new.how_to_seen is null then null else clock_timestamp() end;
		new.codex_sort_updated_at := case when new.codex_sort is null then null else clock_timestamp() end;
	else
		new.theme_updated_at := case
			when new.theme is not distinct from old.theme then old.theme_updated_at
			when new.theme is null then null
			else clock_timestamp() end;
		new.how_to_seen_updated_at := case
			when new.how_to_seen is not distinct from old.how_to_seen then old.how_to_seen_updated_at
			when new.how_to_seen is null then null
			else clock_timestamp() end;
		new.codex_sort_updated_at := case
			when new.codex_sort is not distinct from old.codex_sort then old.codex_sort_updated_at
			when new.codex_sort is null then null
			else clock_timestamp() end;
	end if;
	return new;
end
$$;

revoke all on function public.stamp_preferences() from public, anon, authenticated;

create trigger stamp_preferences
	before insert or update on public.preferences
	for each row execute function public.stamp_preferences();

alter table public.preferences enable row level security;

create policy preferences_own on public.preferences
	for all to authenticated
	using (account_id = (select auth.uid()))
	with check (account_id = (select auth.uid()));

-- An upsert sets every column it carries, `account_id` included, so update
-- covers it; the policy's check keeps it the caller's own id.
grant select on public.preferences to authenticated;
grant insert (account_id, theme, how_to_seen, codex_sort) on public.preferences to authenticated;
grant update (account_id, theme, how_to_seen, codex_sort) on public.preferences to authenticated;
