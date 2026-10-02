create extension if not exists pgcrypto with schema extensions;

create table public.club_members (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  display_name text not null,
  role text not null default 'member',
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  constraint club_members_display_name_check check (
    display_name = pg_catalog.btrim(display_name)
    and pg_catalog.char_length(display_name) between 1 and 40
  ),
  constraint club_members_role_check check (role in ('admin', 'member'))
);

create table public.club_member_access (
  member_id uuid primary key references public.club_members(id) on delete cascade,
  email_sha256 text not null unique,
  created_at timestamptz not null default pg_catalog.now(),
  constraint club_member_access_email_sha256_check check (
    email_sha256 ~ '^[0-9a-f]{64}$'
  )
);

alter table public.club_members enable row level security;
alter table public.club_member_access enable row level security;

revoke all on table public.club_members from public, anon, authenticated;
revoke all on table public.club_member_access from public, anon, authenticated;
grant select on table public.club_members to authenticated;

create policy club_members_select_own_active
  on public.club_members for select to authenticated
  using (auth_user_id = (select auth.uid()) and is_active);

with seed(display_name, role, email_sha256) as (
  values
    ('Marco', 'admin', '382a07c4164f87137feb14a8cc800c97d0e886f51873efbfbc416eb11dcb0590'),
    ('Luisa', 'member', '5822d47d6d5396a1637543344e52285a58e83b85147f031bb7b699dcc191f4b7'),
    ('Greby', 'member', 'b5cd2ef8ef270343afb387716306ca86bec3fee1f865b678325ba8c55a7442dc')
), inserted as (
  insert into public.club_members (display_name, role)
  select display_name, role from seed
  returning id, display_name
)
insert into public.club_member_access (member_id, email_sha256)
select inserted.id, seed.email_sha256
from inserted join seed using (display_name);

create function public.hook_allow_club_member(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if event #>> '{user,app_metadata,provider}' = 'google'
     and pg_catalog.jsonb_typeof(event #> '{user,email}') = 'string'
     and exists (
       select 1
       from public.club_member_access as access
       join public.club_members as member on member.id = access.member_id
       where member.is_active
         and access.email_sha256 = pg_catalog.encode(
           extensions.digest(
             pg_catalog.lower(pg_catalog.btrim(event #>> '{user,email}')),
             'sha256'
           ),
           'hex'
         )
     ) then
    return '{}'::jsonb;
  end if;

  return '{"error":{"http_code":403,"message":"Esta cuenta no está autorizada para Afilados Club."}}'::jsonb;
end;
$$;

revoke all on function public.hook_allow_club_member(jsonb)
  from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_allow_club_member(jsonb)
  to supabase_auth_admin;

create function public.handle_club_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data ->> 'provider' is distinct from 'google'
     or new.email is null then
    raise exception 'Club membership binding refused' using errcode = '42501';
  end if;

  -- The conditional UPDATE takes a row lock and rechecks the unbound predicate.
  -- Concurrent signups cannot steal a binding or overwrite seeded identity/role.
  update public.club_members as member
  set auth_user_id = new.id
  from public.club_member_access as access
  where access.member_id = member.id
    and member.is_active
    and member.auth_user_id is null
    and access.email_sha256 = pg_catalog.encode(
      extensions.digest(pg_catalog.lower(pg_catalog.btrim(new.email)), 'sha256'),
      'hex'
    );

  if not found then
    raise exception 'Club membership binding refused' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.handle_club_auth_user_created()
  from public, anon, authenticated, supabase_auth_admin;

create trigger on_club_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_club_auth_user_created();
