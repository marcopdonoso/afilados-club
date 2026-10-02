begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Fail meaningfully on Block 2 before any new-schema fixtures execute.
select has_table('public', 'activity_ideas', 'Ideas table exists');
select has_table('public', 'activity_idea_votes', 'Votes table exists');
select has_function('private', 'current_club_member_id', array[]::text[], 'Active identity helper exists outside the Data API');
select has_function('private', 'is_club_admin', array[]::text[], 'Active admin helper exists outside the Data API');

select is((select count(*)::integer from public.activity_ideas), 0, 'No product ideas seeded');
select is((select count(*)::integer from public.activity_idea_votes), 0, 'No product votes seeded');
select is((select count(*)::integer from pg_class where oid in ('public.activity_ideas'::regclass, 'public.activity_idea_votes'::regclass) and relrowsecurity), 2, 'Both tables enable RLS');
select col_type_is('public', 'activity_ideas', 'id', 'uuid', 'Idea ID is UUID');
select col_is_pk('public', 'activity_ideas', 'id', 'Idea ID is primary key');
select col_type_is('public', 'activity_ideas', 'season_year', 'smallint', 'Season dimension is smallint');
select col_type_is('public', 'activity_ideas', 'category', 'text', 'Categories are text, not a PostgreSQL enum');
select col_is_pk('public', 'activity_idea_votes', array['idea_id', 'member_id'], 'One vote per idea/member');
select col_not_null('public', 'activity_ideas', column_name, 'Non-null idea ' || column_name)
from unnest(array['id', 'season_year', 'proposed_by', 'category', 'title', 'created_at', 'updated_at']) as column_name;
select col_not_null('public', 'activity_idea_votes', column_name, 'Non-null vote ' || column_name)
from unnest(array['idea_id', 'member_id', 'vote', 'created_at', 'updated_at']) as column_name;
select col_has_default('public', 'activity_ideas', column_name, 'Generated idea ' || column_name)
from unnest(array['id', 'proposed_by', 'created_at', 'updated_at']) as column_name;
select col_has_default('public', 'activity_idea_votes', column_name, 'Generated vote ' || column_name)
from unnest(array['member_id', 'created_at', 'updated_at']) as column_name;
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name in ('activity_ideas', 'activity_idea_votes') and column_name in ('email', 'role')), 0, 'No email or role stored in ideas/votes');

select is((select count(*)::integer from pg_proc where oid in ('private.current_club_member_id()'::regprocedure, 'private.is_club_admin()'::regprocedure) and prosecdef and proconfig @> array['search_path=""']), 2, 'Both identity definers have empty search paths');
select is((select proconfig @> array['search_path=""'] from pg_proc where oid = 'private.touch_updated_at()'::regprocedure), true, 'Trigger helper has empty search path');
select ok(not has_function_privilege(role_name, function_name, 'EXECUTE'), role_name || ' cannot invoke ' || function_name)
from unnest(array['anon', 'service_role', 'supabase_auth_admin']) as role_name
cross join unnest(array['private.current_club_member_id()', 'private.is_club_admin()', 'private.touch_updated_at()']) as function_name;
select ok(has_function_privilege('authenticated', 'private.current_club_member_id()', 'EXECUTE'), 'Authenticated may resolve active identity');
select ok(has_function_privilege('authenticated', 'private.is_club_admin()', 'EXECUTE'), 'Authenticated may resolve own admin status');
select ok(not has_function_privilege('authenticated', 'private.touch_updated_at()', 'EXECUTE'), 'Trigger is not directly executable by clients');
select is((select count(*)::integer from pg_proc as p cross join lateral aclexplode(p.proacl) as acl where p.oid in ('private.current_club_member_id()'::regprocedure, 'private.is_club_admin()'::regprocedure, 'private.touch_updated_at()'::regprocedure) and acl.grantee = 0), 0, 'No inherited PUBLIC execute on helpers');
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'Anonymous cannot use private schema');
select ok(has_schema_privilege('authenticated', 'private', 'USAGE'), 'Policies/defaults can use identity helpers');
select is((select count(*)::integer from pg_proc join pg_namespace on pronamespace = pg_namespace.oid where nspname = 'public' and proname in ('current_club_member_id', 'is_club_admin', 'touch_updated_at')), 0, 'No new exposed public RPC');

select ok(not has_table_privilege('anon', table_name, 'SELECT,INSERT,UPDATE,DELETE'), 'Anonymous has no privileges on ' || table_name)
from unnest(array['public.club_members', 'public.activity_ideas', 'public.activity_idea_votes']) as table_name;
select ok(not has_table_privilege('authenticated', 'public.club_members', 'INSERT,UPDATE,DELETE'), 'Roster remains read-only');
select ok(not has_table_privilege('authenticated', table_name, 'INSERT,UPDATE'), 'No broad table write grants on ' || table_name)
from unnest(array['public.activity_ideas', 'public.activity_idea_votes']) as table_name;
select ok(has_table_privilege('authenticated', table_name, 'SELECT,DELETE'), 'Authenticated table read/delete grant on ' || table_name)
from unnest(array['public.activity_ideas', 'public.activity_idea_votes']) as table_name;
select ok(has_column_privilege('authenticated', 'public.activity_ideas', column_name, 'INSERT'), 'Allowed idea insert column ' || column_name)
from unnest(array['season_year', 'category', 'title', 'description']) as column_name;
select ok(has_column_privilege('authenticated', 'public.activity_ideas', column_name, 'UPDATE'), 'Allowed idea update column ' || column_name)
from unnest(array['category', 'title', 'description']) as column_name;
select ok(not has_column_privilege('authenticated', 'public.activity_ideas', column_name, 'INSERT,UPDATE'), 'Generated idea column not writable ' || column_name)
from unnest(array['id', 'proposed_by', 'created_at', 'updated_at']) as column_name;
select ok(not has_column_privilege('authenticated', 'public.activity_ideas', 'season_year', 'UPDATE'), 'Season is immutable');
select ok(has_column_privilege('authenticated', 'public.activity_idea_votes', column_name, 'INSERT'), 'Allowed vote insert column ' || column_name)
from unnest(array['idea_id', 'vote']) as column_name;
select ok(has_column_privilege('authenticated', 'public.activity_idea_votes', 'vote', 'UPDATE'), 'Only vote value is mutable');
select ok(not has_column_privilege('authenticated', 'public.activity_idea_votes', column_name, 'INSERT,UPDATE'), 'Generated vote column not writable ' || column_name)
from unnest(array['member_id', 'created_at', 'updated_at']) as column_name;
select ok(not has_column_privilege('authenticated', 'public.activity_idea_votes', 'idea_id', 'UPDATE'), 'Vote idea identity immutable');

-- Fictitious admission/binding fixtures, all rolled back with this transaction.
with fixtures(display_name, role, email) as (
  values ('Board author', 'member', 'board-author@example.test'),
         ('Board other', 'member', 'board-other@example.test'),
         ('Board admin', 'admin', 'board-admin@example.test'),
         ('Board inactive', 'admin', 'board-inactive@example.test')
), inserted as (
  insert into public.club_members(display_name, role)
  select display_name, role from fixtures returning id, display_name
)
insert into public.club_member_access(member_id, email_sha256)
select inserted.id, encode(extensions.digest(fixtures.email, 'sha256'), 'hex')
from inserted join fixtures using (display_name);
insert into auth.users(id, email, raw_app_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'board-author@example.test', '{"provider":"google"}'),
  ('10000000-0000-4000-8000-000000000002', 'board-other@example.test', '{"provider":"google"}'),
  ('10000000-0000-4000-8000-000000000003', 'board-admin@example.test', '{"provider":"google"}'),
  ('10000000-0000-4000-8000-000000000004', 'board-inactive@example.test', '{"provider":"google"}');
update public.club_members set is_active = false where display_name = 'Board inactive';
select set_config('test.author_id', (select id::text from public.club_members where display_name = 'Board author'), true);
select set_config('test.other_id', (select id::text from public.club_members where display_name = 'Board other'), true);

set local role anon;
select throws_ok('select * from public.activity_ideas', '42501', null, 'Anonymous ideas denied');
select throws_ok('select * from public.activity_idea_votes', '42501', null, 'Anonymous votes denied');
select throws_ok('select private.current_club_member_id()', '42501', null, 'Anonymous identity helper denied');
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is(private.current_club_member_id()::text, current_setting('test.author_id'), 'Active auth.uid resolves member');
select is(private.is_club_admin(), false, 'Ordinary member is not admin');
select is((select count(*)::integer from public.club_members), 6, 'Active requester reads all active members, including unbound roster');
select is((select count(*)::integer from public.club_members where not is_active), 0, 'Inactive roster excluded');
select lives_ok($$insert into public.activity_ideas(season_year, category, title, description) values (2026, 'camping', 'First plan', null)$$, 'Own creation with database author/ID/timestamps works');
select is((select proposed_by::text from public.activity_ideas where title = 'First plan'), current_setting('test.author_id'), 'Author defaults to active caller');
select is((select created_at = now() and updated_at = now() from public.activity_ideas where title = 'First plan'), true, 'Creation timestamps generated');
select set_config('test.idea_id', (select id::text from public.activity_ideas where title = 'First plan'), true);
select throws_ok($$insert into public.activity_ideas(season_year, category, title, proposed_by) values (2026, 'bar', 'Spoof plan', current_setting('test.other_id')::uuid)$$, '42501', null, 'Cannot submit author identity');
select throws_ok(format('update public.activity_ideas set %I = %s where title = %L', column_name, expression, 'First plan'), '42501', null, 'Immutable idea update denied: ' || column_name)
from (values ('id', 'gen_random_uuid()'), ('season_year', '2027'), ('proposed_by', 'current_setting(''test.other_id'')::uuid'), ('created_at', 'now()'), ('updated_at', 'now()')) as immutable(column_name, expression);
select throws_ok(format('insert into public.activity_ideas(season_year, category, title, %I) values (2026, %L, %L, %s)', column_name, 'bar', 'Generated denial', expression), '42501', null, 'Generated idea input denied: ' || column_name)
from (values ('id', 'gen_random_uuid()'), ('created_at', 'now()'), ('updated_at', 'now()')) as immutable(column_name, expression);

select throws_ok(format('insert into public.activity_ideas(season_year, category, title, description) values (%s, %L, %L, %L)', year, category, title, description), '23514', null, label)
from (values
  (2025, 'bar', 'Valid', null, 'Year below lower bound denied'),
  (2101, 'bar', 'Valid', null, 'Year above upper bound denied'),
  (2026, 'unknown', 'Valid', null, 'Unknown category denied'),
  (2026, 'BAR', 'Valid', null, 'Category is case-sensitive'),
  (2026, 'bar', '', null, 'Empty title denied'),
  (2026, 'bar', '  ab  ', null, 'Trimmed short title denied'),
  (2026, 'bar', repeat('x', 81), null, 'Long title denied'),
  (2026, 'bar', 'Valid', repeat('x', 401), 'Long description denied')
) as invalid(year, category, title, description, label);
select throws_ok('insert into public.activity_ideas(season_year, category, title) values (null, ''bar'', ''Valid'')', '23502', null, 'Null season denied');
select throws_ok('insert into public.activity_ideas(season_year, category, title) values (2026, null, ''Valid'')', '23502', null, 'Null category denied');
select throws_ok('insert into public.activity_ideas(season_year, category, title) values (2026, ''bar'', null)', '23502', null, 'Null title denied');
select lives_ok(format('insert into public.activity_ideas(season_year, category, title, description) values (2100, %L, %L, %L)', category, '  abc  ', '  ' || repeat('x', 400) || '  '), 'Exact title/description/year bounds accepted: ' || category)
from unnest(array['parrillada', 'bar', 'concierto', 'camping', 'juegos', 'excursion', 'restaurante', 'road_trip', 'cine', 'cuestionable']) as category;
select lives_ok($$insert into public.activity_ideas(season_year, category, title) values (2026, 'cine', repeat('x', 80))$$, 'Exact max title accepted');

select lives_ok($$insert into public.activity_idea_votes(idea_id, vote) values (current_setting('test.idea_id')::uuid, 'in')$$, 'Own vote defaults member identity');
select is((select member_id::text from public.activity_idea_votes), current_setting('test.author_id'), 'Vote defaults to active caller, self-voting allowed');
select is((select created_at = now() and updated_at = now() from public.activity_idea_votes), true, 'Vote timestamps generated');
select throws_ok($$insert into public.activity_idea_votes(idea_id, vote) values (current_setting('test.idea_id')::uuid, 'maybe')$$, '23505', null, 'Duplicate member/idea vote denied');
select throws_ok($$insert into public.activity_idea_votes(idea_id, member_id, vote) values (current_setting('test.idea_id')::uuid, current_setting('test.other_id')::uuid, 'pass')$$, '42501', null, 'Cannot spoof vote identity');
select throws_ok(format('update public.activity_idea_votes set %I = %s', column_name, expression), '42501', null, 'Immutable vote update denied: ' || column_name)
from (values ('idea_id', 'gen_random_uuid()'), ('member_id', 'current_setting(''test.other_id'')::uuid'), ('created_at', 'now()'), ('updated_at', 'now()')) as immutable(column_name, expression);
select throws_ok(format('insert into public.activity_idea_votes(idea_id, vote, %I) values (current_setting(''test.idea_id'')::uuid, %L, now())', column_name, 'in'), '42501', null, 'Generated vote timestamp input denied: ' || column_name)
from unnest(array['created_at', 'updated_at']) as column_name;
select throws_ok($$update public.activity_idea_votes set vote = 'unknown'$$, '23514', null, 'Unknown vote denied');
select throws_ok($$update public.activity_idea_votes set vote = null$$, '23502', null, 'Null vote denied');
select throws_ok($$insert into public.activity_idea_votes(idea_id, vote) values (gen_random_uuid(), 'in')$$, '23503', null, 'Vote idea FK enforced');
select throws_ok($$insert into public.activity_idea_votes(idea_id, vote) values (null, 'in')$$, '23502', null, 'Null idea denied');
reset role;

-- Test the RLS identity checks independently of their extra column-grant defense.
grant insert(proposed_by) on public.activity_ideas to authenticated;
grant insert(member_id) on public.activity_idea_votes to authenticated;
set local role authenticated;
select throws_ok($$insert into public.activity_ideas(season_year, category, title, proposed_by) values (2026, 'bar', 'Spoof plan', current_setting('test.other_id')::uuid)$$, '42501', null, 'Idea RLS rejects spoof even with temporary test-only column grant');
select throws_ok($$insert into public.activity_idea_votes(idea_id, member_id, vote) values (current_setting('test.idea_id')::uuid, current_setting('test.other_id')::uuid, 'in')$$, '42501', null, 'Vote RLS rejects spoof even with temporary test-only column grant');
reset role;
revoke insert(proposed_by) on public.activity_ideas from authenticated;
revoke insert(member_id) on public.activity_idea_votes from authenticated;
select throws_ok($$insert into public.activity_ideas(season_year, category, title, proposed_by) values (2026, 'bar', 'FK plan', gen_random_uuid())$$, '23503', null, 'Author FK enforced');
select throws_ok($$insert into public.activity_idea_votes(idea_id, member_id, vote) values (current_setting('test.idea_id')::uuid, gen_random_uuid(), 'in')$$, '23503', null, 'Vote member FK enforced');
select throws_ok($$delete from public.club_members where id = current_setting('test.author_id')::uuid$$, '23503', null, 'Author/voter member deletion restricted');
update public.activity_ideas set created_at = '2000-01-01', updated_at = '2000-01-01' where id = current_setting('test.idea_id')::uuid;
update public.activity_idea_votes set created_at = '2000-01-01', updated_at = '2000-01-01';
select is((select updated_at = now() from public.activity_ideas where id = current_setting('test.idea_id')::uuid), true, 'Trigger overwrites timestamp even for privileged UPDATE');
select is((select updated_at = now() from public.activity_idea_votes), true, 'Vote trigger overwrites timestamp even for privileged UPDATE');

set local role authenticated;
select lives_ok($$update public.activity_ideas set category = 'bar', title = 'Edited plan', description = 'Updated' where id = current_setting('test.idea_id')::uuid$$, 'Author may edit all three mutable columns');
select is((select updated_at = now() and created_at = '2000-01-01'::timestamptz from public.activity_ideas where id = current_setting('test.idea_id')::uuid), true, 'Idea update trigger owns timestamp and preserves created_at');
select lives_ok($$update public.activity_idea_votes set vote = 'maybe'$$, 'Own vote may change to maybe');
select is((select updated_at = now() and created_at = '2000-01-01'::timestamptz from public.activity_idea_votes), true, 'Vote update trigger owns timestamp and preserves created_at');
select lives_ok($$update public.activity_idea_votes set vote = 'pass'$$, 'Own vote may change to pass');
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is((select count(*)::integer from public.activity_ideas), 12, 'Other active member reads all ideas across valid seasons');
select is((select count(*)::integer from public.activity_idea_votes), 1, 'All active members read all votes');
with changed as (update public.activity_ideas set title = 'Stolen' where id = current_setting('test.idea_id')::uuid returning id) select is(count(*)::integer, 0, 'Non-author cannot edit') from changed;
with removed as (delete from public.activity_ideas where id = current_setting('test.idea_id')::uuid returning id) select is(count(*)::integer, 0, 'Non-author cannot delete') from removed;
with changed as (update public.activity_idea_votes set vote = 'in' returning idea_id) select is(count(*)::integer, 0, 'Non-owner cannot change vote') from changed;
with removed as (delete from public.activity_idea_votes returning idea_id) select is(count(*)::integer, 0, 'Non-owner cannot remove vote') from removed;
select lives_ok($$insert into public.activity_idea_votes(idea_id, vote) values (current_setting('test.idea_id')::uuid, 'in')$$, 'Another member has an independent own vote');
reset role;
select throws_ok($$delete from public.club_members where id = current_setting('test.other_id')::uuid$$, '23503', null, 'Vote-only member deletion is restricted');

-- Existing author/voter sessions lose all write authority immediately on revocation.
update public.club_members set is_active = false where id = current_setting('test.author_id')::uuid;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is(private.current_club_member_id(), null::uuid, 'Revoked author identity resolves NULL');
with changed as (update public.activity_ideas set title = 'Revoked edit' where id = current_setting('test.idea_id')::uuid returning id) select is(count(*)::integer, 0, 'Inactive author cannot edit own idea') from changed;
with removed as (delete from public.activity_ideas where id = current_setting('test.idea_id')::uuid returning id) select is(count(*)::integer, 0, 'Inactive author cannot delete own idea') from removed;
with changed as (update public.activity_idea_votes set vote = 'in' where member_id = current_setting('test.author_id')::uuid returning idea_id) select is(count(*)::integer, 0, 'Inactive voter cannot change own vote') from changed;
with removed as (delete from public.activity_idea_votes where member_id = current_setting('test.author_id')::uuid returning idea_id) select is(count(*)::integer, 0, 'Inactive voter cannot remove own vote') from removed;
reset role;
update public.club_members set is_active = true where id = current_setting('test.author_id')::uuid;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select is(private.is_club_admin(), true, 'Current active admin resolves');
with changed as (update public.activity_ideas set title = 'Admin edit' where id = current_setting('test.idea_id')::uuid returning id) select is(count(*)::integer, 0, 'Admin cannot edit another author') from changed;
with changed as (update public.activity_idea_votes set vote = 'maybe' returning idea_id) select is(count(*)::integer, 0, 'Admin cannot edit others votes') from changed;
with removed as (delete from public.activity_idea_votes returning idea_id) select is(count(*)::integer, 0, 'Admin cannot remove others votes') from removed;
reset role;

select set_config('request.jwt.claim.sub', subject, true) from (values ('10000000-0000-4000-8000-000000000004')) as inactive(subject);
set local role authenticated;
select is(private.current_club_member_id(), null::uuid, 'Inactive existing Auth identity resolves no member');
select is(private.is_club_admin(), false, 'Inactive admin has no admin authority');
select is((select count(*)::integer from public.club_members), 0, 'Inactive requester reads no roster');
select is((select count(*)::integer from public.activity_ideas), 0, 'Inactive requester reads no ideas');
select is((select count(*)::integer from public.activity_idea_votes), 0, 'Inactive requester reads no votes');
select throws_ok($$insert into public.activity_ideas(season_year, category, title) values (2026, 'bar', 'Inactive plan')$$, null, null, 'Inactive cannot create');
select throws_ok($$insert into public.activity_idea_votes(idea_id, vote) values (current_setting('test.idea_id')::uuid, 'in')$$, null, null, 'Inactive cannot vote');
with removed as (delete from public.activity_ideas returning id) select is(count(*)::integer, 0, 'Inactive admin cannot delete') from removed;
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000099', true);
set local role authenticated;
select is(private.current_club_member_id(), null::uuid, 'Nonmember resolves no member');
select is(private.is_club_admin(), false, 'Nonmember has no admin authority');
select is((select count(*)::integer from public.club_members), 0, 'Nonmember reads no roster');
select is((select count(*)::integer from public.activity_ideas), 0, 'Nonmember reads no ideas');
select is((select count(*)::integer from public.activity_idea_votes), 0, 'Nonmember reads no votes');
select throws_ok($$insert into public.activity_ideas(season_year, category, title) values (2026, 'bar', 'Nonmember plan')$$, null, null, 'Nonmember cannot create');
select throws_ok($$insert into public.activity_idea_votes(idea_id, vote) values (current_setting('test.idea_id')::uuid, 'in')$$, null, null, 'Nonmember cannot vote');
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select is(private.current_club_member_id(), null::uuid, 'Missing auth.uid resolves no identity');
select is(private.is_club_admin(), false, 'Missing auth.uid cannot be admin');
select is((select count(*)::integer from public.club_members), 0, 'Missing auth.uid cannot enumerate roster');
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
with removed as (delete from public.activity_idea_votes where member_id = current_setting('test.author_id')::uuid returning idea_id) select is(count(*)::integer, 1, 'Own vote removable') from removed;
select is((select count(*)::integer from public.activity_idea_votes), 1, 'Removing own vote preserves other vote');
select lives_ok($$insert into public.activity_idea_votes(idea_id, vote) values (current_setting('test.idea_id')::uuid, 'in')$$, 'Vote can be recreated after removal');
with removed as (delete from public.activity_ideas where id = current_setting('test.idea_id')::uuid returning id) select is(count(*)::integer, 1, 'Author may delete own idea') from removed;
select is((select count(*)::integer from public.activity_idea_votes), 0, 'Idea deletion cascades all votes');
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
with removed as (delete from public.activity_ideas where title = repeat('x', 80) returning id) select is(count(*)::integer, 1, 'Active admin may delete another author') from removed;
reset role;

-- JavaScript trim() parity must hold for direct INSERT and author UPDATE too.
-- This block runs after existing assertions so even a RED cannot change their fixtures.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into public.activity_ideas(season_year, category, title)
values (2026, 'cine', 'Whitespace probe');
select set_config(
  'test.whitespace_idea_id',
  (select id::text from public.activity_ideas where title = 'Whitespace probe'),
  true
);

with whitespace(character, label) as (
  values
    (U&'\0009', 'U+0009 TAB'),
    (U&'\000A', 'U+000A LF'),
    (U&'\000B', 'U+000B VT'),
    (U&'\000C', 'U+000C FF'),
    (U&'\000D', 'U+000D CR'),
    (U&'\0020', 'U+0020 SPACE'),
    (U&'\00A0', 'U+00A0 NBSP'),
    (U&'\1680', 'U+1680 OGHAM SPACE'),
    (U&'\2000', 'U+2000 EN QUAD'),
    (U&'\2001', 'U+2001 EM QUAD'),
    (U&'\2002', 'U+2002 EN SPACE'),
    (U&'\2003', 'U+2003 EM SPACE'),
    (U&'\2004', 'U+2004 THREE-PER-EM SPACE'),
    (U&'\2005', 'U+2005 FOUR-PER-EM SPACE'),
    (U&'\2006', 'U+2006 SIX-PER-EM SPACE'),
    (U&'\2007', 'U+2007 FIGURE SPACE'),
    (U&'\2008', 'U+2008 PUNCTUATION SPACE'),
    (U&'\2009', 'U+2009 THIN SPACE'),
    (U&'\200A', 'U+200A HAIR SPACE'),
    (U&'\2028', 'U+2028 LINE SEPARATOR'),
    (U&'\2029', 'U+2029 PARAGRAPH SEPARATOR'),
    (U&'\202F', 'U+202F NARROW NBSP'),
    (U&'\205F', 'U+205F MEDIUM MATHEMATICAL SPACE'),
    (U&'\3000', 'U+3000 IDEOGRAPHIC SPACE'),
    (U&'\FEFF', 'U+FEFF BOM')
), scenarios(operation) as (
  values ('blank INSERT'), ('blank author UPDATE'),
         ('max title INSERT'), ('max title author UPDATE'),
         ('max description INSERT'), ('max description author UPDATE')
)
select case operation
  when 'blank INSERT' then throws_ok(
    format(
      'insert into public.activity_ideas(season_year, category, title) values (2026, ''cine'', %L)',
      repeat(character, 3)
    ),
    '23514', null, label || ': whitespace-only title denied on INSERT'
  )
  when 'blank author UPDATE' then throws_ok(
    format(
      'update public.activity_ideas set title = %L where id = %L::uuid',
      repeat(character, 3), current_setting('test.whitespace_idea_id')
    ),
    '23514', null, label || ': whitespace-only title denied on author UPDATE'
  )
  when 'max title INSERT' then lives_ok(
    format(
      'insert into public.activity_ideas(season_year, category, title) values (2026, ''cine'', %L)',
      character || repeat('x', 80) || character
    ),
    label || ': padding around 80-character title accepted on INSERT'
  )
  when 'max title author UPDATE' then lives_ok(
    format(
      'update public.activity_ideas set title = %L where id = %L::uuid',
      character || repeat('x', 80) || character, current_setting('test.whitespace_idea_id')
    ),
    label || ': padding around 80-character title accepted on author UPDATE'
  )
  when 'max description INSERT' then lives_ok(
    format(
      'insert into public.activity_ideas(season_year, category, title, description) values (2026, ''cine'', ''Description boundary'', %L)',
      character || repeat('x', 400) || character
    ),
    label || ': padding around 400-character description accepted on INSERT'
  )
  when 'max description author UPDATE' then lives_ok(
    format(
      'update public.activity_ideas set description = %L where id = %L::uuid',
      character || repeat('x', 400) || character, current_setting('test.whitespace_idea_id')
    ),
    label || ': padding around 400-character description accepted on author UPDATE'
  )
end
from whitespace cross join scenarios
order by label, operation;

do $$ begin
  perform set_config(
    'test.js_trim_chars',
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',
    true
  );
end $$;
select throws_ok(
  format(
    'insert into public.activity_ideas(season_year, category, title) values (2026, ''cine'', %L)',
    current_setting('test.js_trim_chars') || 'ab' || current_setting('test.js_trim_chars')
  ),
  '23514', null, 'Mixed JS whitespace cannot inflate a short title on INSERT'
);
select throws_ok(
  format(
    'update public.activity_ideas set title = %L where id = %L::uuid',
    current_setting('test.js_trim_chars') || 'ab' || current_setting('test.js_trim_chars'),
    current_setting('test.whitespace_idea_id')
  ),
  '23514', null, 'Mixed JS whitespace cannot inflate a short title on author UPDATE'
);
select throws_ok(
  format(
    'insert into public.activity_ideas(season_year, category, title) values (2026, ''cine'', %L)',
    current_setting('test.js_trim_chars') || repeat('x', 81) || current_setting('test.js_trim_chars')
  ),
  '23514', null, 'Trimmed title over 80 still denied on INSERT'
);
select throws_ok(
  format(
    'update public.activity_ideas set title = %L where id = %L::uuid',
    current_setting('test.js_trim_chars') || repeat('x', 81) || current_setting('test.js_trim_chars'),
    current_setting('test.whitespace_idea_id')
  ),
  '23514', null, 'Trimmed title over 80 still denied on author UPDATE'
);
select throws_ok(
  format(
    'insert into public.activity_ideas(season_year, category, title, description) values (2026, ''cine'', ''Description boundary'', %L)',
    current_setting('test.js_trim_chars') || repeat('x', 401) || current_setting('test.js_trim_chars')
  ),
  '23514', null, 'Trimmed description over 400 still denied on INSERT'
);
select throws_ok(
  format(
    'update public.activity_ideas set description = %L where id = %L::uuid',
    current_setting('test.js_trim_chars') || repeat('x', 401) || current_setting('test.js_trim_chars'),
    current_setting('test.whitespace_idea_id')
  ),
  '23514', null, 'Trimmed description over 400 still denied on author UPDATE'
);

select throws_ok(
  format(
    'insert into public.activity_ideas(season_year, category, title) values (2026, ''cine'', %L)',
    repeat('x', 79) || U&'\0009' || 'x'
  ),
  '23514', null, 'Internal TAB counts toward the title limit on INSERT'
);
select throws_ok(
  format(
    'update public.activity_ideas set title = %L where id = %L::uuid',
    repeat('x', 79) || U&'\0009' || 'x', current_setting('test.whitespace_idea_id')
  ),
  '23514', null, 'Internal TAB counts toward the title limit on author UPDATE'
);
select throws_ok(
  format(
    'insert into public.activity_ideas(season_year, category, title, description) values (2026, ''cine'', ''Description boundary'', %L)',
    repeat('x', 399) || U&'\00A0' || 'x'
  ),
  '23514', null, 'Internal NBSP counts toward the description limit on INSERT'
);
select throws_ok(
  format(
    'update public.activity_ideas set description = %L where id = %L::uuid',
    repeat('x', 399) || U&'\00A0' || 'x', current_setting('test.whitespace_idea_id')
  ),
  '23514', null, 'Internal NBSP counts toward the description limit on author UPDATE'
);

-- These Unicode characters are deliberately NOT whitespace in JavaScript trim().
with non_trimmed(character, label) as (
  values (U&'\0085', 'U+0085 NEL'),
         (U&'\180E', 'U+180E MONGOLIAN VOWEL SEPARATOR'),
         (U&'\200B', 'U+200B ZERO WIDTH SPACE')
)
select lives_ok(
  case operation
    when 'INSERT' then format(
      'insert into public.activity_ideas(season_year, category, title) values (2026, ''cine'', %L)',
      repeat(character, 3)
    )
    else format(
      'update public.activity_ideas set title = %L where id = %L::uuid',
      repeat(character, 3), current_setting('test.whitespace_idea_id')
    )
  end,
  label || ': non-JS whitespace remains title content on ' || operation
)
from non_trimmed cross join (values ('INSERT'), ('author UPDATE')) as scenarios(operation)
order by label, operation;

select lives_ok(
  format(
    'insert into public.activity_ideas(season_year, category, title, description) values (2026, ''cine'', %L, %L)',
    current_setting('test.js_trim_chars') || repeat(U&'\+01F3AC', 80) || current_setting('test.js_trim_chars'),
    current_setting('test.js_trim_chars') || repeat(U&'\+01F3AC', 400) || current_setting('test.js_trim_chars')
  ),
  'Mixed whitespace padding preserves supplementary Unicode code-point length boundaries'
);
select lives_ok(
  format(
    'update public.activity_ideas set description = null where id = %L::uuid',
    current_setting('test.whitespace_idea_id')
  ),
  'Optional description still accepts NULL on author UPDATE'
);
select is(
  (select description from public.activity_ideas where id = current_setting('test.whitespace_idea_id')::uuid),
  null::text, 'NULL description is preserved without a normalization helper'
);
reset role;

select * from finish();
rollback;
