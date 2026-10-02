-- Helpers are not Data API RPCs. Definers avoid recursive roster RLS.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

create function private.current_club_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.id from public.club_members as member
  where member.auth_user_id = (select auth.uid()) and member.is_active;
$$;

create function private.is_club_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members as member
    where member.auth_user_id = (select auth.uid())
      and member.is_active and member.role = 'admin'
  );
$$;

revoke all on function private.current_club_member_id()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function private.is_club_admin()
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.current_club_member_id() to authenticated;
grant execute on function private.is_club_admin() to authenticated;

drop policy club_members_select_own_active on public.club_members;
create policy club_members_select_active_roster
  on public.club_members for select to authenticated
  using (is_active and (select private.current_club_member_id()) is not null);

create table public.activity_ideas (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  season_year smallint not null check (season_year between 2026 and 2100),
  proposed_by uuid not null default private.current_club_member_id()
    references public.club_members(id) on delete restrict,
  category text not null check (category in (
    'parrillada', 'bar', 'concierto', 'camping', 'juegos', 'excursion',
    'restaurante', 'road_trip', 'cine', 'cuestionable'
  )),
  -- Match JavaScript trim(): ECMAScript WhiteSpace and LineTerminator characters.
  -- An explicit set avoids ASCII-only btrim defaults and locale-dependent regexes.
  title text not null check (
    pg_catalog.char_length(pg_catalog.btrim(
      title,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    )) between 3 and 80
  ),
  description text check (
    pg_catalog.char_length(pg_catalog.btrim(
      description,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    )) <= 400
  ),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.activity_idea_votes (
  idea_id uuid not null references public.activity_ideas(id) on delete cascade,
  member_id uuid not null default private.current_club_member_id()
    references public.club_members(id) on delete restrict,
  vote text not null check (vote in ('in', 'maybe', 'pass')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (idea_id, member_id)
);

create index activity_ideas_season_year_idx on public.activity_ideas(season_year);
create index activity_ideas_proposed_by_idx on public.activity_ideas(proposed_by);
create index activity_idea_votes_member_id_idx on public.activity_idea_votes(member_id);

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at()
  from public, anon, authenticated, service_role, supabase_auth_admin;

create trigger activity_ideas_updated_at
  before update on public.activity_ideas
  for each row execute function private.touch_updated_at();
create trigger activity_idea_votes_updated_at
  before update on public.activity_idea_votes
  for each row execute function private.touch_updated_at();

alter table public.activity_ideas enable row level security;
alter table public.activity_idea_votes enable row level security;

-- Remove inherited Supabase defaults before granting only mutable input columns.
revoke all on table public.activity_ideas from public, anon, authenticated;
revoke all on table public.activity_idea_votes from public, anon, authenticated;
grant select, delete on table public.activity_ideas to authenticated;
grant insert (season_year, category, title, description) on public.activity_ideas to authenticated;
grant update (category, title, description) on public.activity_ideas to authenticated;
grant select, delete on table public.activity_idea_votes to authenticated;
grant insert (idea_id, vote) on public.activity_idea_votes to authenticated;
grant update (vote) on public.activity_idea_votes to authenticated;

create policy activity_ideas_select_active on public.activity_ideas
  for select to authenticated
  using ((select private.current_club_member_id()) is not null);
create policy activity_ideas_insert_own on public.activity_ideas
  for insert to authenticated
  with check (proposed_by = (select private.current_club_member_id()));
create policy activity_ideas_update_own on public.activity_ideas
  for update to authenticated
  using (proposed_by = (select private.current_club_member_id()))
  with check (proposed_by = (select private.current_club_member_id()));
create policy activity_ideas_delete_author_admin on public.activity_ideas
  for delete to authenticated
  using (proposed_by = (select private.current_club_member_id()) or (select private.is_club_admin()));

create policy activity_idea_votes_select_active on public.activity_idea_votes
  for select to authenticated
  using ((select private.current_club_member_id()) is not null);
create policy activity_idea_votes_insert_own on public.activity_idea_votes
  for insert to authenticated
  with check (member_id = (select private.current_club_member_id()));
create policy activity_idea_votes_update_own on public.activity_idea_votes
  for update to authenticated
  using (member_id = (select private.current_club_member_id()))
  with check (member_id = (select private.current_club_member_id()));
create policy activity_idea_votes_delete_own on public.activity_idea_votes
  for delete to authenticated
  using (member_id = (select private.current_club_member_id()));
