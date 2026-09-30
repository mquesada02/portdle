-- Row sync (Spec 4, ticket #136): the private tables for the Codex, the Bests,
-- the Blitz runs, and the Dailies. Apply in the Supabase SQL editor after
-- 20260929000002. "Automatically expose new tables" is off in this project, so
-- every grant below is explicit. Only the owning account reads or writes its
-- rows; the backend never checks whether a score is plausible.
-- Delete is granted so the smoke script can clean up its rows (and a player can
-- delete their own rows through the API); the app never sends a delete.

create table public.codex_entries (
	account_id uuid not null references public.accounts (id) on delete cascade,
	entry_id text not null check (entry_id <> ''),
	state text not null check (state in ('identified', 'missed', 'correct')),
	primary key (account_id, entry_id)
);

create table public.blitz_bests (
	account_id uuid not null references public.accounts (id) on delete cascade,
	category text not null check (category in ('mixed', 'protocols', 'applications')),
	orientation text not null check (orientation in ('default', 'inverted')),
	mode text not null check (mode in ('sprint', 'marathon', 'survival')),
	score integer not null check (score >= 0),
	-- The Blitz clock is fractional, so this is not an integer.
	time_to_score_ms double precision check (time_to_score_ms >= 0),
	primary key (account_id, category, orientation, mode)
);

create table public.blitz_runs (
	account_id uuid not null references public.accounts (id) on delete cascade,
	ended_at timestamptz not null,
	category text not null check (category in ('mixed', 'protocols', 'applications')),
	orientation text not null check (orientation in ('default', 'inverted')),
	mode text not null check (mode in ('sprint', 'marathon', 'survival')),
	ended text not null check (ended in ('lives', 'timeout')),
	score integer not null check (score >= 0),
	time_to_score_ms double precision check (time_to_score_ms >= 0),
	rounds jsonb not null check (jsonb_typeof(rounds) = 'array'),
	primary key (account_id, ended_at)
);

create table public.dailies (
	account_id uuid not null references public.accounts (id) on delete cascade,
	category text not null check (category in ('mixed', 'protocols', 'applications')),
	day date not null,
	status text not null check (status in ('playing', 'won', 'lost')),
	guesses jsonb not null check (jsonb_typeof(guesses) = 'array'),
	primary key (account_id, category, day)
);

alter table public.codex_entries enable row level security;
alter table public.blitz_bests enable row level security;
alter table public.blitz_runs enable row level security;
alter table public.dailies enable row level security;

-- One policy per table: the four tables share one rule.
create policy codex_entries_own on public.codex_entries
	for all to authenticated
	using (account_id = (select auth.uid()))
	with check (account_id = (select auth.uid()));

create policy blitz_bests_own on public.blitz_bests
	for all to authenticated
	using (account_id = (select auth.uid()))
	with check (account_id = (select auth.uid()));

create policy blitz_runs_own on public.blitz_runs
	for all to authenticated
	using (account_id = (select auth.uid()))
	with check (account_id = (select auth.uid()));

create policy dailies_own on public.dailies
	for all to authenticated
	using (account_id = (select auth.uid()))
	with check (account_id = (select auth.uid()));

grant select, insert, update, delete on public.codex_entries to authenticated;
grant select, insert, update, delete on public.blitz_bests to authenticated;
grant select, insert, update, delete on public.blitz_runs to authenticated;
grant select, insert, update, delete on public.dailies to authenticated;
