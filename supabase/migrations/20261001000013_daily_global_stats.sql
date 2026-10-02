-- Global stats (Spec 5, ticket #192): a read-only view with the on-day totals
-- of each Daily category and day. Apply in the Supabase SQL editor after
-- 20261001000012 (the owner applies migrations in filename order).
--
-- Rules:
-- - Only finished rows (`won` or `lost`).
-- - Only on-day rows: `late is not true`, so a null `late` counts as on-day.
-- - Only days on or before the server's UTC date, never the session time zone.
-- - `players` counts the rows, one per account, category, and day (the primary
--   key of `dailies`). `won_in_n` is the length of the guess list, so a won row
--   whose list is longer than six (a client-reported value) counts in `players`
--   and `wins` only.
-- The client computes the percentages. The view is computed on every read: no
-- cache table and no minimum player count.
--
-- The view keeps the default owner rights (security_invoker off) on purpose,
-- like the leaderboard views: a visitor cannot read `dailies`, and the view
-- holds counts without names. Supabase's linter flags such views; this one is
-- intended. "Automatically expose new tables" is off in this project, so the
-- grant below is explicit.

create view public.daily_global_stats
with (security_invoker = false) as
select
	category,
	day,
	count(*) as players,
	count(*) filter (where status = 'won') as wins,
	count(*) filter (where status = 'won' and jsonb_array_length(guesses) = 1) as won_in_1,
	count(*) filter (where status = 'won' and jsonb_array_length(guesses) = 2) as won_in_2,
	count(*) filter (where status = 'won' and jsonb_array_length(guesses) = 3) as won_in_3,
	count(*) filter (where status = 'won' and jsonb_array_length(guesses) = 4) as won_in_4,
	count(*) filter (where status = 'won' and jsonb_array_length(guesses) = 5) as won_in_5,
	count(*) filter (where status = 'won' and jsonb_array_length(guesses) = 6) as won_in_6,
	count(*) filter (where status = 'lost') as lost
from public.dailies
where status in ('won', 'lost')
	and late is not true
	and day <= public.server_utc_date()
group by category, day;

revoke all on public.daily_global_stats from public, anon, authenticated;
grant select on public.daily_global_stats to anon, authenticated;
