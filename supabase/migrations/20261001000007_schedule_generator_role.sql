-- Schedule generator role (Spec 5, ticket #184): the login role the Schedule
-- Action connects with. It is created with no password, so no secret is in the
-- repository; the owner sets the live password by hand in the SQL editor and
-- keeps it only as a repository secret.
--
-- This file creates only the role and is safe to run twice: the owner applies
-- it alone and early to check that the connection pooler accepts the role
-- (Supabase Free, session mode, port 5432), and applies it again with the
-- other migrations on the switch-over day. If the role exists, nothing
-- changes, including its password. It grants nothing: table and schema grants
-- are in 20261001000008, and each function's grants are in the migration that
-- creates the function. `connect` needs no grant, since it goes to public by
-- default.

do $$
begin
	if not exists (select from pg_roles where rolname = 'schedule_generator') then
		create role schedule_generator login nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
	end if;
end
$$;
