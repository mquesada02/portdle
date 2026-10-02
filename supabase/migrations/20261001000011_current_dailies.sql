-- Current Dailies (Spec 5, ticket #184). Apply in the Supabase SQL editor
-- after 20261001000010. One call returns the server's current time, its UTC
-- date, and the Daily entry id of each category, so the client never computes
-- "today" itself. It always returns three rows, in the order mixed, protocols,
-- applications; entry_id is null when the Schedule has no visible row for the
-- date (the Action has not run for more than seven days). The client treats a
-- null entry_id as a failed read.

create function public.current_dailies()
returns table (server_time timestamptz, utc_date date, category text, entry_id text)
language sql
stable
set search_path = ''
as $$
	select now(), public.server_utc_date(), c.category, s.entry_id
	from (values (1, 'mixed'), (2, 'protocols'), (3, 'applications')) as c (ord, category)
	left join public.schedule s
		on s.category = c.category and s.day = public.server_utc_date()
	order by c.ord
$$;

revoke all on function public.current_dailies() from public, anon, authenticated;
grant execute on function public.current_dailies() to anon, authenticated;
