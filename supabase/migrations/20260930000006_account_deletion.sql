-- Account deletion (Spec 4, ticket #140). Apply in the Supabase SQL editor after
-- 20260929000003 and the migrations of the sibling tickets. "Automatically
-- expose new tables" is off in this project, so the execute grant below is
-- explicit.
-- The function deletes the caller's own auth user and takes no argument, so a
-- caller can only name themselves. The cascades already in place (auth user,
-- account row, every private table) remove the rest, so the leaderboard views
-- no longer show the player.

create function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if (select auth.uid()) is null then
		raise exception 'not signed in' using errcode = '28000';
	end if;
	delete from auth.users where id = (select auth.uid());
end
$$;

revoke all on function public.delete_account() from public, anon, authenticated;
grant execute on function public.delete_account() to authenticated;
