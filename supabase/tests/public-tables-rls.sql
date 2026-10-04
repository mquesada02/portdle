-- Owner-run in the Supabase SQL editor, and run in CI. Raises on the first
-- failed assertion; prints a notice on success.
-- Every table in schema public has row-level security on, and every table that
-- anon or authenticated may read has a policy for that role, so no table depends
-- on the project's own row-level security setting (see 20261004000014).
-- Tables include partitioned tables; a read is any table or column select
-- grant; a read policy whose condition is literally false does not count.

do $$
declare
	missing text;
begin
	select string_agg(c.relname, ', ' order by c.relname) into missing
	from pg_class c
	where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity;
	assert missing is null, format('tables without row-level security: %s', missing);

	select string_agg(format('%s (%s)', c.relname, r.rolname), ', ' order by c.relname, r.rolname) into missing
	from pg_class c
	cross join (values ('anon'), ('authenticated')) as r(rolname)
	where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
		and has_any_column_privilege(r.rolname, c.oid, 'select')
		and not exists (
			select from pg_policies p
			where p.schemaname = 'public' and p.tablename = c.relname
				and p.cmd in ('SELECT', 'ALL')
				and (r.rolname = any (p.roles) or 'public' = any (p.roles))
				and coalesce(p.qual, 'true') <> 'false'
		);
	assert missing is null, format('readable tables without a read policy: %s', missing);

	raise notice 'public-tables-rls.sql: all assertions passed';
end
$$;
