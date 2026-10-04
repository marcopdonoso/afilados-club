begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_table('public', 'season_activities', 'Calendar table exists');
select is((select count(*)::integer from public.season_activities), 0, 'No activities seeded');
select is((select relrowsecurity from pg_class where oid = 'public.season_activities'::regclass), true, 'Calendar RLS enabled');
select col_type_is('public', 'season_activities', 'id', 'uuid', 'UUID identity');
select col_is_pk('public', 'season_activities', 'id', 'Activity primary key');
select col_type_is('public', 'season_activities', 'season_year', 'smallint', 'Season dimension');
select col_type_is('public', 'season_activities', 'start_time', 'time without time zone', 'Local time, not timezone per activity');
select col_not_null('public', 'season_activities', column_name, 'Required activity column ' || column_name)
from unnest(array['id', 'season_year', 'created_by', 'status', 'category', 'title', 'start_date', 'end_date', 'created_at', 'updated_at']) as column_name;
select col_has_default('public', 'season_activities', column_name, 'Generated/defaulted activity column ' || column_name)
from unnest(array['id', 'season_year', 'created_by', 'status', 'created_at', 'updated_at']) as column_name;

select ok(not has_table_privilege(role_name, 'public.season_activities', 'SELECT,INSERT,UPDATE'), 'No broad calendar grants for ' || role_name)
from unnest(array['anon', 'authenticated']) as role_name;
select ok(not has_any_column_privilege('anon', 'public.season_activities', 'SELECT,INSERT,UPDATE'), 'Anonymous has no column grants');
select ok(has_table_privilege('authenticated', 'public.season_activities', 'DELETE'), 'Delete grant is RLS controlled');
select ok(has_column_privilege('authenticated', 'public.season_activities', column_name, 'SELECT'), 'App reads ' || column_name)
from unnest(array['id', 'season_year', 'source_idea_id', 'created_by', 'status', 'category', 'title', 'description', 'start_date', 'end_date', 'start_time', 'end_time', 'created_at']) as column_name;
select ok(not has_column_privilege('authenticated', 'public.season_activities', 'updated_at', 'SELECT'), 'Unused timestamp not exposed');
select ok(has_column_privilege('authenticated', 'public.season_activities', column_name, 'INSERT'), 'App inserts ' || column_name)
from unnest(array['source_idea_id', 'status', 'category', 'title', 'description', 'start_date', 'end_date', 'start_time', 'end_time']) as column_name;
select ok(has_column_privilege('authenticated', 'public.season_activities', column_name, 'UPDATE'), 'App updates ' || column_name)
from unnest(array['status', 'category', 'title', 'description', 'start_date', 'end_date', 'start_time', 'end_time']) as column_name;
select ok(not has_column_privilege('authenticated', 'public.season_activities', column_name, 'INSERT,UPDATE'), 'Identity/year/time grants immutable ' || column_name)
from unnest(array['id', 'season_year', 'created_by', 'created_at', 'updated_at']) as column_name;
select ok(not has_column_privilege('authenticated', 'public.season_activities', 'source_idea_id', 'UPDATE'), 'Source immutable to clients');
select is((select count(*)::integer from pg_class as c cross join lateral aclexplode(c.relacl) as acl where c.oid = 'public.season_activities'::regclass and acl.grantee = 0), 0, 'No inherited PUBLIC privileges');
select has_function('private', 'check_activity_source_season', array[]::text[], 'Source helper is private');
select is((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'private.check_activity_source_season()'::regprocedure), true, 'Source definer has empty search path');
select ok(not has_function_privilege(role_name, 'private.check_activity_source_season()', 'EXECUTE'), 'No direct helper execution for ' || role_name)
from unnest(array['anon', 'authenticated', 'service_role', 'supabase_auth_admin']) as role_name;
select is((select count(*)::integer from pg_proc as p cross join lateral aclexplode(p.proacl) as acl where p.oid = 'private.check_activity_source_season()'::regprocedure and acl.grantee = 0), 0, 'No PUBLIC helper execution');

-- Fictitious identities only; all admission, Auth, grants and data roll back.
with fixtures(display_name, role, email) as (
  values ('Calendar creator', 'member', 'calendar-creator@example.test'),
         ('Calendar other', 'member', 'calendar-other@example.test'),
         ('Calendar admin', 'admin', 'calendar-admin@example.test'),
         ('Calendar inactive', 'admin', 'calendar-inactive@example.test')
), inserted as (
  insert into public.club_members(display_name, role)
  select display_name, role from fixtures returning id, display_name
)
insert into public.club_member_access(member_id, email_sha256)
select inserted.id, encode(extensions.digest(fixtures.email, 'sha256'), 'hex')
from inserted join fixtures using (display_name);
insert into auth.users(id, email, raw_app_meta_data) values
  ('20000000-0000-4000-8000-000000000001', 'calendar-creator@example.test', '{"provider":"google"}'),
  ('20000000-0000-4000-8000-000000000002', 'calendar-other@example.test', '{"provider":"google"}'),
  ('20000000-0000-4000-8000-000000000003', 'calendar-admin@example.test', '{"provider":"google"}'),
  ('20000000-0000-4000-8000-000000000004', 'calendar-inactive@example.test', '{"provider":"google"}');
update public.club_members set is_active = false where display_name = 'Calendar inactive';
select set_config('test.creator_id', (select id::text from public.club_members where display_name = 'Calendar creator'), true);
select set_config('test.other_id', (select id::text from public.club_members where display_name = 'Calendar other'), true);

set local role anon;
select throws_ok('select id from public.season_activities', '42501', null, 'Anonymous read denied');
select throws_ok($$insert into public.season_activities(category, title, start_date, end_date) values ('bar', 'No entry', '2026-11-28', '2026-11-28')$$, '42501', null, 'Anonymous create denied');
reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok($$insert into public.activity_ideas(season_year, category, title, description) values (2026, 'camping', 'Source original', 'Original idea snapshot')$$, 'Idea fixture created');
select set_config('test.source_id', (select id::text from public.activity_ideas where title = 'Source original'), true);
select lives_ok($$insert into public.activity_ideas(season_year, category, title) values (2027, 'bar', 'Wrong season')$$, 'Another season idea fixture created');
select lives_ok($$insert into public.activity_ideas(season_year, category, title) values (2026, 'bar', 'Cross-member idea')$$, 'Another idea fixture for cross-member scheduling');
select set_config('test.cross_source_id', (select id::text from public.activity_ideas where title = 'Cross-member idea'), true);
select set_config('test.wrong_source_id', (select id::text from public.activity_ideas where title = 'Wrong season'), true);
select lives_ok($$insert into public.activity_idea_votes(idea_id, vote) values (current_setting('test.source_id')::uuid, 'in')$$, 'Source has an independent vote');
select lives_ok($$insert into public.season_activities(source_idea_id, category, title, description, start_date, end_date) values (current_setting('test.source_id')::uuid, 'camping', 'Activity snapshot', 'Independent description', '2026-12-05', '2026-12-06')$$, 'Create uses default identity, ID, season, status and timestamps');
select set_config('test.activity_id', (select id::text from public.season_activities where title = 'Activity snapshot'), true);
select is((select created_by::text from public.season_activities where id = current_setting('test.activity_id')::uuid), current_setting('test.creator_id'), 'Creator auto-attributed');
select is((select season_year::integer from public.season_activities where id = current_setting('test.activity_id')::uuid), 2026, 'Season auto-attributed');
select is((select status from public.season_activities where id = current_setting('test.activity_id')::uuid), 'tentative', 'Default tentative');
select throws_ok($$insert into public.season_activities(created_by, category, title, start_date, end_date) values (current_setting('test.other_id')::uuid, 'bar', 'Spoof', '2026-11-28', '2026-11-28')$$, '42501', null, 'Creator input denied');
select throws_ok(format('update public.season_activities set %I = %s where id = current_setting(''test.activity_id'')::uuid', column_name, expression), '42501', null, 'Immutable update denied ' || column_name)
from (values ('id', 'gen_random_uuid()'), ('season_year', '2027'), ('source_idea_id', 'null'), ('created_by', 'current_setting(''test.other_id'')::uuid'), ('created_at', 'now()'), ('updated_at', 'now()')) as immutable(column_name, expression);
select throws_ok(format('insert into public.season_activities(category, title, start_date, end_date, %I) values (''bar'', ''Spoof'', ''2026-11-28'', ''2026-11-28'', %s)', column_name, expression), '42501', null, 'Immutable insert denied ' || column_name)
from (values ('id', 'gen_random_uuid()'), ('season_year', '2027'), ('created_at', 'now()'), ('updated_at', 'now()')) as immutable(column_name, expression);
select throws_ok($$insert into public.season_activities(source_idea_id, category, title, start_date, end_date) values (current_setting('test.source_id')::uuid, 'camping', 'Duplicate promotion', '2026-12-05', '2026-12-05')$$, '23505', null, 'Unique source forbids duplicate promotion/race');
select throws_ok($$insert into public.season_activities(source_idea_id, category, title, start_date, end_date) values (current_setting('test.wrong_source_id')::uuid, 'bar', 'Wrong provenance', '2026-12-05', '2026-12-05')$$, '23514', null, 'Source must match activity season');
select throws_ok($$insert into public.season_activities(source_idea_id, category, title, start_date, end_date) values (gen_random_uuid(), 'bar', 'Missing source', '2026-12-05', '2026-12-05')$$, '23503', null, 'Source must exist');

select throws_ok(format('insert into public.season_activities(category, title, description, status, start_date, end_date, start_time, end_time) values (%L, %L, %L, %L, %L, %L, %L, %L)', category, title, description, status, start_date, end_date, start_time, end_time), '23514', null, label)
from (values
  ('other', 'Valid', null, 'tentative', '2026-11-28', '2026-11-28', null, null, 'Unknown category denied'),
  ('BAR', 'Valid', null, 'tentative', '2026-11-28', '2026-11-28', null, null, 'Category case-sensitive'),
  ('bar', 'Valid', null, 'other', '2026-11-28', '2026-11-28', null, null, 'Unknown status denied'),
  ('bar', '  ab  ', null, 'tentative', '2026-11-28', '2026-11-28', null, null, 'Trimmed short title denied'),
  ('bar', repeat('x', 81), null, 'tentative', '2026-11-28', '2026-11-28', null, null, 'Long title denied'),
  ('bar', 'Valid', repeat('x', 401), 'tentative', '2026-11-28', '2026-11-28', null, null, 'Long description denied'),
  ('bar', 'Valid', null, 'tentative', '2026-11-27', '2026-11-28', null, null, 'Start before opening date denied'),
  ('bar', 'Valid', null, 'tentative', '2026-12-21', '2026-12-21', '01:00', '07:25', 'December 21 start denied'),
  ('bar', 'Valid', null, 'tentative', '2026-11-29', '2026-11-28', null, null, 'End before start denied'),
  ('bar', 'Valid', null, 'tentative', '2026-12-20', '2026-12-22', '22:00', '07:25', 'End beyond closing date denied'),
  ('bar', 'Valid', null, 'tentative', '2026-12-20', '2026-12-21', '22:00', '09:00', 'Departure 09:00 end denied'),
  ('bar', 'Valid', null, 'tentative', '2026-12-20', '2026-12-21', null, null, 'All-day departure denied'),
  ('bar', 'Valid', null, 'tentative', '2026-12-20', '2026-12-21', '22:00', null, 'Departure requires explicit end time'),
  ('bar', 'Valid', null, 'tentative', '2026-11-28', '2026-11-28', null, '12:00', 'End time without start denied'),
  ('bar', 'Valid', null, 'tentative', '2026-11-28', '2026-11-28', '12:00', '12:00', 'Same-day equal times denied'),
  ('bar', 'Valid', null, 'tentative', '2026-11-28', '2026-11-28', '22:00', '02:00', 'Same-day backwards times denied'),
  ('bar', 'Valid', null, 'tentative', '2026-11-28', '2026-11-29', '24:00', null, '24:00 start denied')
) as invalid(category, title, description, status, start_date, end_date, start_time, end_time, label);
select throws_ok(format('insert into public.season_activities(category, title, start_date, end_date, %I) values (''bar'', ''Valid'', ''2026-11-28'', ''2026-11-28'', null)', column_name), '23502', null, 'Null required status denied')
from unnest(array['status']) as column_name;
select throws_ok($$insert into public.season_activities(category, title, start_date, end_date) values (null, 'Valid', '2026-11-28', '2026-11-28')$$, '23502', null, 'Null category denied');
select throws_ok($$insert into public.season_activities(category, title, start_date, end_date) values ('bar', null, '2026-11-28', '2026-11-28')$$, '23502', null, 'Null title denied');
select throws_ok($$insert into public.season_activities(category, title, start_date, end_date) values ('bar', 'Valid', null, '2026-11-28')$$, '23502', null, 'Null start denied');
select throws_ok($$insert into public.season_activities(category, title, start_date, end_date) values ('bar', 'Valid', '2026-11-28', null)$$, '23502', null, 'Null end denied');
select lives_ok(format('insert into public.season_activities(category, title, description, start_date, end_date) values (%L, %L, %L, ''2026-11-28'', ''2026-11-28'')', category, '  abc  ', '  ' || repeat('x', 400) || '  '), 'Valid category and trimmed content limits ' || category)
from unnest(array['parrillada', 'bar', 'concierto', 'camping', 'juegos', 'excursion', 'restaurante', 'road_trip', 'cine', 'cuestionable']) as category;
select lives_ok(format('insert into public.season_activities(category, title, status, start_date, end_date) values (''cine'', %L, %L, ''2026-12-20'', ''2026-12-20'')', repeat('x', 80), status), 'Exact max title and valid DB status ' || status)
from unnest(array['tentative', 'confirmed', 'cancelled']) as status;
select lives_ok(format('insert into public.season_activities(category, title, start_date, end_date, start_time, end_time) values (''camping'', ''Departure probe'', ''2026-12-20'', ''2026-12-21'', ''22:00'', %L)', end_time), 'Departure end accepted ' || end_time)
from unnest(array['07:24', '07:25']) as end_time;
select lives_ok($$insert into public.season_activities(category, title, start_date, end_date, start_time, end_time) values ('bar', 'Overnight probe', '2026-11-28', '2026-11-29', '22:00', '02:00')$$, 'Overnight end earlier than start is valid');
select lives_ok($$insert into public.season_activities(category, title, start_date, end_date, start_time) values ('bar', 'Start-only probe', '2026-11-28', '2026-11-28', '18:00')$$, 'Start-only valid');
select lives_ok($$insert into public.season_activities(category, title, start_date, end_date, start_time, end_time) values ('bar', 'Same-day probe', '2026-11-28', '2026-11-28', '18:00', '20:00')$$, 'Same-day valid');

-- The same ECMAScript trim set as the applied idea migration, with Unicode lengths.
select throws_ok(format('insert into public.season_activities(category, title, start_date, end_date) values (''bar'', %L, ''2026-11-28'', ''2026-11-28'')', repeat(character, 3)), '23514', null, 'JS whitespace cannot inflate title: ' || label)
from (values (U&'\0009', 'TAB'), (U&'\00A0', 'NBSP'), (U&'\FEFF', 'BOM'), (U&'\2028', 'LINE SEPARATOR')) as whitespace(character, label);
select lives_ok(format('insert into public.season_activities(category, title, description, start_date, end_date) values (''bar'', %L, %L, ''2026-11-28'', ''2026-11-28'')', U&'\00A0' || repeat(U&'\+01F3AC', 80) || U&'\FEFF', U&'\0009' || repeat(U&'\+01F3AC', 400)), 'Trimmed Unicode code-point boundaries accepted');
select throws_ok(format('update public.season_activities set title = %L where id = current_setting(''test.activity_id'')::uuid', U&'\00A0ab\FEFF'), '23514', null, 'Update respects trimmed title limits');
select throws_ok($$update public.season_activities set description = repeat('x', 401) where id = current_setting('test.activity_id')::uuid$$, '23514', null, 'Update respects description limits');
reset role;

select is((select created_at = now() and updated_at = now() from public.season_activities where id = current_setting('test.activity_id')::uuid), true, 'Default creation timestamps');
grant insert(created_by) on public.season_activities to authenticated;
set local role authenticated;
select throws_ok($$insert into public.season_activities(created_by, category, title, start_date, end_date) values (current_setting('test.other_id')::uuid, 'bar', 'Spoof', '2026-11-28', '2026-11-28')$$, '42501', null, 'RLS rejects spoof independent of column grants');
reset role;
revoke insert(created_by) on public.season_activities from authenticated;
select throws_ok($$delete from public.club_members where id = current_setting('test.creator_id')::uuid$$, '23503', null, 'Creator deletion restricted');
update public.season_activities set created_at = '2000-01-01', updated_at = '2000-01-01' where id = current_setting('test.activity_id')::uuid;
select is((select updated_at = now() from public.season_activities where id = current_setting('test.activity_id')::uuid), true, 'Existing touch_updated_at helper reused');
set local role authenticated;
select lives_ok($$update public.season_activities set status = 'cancelled', category = 'bar', title = 'Cancelled snapshot', description = null, start_date = '2026-12-07', end_date = '2026-12-07', start_time = '18:00', end_time = '20:00' where id = current_setting('test.activity_id')::uuid$$, 'Creator edits all permitted columns and cancels');
select is((select source_idea_id::text from public.season_activities where id = current_setting('test.activity_id')::uuid), current_setting('test.source_id'), 'Cancellation retains source');
select is((select count(*)::integer from public.activity_idea_votes where idea_id = current_setting('test.source_id')::uuid), 1, 'Cancellation retains votes');
select is((select title from public.activity_ideas where id = current_setting('test.source_id')::uuid), 'Source original', 'Activity edit does not sync idea');
select lives_ok($$update public.activity_ideas set title = 'Edited idea', description = 'Changed independently' where id = current_setting('test.source_id')::uuid$$, 'Idea independently editable');
select is((select title from public.season_activities where id = current_setting('test.activity_id')::uuid), 'Cancelled snapshot', 'Idea edit does not sync activity');
select lives_ok($$update public.season_activities set status = 'confirmed' where id = current_setting('test.activity_id')::uuid$$, 'Creator can reinstate');
reset role;
select is((select created_at = '2000-01-01'::timestamptz and updated_at = now() from public.season_activities where id = current_setting('test.activity_id')::uuid), true, 'Mutations preserve created_at and touch updated_at');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is((select count(id)::integer from public.season_activities where id = current_setting('test.activity_id')::uuid), 1, 'Other active member reads activity');
with changed as (update public.season_activities set title = 'Stolen' where id = current_setting('test.activity_id')::uuid returning id) select is(count(*)::integer, 0, 'Other member cannot update') from changed;
with removed as (delete from public.season_activities where id = current_setting('test.activity_id')::uuid returning id) select is(count(*)::integer, 0, 'Other member cannot delete') from removed;
select lives_ok($$insert into public.season_activities(category, title, start_date, end_date) values ('cine', 'Other creator', '2026-12-05', '2026-12-05')$$, 'Other active member creates own activity');
select lives_ok($$insert into public.season_activities(source_idea_id, category, title, start_date, end_date) values (current_setting('test.cross_source_id')::uuid, 'bar', 'Cross-member promotion', '2026-12-05', '2026-12-05')$$, 'Any active member can promote another author without a vote threshold');
reset role;
select throws_ok($$delete from public.club_members where id = current_setting('test.other_id')::uuid$$, '23503', null, 'Activity-only creator FK restricts member deletion');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select is((select count(id)::integer from public.season_activities), 0, 'Inactive cannot read');
select throws_ok($$insert into public.season_activities(category, title, start_date, end_date) values ('bar', 'Inactive entry', '2026-11-28', '2026-11-28')$$, null, null, 'Inactive cannot create');
with changed as (update public.season_activities set title = 'Revoked' returning id) select is(count(*)::integer, 0, 'Inactive admin cannot update') from changed;
with removed as (delete from public.season_activities returning id) select is(count(*)::integer, 0, 'Inactive admin cannot delete') from removed;
reset role;
update public.club_members set is_active = false where id = current_setting('test.creator_id')::uuid;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is((select count(id)::integer from public.season_activities), 0, 'Revoked creator loses reads immediately');
with changed as (update public.season_activities set title = 'Revoked own' where id = current_setting('test.activity_id')::uuid returning id) select is(count(*)::integer, 0, 'Revoked creator cannot update') from changed;
with removed as (delete from public.season_activities where id = current_setting('test.activity_id')::uuid returning id) select is(count(*)::integer, 0, 'Revoked creator cannot delete') from removed;
reset role;
update public.club_members set is_active = true where id = current_setting('test.creator_id')::uuid;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
set local role authenticated;
with changed as (update public.season_activities set title = 'Admin snapshot', status = 'tentative' where id = current_setting('test.activity_id')::uuid returning id) select is(count(*)::integer, 1, 'Active admin can update another creator') from changed;
with removed as (delete from public.season_activities where title = 'Other creator' returning id) select is(count(*)::integer, 1, 'Active admin can delete another creator') from removed;
reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
set local role authenticated;
with removed as (delete from public.season_activities where id = current_setting('test.activity_id')::uuid returning id) select is(count(*)::integer, 1, 'Creator can delete own activity') from removed;
select is((select count(*)::integer from public.activity_ideas where id = current_setting('test.source_id')::uuid), 1, 'Deleting activity preserves source idea');
select is((select count(*)::integer from public.activity_idea_votes where idea_id = current_setting('test.source_id')::uuid), 1, 'Deleting activity preserves votes');
select lives_ok($$insert into public.season_activities(source_idea_id, category, title, description, start_date, end_date) values (current_setting('test.source_id')::uuid, 'camping', 'Final snapshot', 'Retained description', '2026-12-05', '2026-12-06')$$, 'Deleting activity frees idea for promotion');
select set_config('test.final_id', (select id::text from public.season_activities where title = 'Final snapshot'), true);
select lives_ok($$delete from public.activity_ideas where id = current_setting('test.source_id')::uuid$$, 'Idea deletion allowed with immutable activity source grant');
select is((select source_idea_id from public.season_activities where id = current_setting('test.final_id')::uuid), null::uuid, 'Idea deletion sets source NULL');
select is((select title || '|' || description || '|' || category || '|' || start_date::text || '|' || end_date::text from public.season_activities where id = current_setting('test.final_id')::uuid), 'Final snapshot|Retained description|camping|2026-12-05|2026-12-06', 'Idea deletion preserves activity content/date snapshot');
reset role;

select * from finish();
rollback;
