-- Local stack only: one email and password test user with a confirmed
-- display name. Sign in as test@portdle.local with the password
-- portdle-local-test. The catalog and the Schedule come from the migrations.
insert into auth.users (
	instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
	raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
	confirmation_token, recovery_token, email_change, email_change_token_new
) values (
	'00000000-0000-0000-0000-000000000000',
	'00000000-0000-4000-8000-000000000001',
	'authenticated', 'authenticated', 'test@portdle.local',
	extensions.crypt('portdle-local-test', extensions.gen_salt('bf')), now(),
	'{"provider":"email","providers":["email"]}', '{"full_name":"Local Tester"}',
	now(), now(), '', '', '', ''
);

insert into auth.identities (
	id, user_id, provider_id, provider, identity_data, last_sign_in_at,
	created_at, updated_at
) values (
	gen_random_uuid(),
	'00000000-0000-4000-8000-000000000001',
	'00000000-0000-4000-8000-000000000001', 'email',
	'{"sub":"00000000-0000-4000-8000-000000000001","email":"test@portdle.local","email_verified":true}',
	now(), now(), now()
);

update public.accounts
set name_confirmed = true
where id = '00000000-0000-4000-8000-000000000001';
