-- Owner-run in the Supabase SQL editor after the global stats migration, and
-- run in CI. Raises on the first failed assertion; prints a notice on success.
-- It inserts throwaway users (the seed trigger makes their account rows) with
-- Daily rows on a day far in the past, so no real row shares it, and checks
-- the view under three session time zones. It rolls back, so it leaves
-- nothing behind.

begin;

do $$
declare
	users uuid[] := array(select gen_random_uuid() from generate_series(1, 9));
	past constant date := date '2000-01-01';
	future date := public.server_utc_date() + 1;
	zone text;
	stat record;
	cnt integer;
begin
	insert into auth.users (id, raw_app_meta_data, raw_user_meta_data)
	select id, '{"provider":"github"}', jsonb_build_object('user_name', 'gs-test-' || n)
	from unnest(users) with ordinality as t(id, n);

	-- Protocols on the past day: u1 wins in 1, u2 wins in 3, u3 wins in 3,
	-- u4 loses, u5 is still playing, u6 is late, u7 has a null late, u8 wins
	-- with seven guesses. Mixed: u1 wins in 6. Future day: u1 wins in 2.
	insert into public.dailies (account_id, category, day, status, guesses, late) values
		(users[1], 'protocols', past, 'won', '[{}]', false),
		(users[2], 'protocols', past, 'won', '[{},{},{}]', false),
		(users[3], 'protocols', past, 'won', '[{},{},{}]', false),
		(users[4], 'protocols', past, 'lost', '[{},{},{},{},{},{}]', false),
		(users[5], 'protocols', past, 'playing', '[{}]', false),
		(users[6], 'protocols', past, 'won', '[{},{}]', true),
		(users[7], 'protocols', past, 'won', '[{},{},{},{}]', null),
		(users[8], 'protocols', past, 'won', '[{},{},{},{},{},{},{}]', false),
		(users[1], 'mixed', past, 'won', '[{},{},{},{},{},{}]', false),
		(users[1], 'protocols', future, 'won', '[{},{}]', false);

	foreach zone in array array['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'] loop
		perform set_config('timezone', zone, true);

		select * into stat from public.daily_global_stats
			where category = 'protocols' and day = past;
		assert stat.players = 6, format('players: finished, on-day rows only (%s)', zone);
		assert stat.wins = 5, format('wins (%s)', zone);
		assert stat.won_in_1 = 1, format('won in 1 (%s)', zone);
		assert stat.won_in_2 = 0, format('a late win is not counted (%s)', zone);
		assert stat.won_in_3 = 2, format('won in 3 (%s)', zone);
		assert stat.won_in_4 = 1, format('a null late counts as on-day (%s)', zone);
		assert stat.won_in_5 = 0 and stat.won_in_6 = 0, format('empty tries (%s)', zone);
		assert stat.lost = 1, format('losses by status (%s)', zone);

		select * into stat from public.daily_global_stats
			where category = 'mixed' and day = past;
		assert stat.players = 1 and stat.wins = 1 and stat.won_in_6 = 1,
			format('categories are kept apart (%s)', zone);

		select count(*) into cnt from public.daily_global_stats where day = future;
		assert cnt = 0, format('a day after the server date is absent (%s)', zone);
	end loop;

	-- Readable by visitors and signed-in players, with a positive count.
	set local role anon;
	select players into cnt from public.daily_global_stats
		where category = 'protocols' and day = past;
	assert cnt = 6, 'anon reads the view';
	reset role;
	set local role authenticated;
	select players into cnt from public.daily_global_stats
		where category = 'protocols' and day = past;
	assert cnt = 6, 'authenticated reads the view';
	reset role;

	-- The table behind it stays private to visitors.
	set local role anon;
	begin
		perform count(*) from public.dailies;
		reset role;
		raise exception 'anon must not read dailies';
	exception when insufficient_privilege then
		reset role;
	end;
end
$$;

rollback;

do $$
begin
	raise notice 'daily-global-stats: ok';
end
$$;
