-- Local stack only: five email and password test users with a confirmed
-- display name, one per Playwright project: test-chromium@portdle.local,
-- test-firefox@portdle.local, test-webkit@portdle.local,
-- test-pixel-7@portdle.local, and test-iphone-14@portdle.local. All five use
-- the password portdle-local-test. The catalog and the Schedule come from the
-- migrations.
-- The token columns are empty strings, not null: the auth service fails to
-- read a user whose token columns are null.
insert into auth.users (
	instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
	raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
	confirmation_token, recovery_token, email_change, email_change_token_new
)
select
	'00000000-0000-0000-0000-000000000000',
	('00000000-0000-4000-8000-00000000000' || t.n)::uuid,
	'authenticated', 'authenticated', t.email,
	extensions.crypt('portdle-local-test', extensions.gen_salt('bf')), now(),
	'{"provider":"email","providers":["email"]}',
	jsonb_build_object('full_name', 'Local Tester ' || (t.n - 1)),
	now(), now(), '', '', '', ''
from (values
	(2, 'test-chromium@portdle.local'),
	(3, 'test-firefox@portdle.local'),
	(4, 'test-webkit@portdle.local'),
	(5, 'test-pixel-7@portdle.local'),
	(6, 'test-iphone-14@portdle.local')
) as t (n, email);

insert into auth.identities (
	id, user_id, provider_id, provider, identity_data, last_sign_in_at,
	created_at, updated_at
)
select
	gen_random_uuid(), u.id, u.id::text, 'email',
	jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
	now(), now(), now()
from auth.users u
where u.email like 'test-%@portdle.local';

update public.accounts
set name_confirmed = true
where id in (select id from auth.users where email like 'test-%@portdle.local');
