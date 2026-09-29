-- Accounts tracer (Spec 4, ticket #134): the account row, its row-level
-- security, its Display name rule, and the seed trigger.
-- Apply in the Supabase SQL editor. "Automatically expose new tables" is off
-- in this project, so every grant below is explicit.

create table public.accounts (
	id uuid primary key references auth.users (id) on delete cascade,
	display_name text not null,
	name_confirmed boolean not null default false,
	created_at timestamptz not null default now(),
	constraint accounts_display_name_valid check (
		char_length(display_name) between 1 and 30
		and display_name ~ '[^ ]'
		and display_name ~ '^[[:alnum:] ''.-]+$'
	)
);

alter table public.accounts enable row level security;

create policy accounts_select_own on public.accounts
	for select to authenticated
	using (id = (select auth.uid()));

create policy accounts_update_own on public.accounts
	for update to authenticated
	using (id = (select auth.uid()))
	with check (id = (select auth.uid()));

grant select on public.accounts to authenticated;
grant update (display_name, name_confirmed) on public.accounts to authenticated;

-- Strips characters outside the allowed set, cuts to 30 characters, and falls
-- back to 'Player'. Immutable for trigger use only: [[:alnum:]] depends on the
-- database locale, so do not use it in an index.
create function public.normalize_display_name(raw text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
	select case when btrim(s) = '' then 'Player' else s end
	from (
		select left(regexp_replace(coalesce(raw, ''), '[^[:alnum:] ''.-]', '', 'g'), 30) as s
	) stripped
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	raw_name text;
begin
	if new.raw_app_meta_data ->> 'provider' = 'github' then
		raw_name := coalesce(
			nullif(btrim(new.raw_user_meta_data ->> 'user_name'), ''),
			nullif(btrim(new.raw_user_meta_data ->> 'preferred_username'), '')
		);
	else
		raw_name := coalesce(
			nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
			nullif(btrim(new.raw_user_meta_data ->> 'name'), '')
		);
	end if;
	insert into public.accounts (id, display_name)
	values (new.id, public.normalize_display_name(raw_name));
	return new;
end
$$;

revoke all on function public.normalize_display_name(text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();
