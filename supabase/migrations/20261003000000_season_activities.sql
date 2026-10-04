-- Season 2026 planning dates exclude departure, which ends at 07:25 in La Paz.
create table public.season_activities (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  season_year smallint not null default 2026 check (season_year = 2026),
  source_idea_id uuid unique references public.activity_ideas(id) on delete set null,
  created_by uuid not null default private.current_club_member_id()
    references public.club_members(id) on delete restrict,
  status text not null default 'tentative'
    check (status in ('tentative', 'confirmed', 'cancelled')),
  category text not null check (category in (
    'parrillada', 'bar', 'concierto', 'camping', 'juegos', 'excursion',
    'restaurante', 'road_trip', 'cine', 'cuestionable'
  )),
  -- Match the existing idea constraints and JavaScript trim/code-point lengths.
  title text not null check (
    pg_catalog.char_length(pg_catalog.btrim(title,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    )) between 3 and 80
  ),
  description text check (
    pg_catalog.char_length(pg_catalog.btrim(description,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    )) <= 400
  ),
  start_date date not null check (start_date between date '2026-11-28' and date '2026-12-20'),
  end_date date not null,
  start_time time without time zone,
  end_time time without time zone,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint season_activities_date_range check (
    end_date >= start_date and end_date <= date '2026-12-21'
  ),
  constraint season_activities_time_range check (
    (end_time is null or start_time is not null)
    and (start_time is null or start_time < time '24:00')
    and (end_time is null or end_time < time '24:00')
    and (start_date <> end_date or end_time is null or end_time > start_time)
  ),
  constraint season_activities_departure_limit check (
    end_date <> date '2026-12-21'
    or (start_time is not null and end_time is not null and end_time <= time '07:25')
  )
);

create index season_activities_season_date_idx on public.season_activities(season_year, start_date);
create index season_activities_created_by_idx on public.season_activities(created_by);

-- A UUID FK alone does not guarantee same-season provenance. The narrowly scoped
-- definer can lock/read another member's idea without requiring idea UPDATE RLS.
-- Clients cannot call it directly or alter the source; FK SET NULL still works.
create function private.check_activity_source_season()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_year smallint;
begin
  if new.source_idea_id is not null then
    select idea.season_year into source_year
    from public.activity_ideas as idea
    where idea.id = new.source_idea_id
    for key share;
    if not found then
      raise exception 'Source idea does not exist' using errcode = '23503';
    end if;
    if source_year <> new.season_year then
      raise exception 'Source idea belongs to another season' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.check_activity_source_season()
  from public, anon, authenticated, service_role, supabase_auth_admin;

create trigger season_activities_source_season
  before insert or update of source_idea_id, season_year on public.season_activities
  for each row execute function private.check_activity_source_season();
create trigger season_activities_updated_at
  before update on public.season_activities
  for each row execute function private.touch_updated_at();

alter table public.season_activities enable row level security;
-- Revoke inherited table defaults before granting only actual app inputs/reads.
revoke all on table public.season_activities from public, anon, authenticated;
grant select (id, season_year, source_idea_id, created_by, status, category,
  title, description, start_date, end_date, start_time, end_time, created_at)
  on public.season_activities to authenticated;
grant delete on table public.season_activities to authenticated;
grant insert (source_idea_id, status, category, title, description,
  start_date, end_date, start_time, end_time)
  on public.season_activities to authenticated;
grant update (status, category, title, description,
  start_date, end_date, start_time, end_time)
  on public.season_activities to authenticated;

create policy season_activities_select_active on public.season_activities
  for select to authenticated
  using ((select private.current_club_member_id()) is not null);
create policy season_activities_insert_own on public.season_activities
  for insert to authenticated
  with check (created_by = (select private.current_club_member_id()));
create policy season_activities_update_creator_admin on public.season_activities
  for update to authenticated
  using (created_by = (select private.current_club_member_id()) or (select private.is_club_admin()))
  with check (created_by = (select private.current_club_member_id()) or (select private.is_club_admin()));
create policy season_activities_delete_creator_admin on public.season_activities
  for delete to authenticated
  using (created_by = (select private.current_club_member_id()) or (select private.is_club_admin()));
