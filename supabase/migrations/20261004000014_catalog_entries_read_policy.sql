-- Catalog read policy (Spec 5 release fix). Apply in the Supabase SQL editor
-- after 20261001000013 (the owner applies migrations in filename order).
--
-- The live project turned row-level security on for the new catalog_entries
-- table by itself, and with no policy every reader saw zero rows. This file
-- makes the state explicit everywhere: row-level security on, with one read
-- policy for visitors, players, and the generator role. It supersedes the
-- "no row-level security (owner call)" note in 20261001000008. Writes stay
-- blocked by the grants in 20261001000008 and the triggers in 20261001000010.
--
-- The owner applied this SQL on the live project on 2026-10-04. Running it
-- again changes nothing: turning row-level security on twice is a no-op, and
-- the policy is dropped and created again in the same transaction.

alter table public.catalog_entries enable row level security;
drop policy if exists catalog_entries_read on public.catalog_entries;
create policy catalog_entries_read on public.catalog_entries
	for select to anon, authenticated, schedule_generator
	using (true);
