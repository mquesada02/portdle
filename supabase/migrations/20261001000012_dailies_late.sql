-- The Daily `late` mark (Spec 5, ticket #189). Apply in the Supabase SQL
-- editor after 20261001000011, on the switch-over day and never earlier. The
-- local stack and CI apply it with the other migrations.
--
-- A Daily record carries `late`: true when its first try was committed after
-- its day. The column has no default and stays nullable: a null `late` on or
-- before the switch-over day reads as on-day everywhere. Applied on the
-- switch-over day, a row dated after it can only come from a wrong device
-- clock and points at the old order, so it goes. A row after the day must
-- then carry `late`, which stops an old tab that does not send it.

alter table public.dailies add column late boolean;

delete from public.dailies where day > public.switch_over_day();

update public.dailies set late = false;

alter table public.dailies
	add constraint dailies_late_required
	check (late is not null or day <= public.switch_over_day());

-- A check constraint runs as the writing role, and the import migration
-- revoked execute on this function from `authenticated`. Without this grant
-- every signed-in push would fail. The function returns a public constant;
-- `anon` stays revoked.
grant execute on function public.switch_over_day() to authenticated;
