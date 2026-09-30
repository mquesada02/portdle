-- Leaderboards (Spec 4, ticket #139): three read-only views, one per
-- Leaderboard window, ranking each player's best score per Daily category,
-- Orientation, and Blitz mode. Apply in the Supabase SQL editor after
-- 20260929000003 (the owner applies migrations in filename order).
-- "Automatically expose new tables" is off in this project, so every grant
-- below is explicit: select on the views for visitors and signed-in players,
-- and nothing on the base tables.
--
-- The views keep the default owner rights (security_invoker off) on purpose:
-- a visitor cannot read the private runs, Bests, and accounts tables, and the
-- views are the only public path to a confirmed player's display name.
-- Supabase's linter flags such views; this one is intended. account_id is
-- exposed only because Spec 4 decides the viewer's own row is found by it.
--
-- Rules shared by all three views:
-- - Only accounts with a confirmed display name, and only scores above zero.
-- - Per player and key, one row: the highest score, then the lowest time to
--   score (a row without a time loses an equal-score tie to one with a time).
-- - rank is a unique row number per key: score descending, time to score
--   ascending with nulls last, then account id (a stable order).
-- - A run with a future ended_at (a wrong device clock; the backend never
--   checks plausibility) does not count.
-- - Window starts are computed from the current UTC time, so they do not
--   depend on the session time zone.

create view public.leaderboard_all_time
with (security_invoker = false) as
select
	account_id,
	display_name,
	category,
	orientation,
	mode,
	score,
	time_to_score_ms,
	row_number() over (
		partition by category, orientation, mode
		order by score desc, time_to_score_ms asc nulls last, account_id
	) as rank
from (
	select distinct on (entries.account_id, entries.category, entries.orientation, entries.mode)
		entries.account_id,
		accounts.display_name,
		entries.category,
		entries.orientation,
		entries.mode,
		entries.score,
		entries.time_to_score_ms
	from (
		select account_id, category, orientation, mode, score, time_to_score_ms
		from public.blitz_runs
		where ended_at <= now()
		union all
		select account_id, category, orientation, mode, score, time_to_score_ms
		from public.blitz_bests
	) as entries
	join public.accounts on accounts.id = entries.account_id
	where accounts.name_confirmed and entries.score > 0
	order by
		entries.account_id, entries.category, entries.orientation, entries.mode,
		entries.score desc, entries.time_to_score_ms asc nulls last
) as best;

create view public.leaderboard_weekly
with (security_invoker = false) as
select
	account_id,
	display_name,
	category,
	orientation,
	mode,
	score,
	time_to_score_ms,
	row_number() over (
		partition by category, orientation, mode
		order by score desc, time_to_score_ms asc nulls last, account_id
	) as rank
from (
	select distinct on (runs.account_id, runs.category, runs.orientation, runs.mode)
		runs.account_id,
		accounts.display_name,
		runs.category,
		runs.orientation,
		runs.mode,
		runs.score,
		runs.time_to_score_ms
	from public.blitz_runs as runs
	join public.accounts on accounts.id = runs.account_id
	where accounts.name_confirmed
		and runs.score > 0
		and runs.ended_at <= now()
		and runs.ended_at >= (date_trunc('week', now() at time zone 'utc') at time zone 'utc')
	order by
		runs.account_id, runs.category, runs.orientation, runs.mode,
		runs.score desc, runs.time_to_score_ms asc nulls last
) as best;

create view public.leaderboard_today
with (security_invoker = false) as
select
	account_id,
	display_name,
	category,
	orientation,
	mode,
	score,
	time_to_score_ms,
	row_number() over (
		partition by category, orientation, mode
		order by score desc, time_to_score_ms asc nulls last, account_id
	) as rank
from (
	select distinct on (runs.account_id, runs.category, runs.orientation, runs.mode)
		runs.account_id,
		accounts.display_name,
		runs.category,
		runs.orientation,
		runs.mode,
		runs.score,
		runs.time_to_score_ms
	from public.blitz_runs as runs
	join public.accounts on accounts.id = runs.account_id
	where accounts.name_confirmed
		and runs.score > 0
		and runs.ended_at <= now()
		and runs.ended_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
	order by
		runs.account_id, runs.category, runs.orientation, runs.mode,
		runs.score desc, runs.time_to_score_ms asc nulls last
) as best;

revoke all on public.leaderboard_all_time from public, anon, authenticated;
revoke all on public.leaderboard_weekly from public, anon, authenticated;
revoke all on public.leaderboard_today from public, anon, authenticated;

grant select on public.leaderboard_all_time to anon, authenticated;
grant select on public.leaderboard_weekly to anon, authenticated;
grant select on public.leaderboard_today to anon, authenticated;
