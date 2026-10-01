begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_table('public', 'club_members', 'Member table exists');
select has_table('public', 'club_member_access', 'Access table exists');
select is((select relrowsecurity from pg_class where oid = 'public.club_members'::regclass), true, 'Members use RLS');
select is((select relrowsecurity from pg_class where oid = 'public.club_member_access'::regclass), true, 'Access uses RLS');
select is((select count(*)::integer from public.club_members), 3, 'Three initial members');
select is((select count(*)::integer from public.club_members where role = 'admin'), 1, 'One initial admin');
select is((select count(*)::integer from public.club_members where role = 'member'), 2, 'Two initial members');
select is((select count(*)::integer from public.club_member_access), 3, 'Three initial access hashes');
select is((select count(*)::integer from public.club_members where auth_user_id is not null), 0, 'No seeded Auth identities');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name in ('club_members', 'club_member_access') and column_name in ('email', 'updated_at')), 0, 'No product email or updated_at columns');
select col_is_pk('public', 'club_members', 'id', 'Database-generated member primary key');
select col_type_is('public', 'club_members', 'id', 'uuid', 'Member IDs are UUIDs');
select col_has_default('public', 'club_members', 'id', 'Database generates IDs');
select col_is_pk('public', 'club_member_access', 'member_id', 'One access entry per member');
select col_not_null('public', 'club_members', 'is_active', 'Active flag is non-null');
select col_not_null('public', 'club_member_access', 'email_sha256', 'Hash is non-null');
select throws_ok($$insert into public.club_members (display_name) values ('')$$, '23514', null, 'Empty display name denied');
select throws_ok($$insert into public.club_members (display_name) values (' padded ')$$, '23514', null, 'Display name must be trimmed');
select throws_ok($$insert into public.club_members (display_name) values (repeat('x', 41))$$, '23514', null, 'Long display name denied');
select throws_ok($$insert into public.club_members (display_name, role) values ('Fixture', 'owner')$$, '23514', null, 'Unknown role denied');
select throws_ok($$insert into public.club_member_access (member_id, email_sha256) select id, 'SHORT' from public.club_members limit 1$$, '23514', null, 'Invalid hash denied');
select throws_ok($$insert into public.club_member_access (member_id, email_sha256) select id, repeat('A', 64) from public.club_members limit 1$$, '23514', null, 'Uppercase hash denied');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'club_member_access'), 0, 'Access has no public policies');

select ok(not has_table_privilege('anon', 'public.club_members', 'SELECT'), 'Anonymous cannot enumerate members');
select ok(has_table_privilege('authenticated', 'public.club_members', 'SELECT'), 'Authenticated can select through RLS');
select ok(not has_table_privilege('authenticated', 'public.club_members', 'INSERT,UPDATE,DELETE'), 'Authenticated has no member writes');
select ok(not has_table_privilege('anon', 'public.club_member_access', 'SELECT,INSERT,UPDATE,DELETE'), 'Anonymous cannot access hashes');
select ok(not has_table_privilege('authenticated', 'public.club_member_access', 'SELECT,INSERT,UPDATE,DELETE'), 'Authenticated cannot access hashes');
select ok(has_function_privilege('supabase_auth_admin', 'public.hook_allow_club_member(jsonb)', 'EXECUTE'), 'Auth admin may call admission hook');
select ok(not has_function_privilege('anon', 'public.hook_allow_club_member(jsonb)', 'EXECUTE'), 'Anonymous cannot call hook');
select ok(not has_function_privilege('authenticated', 'public.hook_allow_club_member(jsonb)', 'EXECUTE'), 'Authenticated cannot call hook');
select ok(not has_function_privilege('service_role', 'public.hook_allow_club_member(jsonb)', 'EXECUTE'), 'Default service-role hook execution is revoked');
select ok(not has_function_privilege('supabase_auth_admin', 'public.handle_club_auth_user_created()', 'EXECUTE'), 'Binding function is not a directly granted RPC');
select ok(not has_function_privilege('authenticated', 'public.handle_club_auth_user_created()', 'EXECUTE'), 'Authenticated cannot execute binding function');
select ok(not has_function_privilege('service_role', 'public.handle_club_auth_user_created()', 'EXECUTE'), 'Default service-role binding execution is revoked');
select is((select count(*)::integer from pg_proc where oid in ('public.hook_allow_club_member(jsonb)'::regprocedure, 'public.handle_club_auth_user_created()'::regprocedure) and prosecdef and proconfig @> array['search_path=""']), 2, 'Both definers have an empty search path');
select is((select count(*)::integer from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_club_auth_user_created' and not tgisinternal and (tgtype & 5) = 5), 1, 'Authorized AFTER INSERT row trigger exists');

-- These fictitious members and Auth users are scoped to this rolled-back test.
with fixtures(display_name, email) as (
  values ('Fixture active', 'authorized@example.test'),
         ('Fixture other', 'other@example.test'),
         ('Fixture inactive', 'inactive@example.test')
), inserted as (
  insert into public.club_members (display_name)
  select display_name from fixtures returning id, display_name
)
insert into public.club_member_access (member_id, email_sha256)
select inserted.id, encode(extensions.digest(fixtures.email, 'sha256'), 'hex')
from inserted join fixtures using (display_name);

select is(public.hook_allow_club_member('{"user":{"email":"  AUTHORIZED@example.test  ","app_metadata":{"provider":"google"}}}'), '{}'::jsonb, 'Approved Google email is normalized');
select is(public.hook_allow_club_member('{"user":{"email":"unknown@example.test","app_metadata":{"provider":"google"}}}') #>> '{error,http_code}', '403', 'Unknown Google account denied');
select is(public.hook_allow_club_member('{"user":{"email":"authorized@example.test","app_metadata":{"provider":"email"}}}') #>> '{error,http_code}', '403', 'Email provider denied');
select is(public.hook_allow_club_member('{"user":{"email":"authorized@example.test","app_metadata":{"provider":"github"}}}') #>> '{error,http_code}', '403', 'Other OAuth provider denied');
select is(public.hook_allow_club_member('{"user":{"app_metadata":{"provider":"google"}}}') #>> '{error,http_code}', '403', 'Missing email denied');
select is(public.hook_allow_club_member('{"user":{"email":null,"app_metadata":{"provider":"google"}}}') #>> '{error,http_code}', '403', 'Null email denied');
select is(public.hook_allow_club_member('{"user":{"email":{"value":"authorized@example.test"},"app_metadata":{"provider":"google"}}}') #>> '{error,http_code}', '403', 'Malformed email denied');
select is(public.hook_allow_club_member('{"user":{"email":"authorized@example.test"}}') #>> '{error,http_code}', '403', 'Missing provider denied');
select is(public.hook_allow_club_member(null) #>> '{error,http_code}', '403', 'Null event denied');
select is(public.hook_allow_club_member('{}') #>> '{error,message}', 'Esta cuenta no está autorizada para Afilados Club.', 'Denial message is generic');

do $$ begin
  perform set_config('test.active_uid', gen_random_uuid()::text, true);
  perform set_config('test.other_uid', gen_random_uuid()::text, true);
  perform set_config('test.inactive_uid', gen_random_uuid()::text, true);
  perform set_config('test.rejected_uid', gen_random_uuid()::text, true);
end $$;

select lives_ok($$insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values (current_setting('test.active_uid')::uuid, '  AUTHORIZED@example.test  ', '{"provider":"google"}', '{"display_name":"Impersonated admin","role":"admin"}')$$, 'Approved insert binds membership');
select is((select auth_user_id::text from public.club_members where display_name = 'Fixture active'), current_setting('test.active_uid'), 'Correct member bound');
select is((select role from public.club_members where display_name = 'Fixture active'), 'member', 'OAuth cannot replace seeded role');
select is((select display_name from public.club_members where auth_user_id = current_setting('test.active_uid')::uuid), 'Fixture active', 'OAuth cannot replace seeded display identity');
select throws_ok($$insert into auth.users (id, email, raw_app_meta_data) values (current_setting('test.rejected_uid')::uuid, 'authorized@example.test', '{"provider":"google"}')$$, '42501', 'Club membership binding refused', 'Existing binding cannot be overwritten');
select is((select count(*)::integer from auth.users where id = current_setting('test.rejected_uid')::uuid), 0, 'Failed binding rolls back Auth insertion');
select is((select auth_user_id::text from public.club_members where display_name = 'Fixture active'), current_setting('test.active_uid'), 'Original binding preserved');
select throws_ok($$insert into auth.users (id, email, raw_app_meta_data) values (gen_random_uuid(), 'unknown@example.test', '{"provider":"google"}')$$, '42501', 'Club membership binding refused', 'Missing access fails closed');
select throws_ok($$insert into auth.users (id, email, raw_app_meta_data) values (gen_random_uuid(), 'other@example.test', '{"provider":"email"}')$$, '42501', 'Club membership binding refused', 'Non-Google insert fails closed');
select throws_ok($$insert into auth.users (id, email, raw_app_meta_data) values (gen_random_uuid(), null, '{"provider":"google"}')$$, '42501', 'Club membership binding refused', 'Null email insert fails closed');
select throws_ok($$insert into auth.users (id, email) values (gen_random_uuid(), 'other@example.test')$$, '42501', 'Club membership binding refused', 'Missing provider insert fails closed');

insert into auth.users (id, email, raw_app_meta_data) values
  (current_setting('test.other_uid')::uuid, 'other@example.test', '{"provider":"google"}'),
  (current_setting('test.inactive_uid')::uuid, 'inactive@example.test', '{"provider":"google"}');
update public.club_members set is_active = false where display_name = 'Fixture inactive';
select is(public.hook_allow_club_member('{"user":{"email":"inactive@example.test","app_metadata":{"provider":"google"}}}') #>> '{error,http_code}', '403', 'Inactive admission denied');
select throws_ok($$insert into auth.users (id, email, raw_app_meta_data) values (gen_random_uuid(), ' INACTIVE@example.test ', '{"provider":"google"}')$$, '42501', 'Club membership binding refused', 'Inactive binding denied');
select throws_ok($$update public.club_members set auth_user_id = current_setting('test.active_uid')::uuid where display_name = 'Fixture other'$$, '23505', null, 'One Auth user cannot bind two members');
select throws_ok($$update public.club_members set auth_user_id = gen_random_uuid() where display_name = 'Fixture other'$$, '23503', null, 'Auth identity FK enforced');
select throws_ok($$update public.club_member_access set email_sha256 = (select email_sha256 from public.club_member_access join public.club_members on id = member_id where display_name = 'Fixture active') where member_id = (select id from public.club_members where display_name = 'Fixture other')$$, '23505', null, 'Access hash is unique');

set local role anon;
select throws_ok('select * from public.club_members', '42501', null, 'Anonymous roster query denied');
select throws_ok('select * from public.club_member_access', '42501', null, 'Anonymous hashes query denied');
select throws_ok($$select public.hook_allow_club_member('{}')$$, '42501', null, 'Anonymous hook invocation denied');
reset role;

do $$ begin
  perform set_config('request.jwt.claim.sub', current_setting('test.active_uid'), true);
end $$;
set local role authenticated;
select is((select count(*)::integer from public.club_members), 1, 'Active member sees only own row');
select is((select display_name from public.club_members), 'Fixture active', 'Own identity visible');
select is((select count(*)::integer from public.club_members where display_name = 'Fixture other'), 0, 'Other identity invisible');
select throws_ok('select * from public.club_member_access', '42501', null, 'Authenticated hashes query denied');
select throws_ok($$insert into public.club_members (display_name, role) values ('Escalation', 'admin')$$, '42501', null, 'Member insertion denied');
select throws_ok($$update public.club_members set role = 'admin'$$, '42501', null, 'Role escalation denied');
select throws_ok('delete from public.club_members', '42501', null, 'Member deletion denied');
select throws_ok($$select public.hook_allow_club_member('{}')$$, '42501', null, 'Authenticated hook invocation denied');
reset role;

do $$ begin
  perform set_config('request.jwt.claim.sub', current_setting('test.inactive_uid'), true);
end $$;
set local role authenticated;
select is((select count(*)::integer from public.club_members), 0, 'Inactive existing identity sees no membership');
reset role;
do $$ begin
  perform set_config('request.jwt.claim.sub', current_setting('test.rejected_uid'), true);
end $$;
set local role authenticated;
select is((select count(*)::integer from public.club_members), 0, 'Unapproved existing identity sees no membership');
reset role;

delete from auth.users where id = current_setting('test.other_uid')::uuid;
select is((select auth_user_id from public.club_members where display_name = 'Fixture other'), null::uuid, 'Auth deletion clears binding without removing member');
delete from public.club_members where display_name = 'Fixture other';
select is((select count(*)::integer from public.club_member_access where email_sha256 = encode(extensions.digest('other@example.test', 'sha256'), 'hex')), 0, 'Member deletion cascades access entry');

select * from finish();
rollback;
