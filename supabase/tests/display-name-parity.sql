-- Owner-run in the Supabase SQL editor after 20260929000002_display_name_rule.sql.
-- Checks that the accounts CHECK and normalize_display_name give the same
-- verdict as the client rule for every case in src/engine/display-name-cases.ts
-- (a Vitest test keeps this list in sync). Raises on the first mismatch and
-- prints a notice on success. The auth.users row it inserts is deleted at the
-- end (the cascade removes the account row).

do $$
declare
	test_id uuid := gen_random_uuid();
	c record;
	check_ok boolean;
	checked integer := 0;
begin
	insert into auth.users (id, raw_app_meta_data, raw_user_meta_data)
	values (test_id, '{"provider":"github"}', '{"user_name":"parity-test"}');

	for c in
		select * from (values
		(E'Zo\u00eb', true, 'Latin, precomposed accent'),
		(E'Zoe\u0301', true, 'Latin, decomposed accent'),
		(E'\u674e', true, 'CJK'),
		(E'\U00020000', true, 'CJK, astral'),
		(E'\u0418\u0432\u0430\u043d', true, 'Cyrillic'),
		(E'\u0623\u062d\u0645\u062f', true, 'Arabic letters'),
		(E'\u0939\u093f\u0902\u0926\u0940', true, 'Devanagari with vowel signs'),
		(E'Agent 007', true, 'ASCII digits'),
		(E'Ada\u0663', true, 'Arabic-Indic digit'),
		(E'Ada\uff13', true, 'Fullwidth digit'),
		(E'\u2115', true, 'Letter-like symbol N'),
		(E'O\u0027Neil\u002dSmith Jr\u002e', true, 'Apostrophe, hyphen, period'),
		(E'7', true, 'One digit'),
		(E'a\u0301\u0302', true, 'One letter plus marks'),
		(E'\u0301\u0302', false, 'Marks only'),
		(E'\u0301 \u0302', false, 'Marks plus spaces'),
		(E'\u0027\u002e\u002d', false, 'Apostrophe, hyphen, period only'),
		(E'Ada\u00b2', false, 'Superscript digit'),
		(E'Ada\u00bd', false, 'Vulgar fraction'),
		(E'Ada\u216b', false, 'Roman numeral'),
		(E'Ada\u005fL', false, 'Underscore'),
		(E'Ada\u0021', false, 'Punctuation'),
		(E'Ada\u0009L', false, 'Tab'),
		(E'Ada\u000aL', false, 'Newline'),
		(E'Ada\u0085L', false, 'C1 control'),
		(E'Ada\u00a0L', false, 'Non-breaking space'),
		(E'Ada\u200dL', false, 'Zero-width joiner'),
		(E'Ada\u200cL', false, 'Zero-width non-joiner'),
		(E'Ada \U0001f600', false, 'Emoji'),
		(E'\U0001f468\u200d\U0001f469', false, 'Emoji ZWJ sequence'),
		(E'1\ufe0f\u20e3', false, 'Keycap emoji'),
		(E'Ada\ufe0f', false, 'Variation selector')
		) as t (name, expected, label)
	loop
		begin
			update public.accounts set display_name = c.name where id = test_id;
			check_ok := true;
		exception when check_violation then
			check_ok := false;
		end;
		if check_ok is distinct from c.expected then
			raise exception 'CHECK mismatch for "%": expected %, got %', c.label, c.expected, check_ok;
		end if;
		if (public.normalize_display_name(c.name) = c.name) is distinct from c.expected then
			raise exception 'normalize_display_name mismatch for "%": expected %, got %', c.label, c.expected, not c.expected;
		end if;
		checked := checked + 1;
	end loop;

	delete from auth.users where id = test_id;
	raise notice 'display-name-parity.sql: all % cases passed', checked;
end
$$;
