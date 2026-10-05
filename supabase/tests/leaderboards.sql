-- Owner-run in the Supabase SQL editor after the leaderboards migration.
-- Raises on the first failed assertion; prints a notice on success.
-- It inserts throwaway users (whose account rows the seed trigger creates)
-- with runs and Bests on one key, checks the three views under three session
-- time zones, and deletes the users at the end; the cascade removes every
-- row. The whole block is atomic, so a failed assertion leaves nothing
-- behind. Real rows on the same key do not matter: every assertion looks
-- only at the throwaway accounts.

do $$
declare
	ua uuid := gen_random_uuid(); -- confirmed: a past week run, a tie, a future run
	ub uuid := gen_random_uuid(); -- confirmed: faster tie, an untimed Best
	uc uuid := gen_random_uuid(); -- not confirmed
	ud uuid := gen_random_uuid(); -- confirmed, zero score only
	ue uuid := gen_random_uuid(); -- confirmed: an untimed Best equal to a timed run
	ids uuid[];
	week_start timestamptz := date_trunc('week', now() at time zone 'utc') at time zone 'utc';
	day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
	zone text;
	rows record;
	rank_a bigint;
	rank_b bigint;
	found_score integer;
	found_time double precision;
begin
	ids := array[ua, ub, uc, ud, ue];
	insert into auth.users (id, raw_app_meta_data, raw_user_meta_data)
	select id, '{"provider":"github"}', jsonb_build_object('user_name', 'lb-test-' || n)
	from unnest(ids) with ordinality as t(id, n);
	update public.accounts set name_confirmed = true where id in (ua, ub, ud, ue);

	-- Runs: (account, ended_at, score, time). Key: protocols, inverted, marathon.
	insert into public.blitz_runs (account_id, ended_at, category, orientation, mode, ended, score, time_to_score_ms, rounds) values
		(ua, now() - interval '1 second', 'protocols', 'inverted', 'marathon', 'lives', 10, 5000, '[]'),
		-- Two seconds: on a Monday day_start equals week_start, so one second
		-- would share its (account, ended_at) key with the day_start run below.
		(ua, week_start - interval '2 seconds', 'protocols', 'inverted', 'marathon', 'lives', 50, 4000, '[]'),
		(ua, day_start - interval '1 second', 'protocols', 'inverted', 'marathon', 'lives', 30, 4000, '[]'),
		(ua, now() + interval '1 day', 'protocols', 'inverted', 'marathon', 'lives', 999, 1, '[]'),
		(ub, now() - interval '1 second', 'protocols', 'inverted', 'marathon', 'lives', 10, 3000, '[]'),
		(uc, now() - interval '1 second', 'protocols', 'inverted', 'marathon', 'lives', 99, 1, '[]'),
		(ud, now() - interval '1 second', 'protocols', 'inverted', 'marathon', 'lives', 0, 0, '[]'),
		(ue, now() - interval '1 second', 'protocols', 'inverted', 'marathon', 'lives', 10, 4000, '[]');
	insert into public.blitz_bests (account_id, category, orientation, mode, score, time_to_score_ms) values
		(ub, 'protocols', 'inverted', 'marathon', 12, null),
		(ue, 'protocols', 'inverted', 'marathon', 10, null),
		(uc, 'protocols', 'inverted', 'marathon', 77, 1),
		(ud, 'protocols', 'inverted', 'marathon', 0, 0);

	foreach zone in array array['UTC', 'Pacific/Auckland', 'America/Los_Angeles'] loop
		perform set_config('timezone', zone, true);

		-- All-time: the best of every run and the Best; the future run does not count.
		select score, time_to_score_ms into found_score, found_time from public.leaderboard_all_time
			where account_id = ua and category = 'protocols' and orientation = 'inverted' and mode = 'marathon';
		assert found_score = 50 and found_time = 4000, format('all-time best of a (%s)', zone);
		select score into found_score from public.leaderboard_all_time
			where account_id = ub and category = 'protocols' and orientation = 'inverted' and mode = 'marathon';
		assert found_score = 12, format('all-time counts the stored Best (%s)', zone);
		select score, time_to_score_ms into found_score, found_time from public.leaderboard_all_time
			where account_id = ue and category = 'protocols' and orientation = 'inverted' and mode = 'marathon';
		assert found_score = 10 and found_time = 4000, format('a timed run beats an untimed Best at an equal score (%s)', zone);

		-- Weekly: the past-week run is out; the earlier-today run is in unless today is Monday.
		select score into found_score from public.leaderboard_weekly
			where account_id = ua and category = 'protocols' and orientation = 'inverted' and mode = 'marathon';
		assert found_score = case when day_start > week_start then 30 else 10 end, format('weekly window of a (%s)', zone);
		select score into found_score from public.leaderboard_weekly
			where account_id = ub and category = 'protocols' and orientation = 'inverted' and mode = 'marathon';
		assert found_score = 10, format('weekly ignores the stored Best (%s)', zone);

		-- Today: only the run since 00:00 UTC.
		select score into found_score from public.leaderboard_today
			where account_id = ua and category = 'protocols' and orientation = 'inverted' and mode = 'marathon';
		assert found_score = 10, format('today window of a (%s)', zone);

		-- Faster time to score wins an equal score: b (3000) before e (4000) before a (5000).
		select rank into rank_a from public.leaderboard_today
			where account_id = ua and category = 'protocols' and orientation = 'inverted' and mode = 'marathon';
		select rank into rank_b from public.leaderboard_today
			where account_id = ub and category = 'protocols' and orientation = 'inverted' and mode = 'marathon';
		assert rank_b < rank_a, format('faster time ranks first (%s)', zone);
		assert (select rank from public.leaderboard_today where account_id = ue and category = 'protocols' and orientation = 'inverted' and mode = 'marathon')
			between rank_b and rank_a, format('the middle time ranks in between (%s)', zone);

		-- Unconfirmed names and zero scores never appear, in any window.
		assert not exists (select 1 from public.leaderboard_all_time where account_id in (uc, ud)), format('all-time leaves out c and d (%s)', zone);
		assert not exists (select 1 from public.leaderboard_weekly where account_id in (uc, ud)), format('weekly leaves out c and d (%s)', zone);
		assert not exists (select 1 from public.leaderboard_today where account_id in (uc, ud)), format('today leaves out c and d (%s)', zone);

		-- One row per player and key; ranks are unique per key.
		assert not exists (select 1 from public.leaderboard_all_time group by account_id, category, orientation, mode having count(*) > 1), format('one row per player and key (%s)', zone);
		assert not exists (select 1 from public.leaderboard_all_time group by category, orientation, mode, rank having count(*) > 1), format('unique ranks (%s)', zone);
	end loop;

	-- The exposed columns, exactly.
	for rows in
		select view_name from (values ('leaderboard_all_time'), ('leaderboard_weekly'), ('leaderboard_today')) as v(view_name)
	loop
		assert (
			select array_agg(column_name::text order by ordinal_position)
			from information_schema.columns
			where table_schema = 'public' and table_name = rows.view_name
		) = array['account_id', 'display_name', 'category', 'orientation', 'mode', 'score', 'time_to_score_ms', 'rank'],
			format('columns of %s', rows.view_name);
		assert has_table_privilege('anon', 'public.' || rows.view_name, 'select'), format('anon select on %s', rows.view_name);
		assert has_table_privilege('authenticated', 'public.' || rows.view_name, 'select'), format('authenticated select on %s', rows.view_name);
		assert not has_table_privilege('anon', 'public.' || rows.view_name, 'insert')
			and not has_table_privilege('anon', 'public.' || rows.view_name, 'update')
			and not has_table_privilege('anon', 'public.' || rows.view_name, 'delete'), format('anon has no write on %s', rows.view_name);
		assert not has_table_privilege('authenticated', 'public.' || rows.view_name, 'insert')
			and not has_table_privilege('authenticated', 'public.' || rows.view_name, 'update')
			and not has_table_privilege('authenticated', 'public.' || rows.view_name, 'delete'), format('authenticated has no write on %s', rows.view_name);
	end loop;

	-- Visitors reach the views but not the tables behind them.
	assert not has_table_privilege('anon', 'public.blitz_runs', 'select'), 'anon cannot read runs';
	assert not has_table_privilege('anon', 'public.blitz_bests', 'select'), 'anon cannot read Bests';
	assert not has_table_privilege('anon', 'public.accounts', 'select'), 'anon cannot read accounts';

	-- An anonymous read works through the views' owner rights.
	set local role anon;
	perform count(*) from public.leaderboard_all_time;
	perform count(*) from public.leaderboard_weekly;
	perform count(*) from public.leaderboard_today;
	reset role;

	delete from auth.users where id = any(ids);
	assert not exists (select 1 from public.blitz_runs where account_id = any(ids)), 'cascade removes runs';
	assert not exists (select 1 from public.blitz_bests where account_id = any(ids)), 'cascade removes Bests';
	assert not exists (select 1 from public.leaderboard_all_time where account_id = any(ids)), 'the views no longer show the users';

	raise notice 'leaderboards.sql: all assertions passed';
end
$$;
