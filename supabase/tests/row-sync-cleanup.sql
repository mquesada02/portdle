-- Owner-run in the Supabase SQL editor after `pnpm smoke:backend`. The players'
-- tables grant no delete, so the smoke script cannot remove its rows. This
-- deletes exactly the rows it tags, for one account, and prints how many.
-- Set the account id below (the `id` of your row in public.accounts).
-- Tags: Codex entry 'smoke-test'; run ended at 2000-01-01T00:00:00Z; Daily
-- dated 2000-01-01; Best with score 0 and time to score 1234.5.

do $$
declare
	owner_id uuid := '00000000-0000-0000-0000-000000000000';
	removed integer := 0;
	part integer;
begin
	if not exists (select 1 from public.accounts where id = owner_id) then
		raise exception 'set owner_id to your account id (public.accounts.id)';
	end if;

	delete from public.codex_entries where account_id = owner_id and entry_id = 'smoke-test';
	get diagnostics part = row_count;
	removed := removed + part;

	delete from public.blitz_bests
		where account_id = owner_id and score = 0 and time_to_score_ms = 1234.5;
	get diagnostics part = row_count;
	removed := removed + part;

	delete from public.blitz_runs
		where account_id = owner_id and ended_at = '2000-01-01T00:00:00Z';
	get diagnostics part = row_count;
	removed := removed + part;

	delete from public.dailies where account_id = owner_id and day = '2000-01-01';
	get diagnostics part = row_count;
	removed := removed + part;

	raise notice 'row-sync-cleanup.sql: removed % tagged rows', removed;
end
$$;
