-- PT Booking MVP. All appointment instants are UTC (timestamptz). Weekly rules
-- are wall-clock times in trainer_profiles.timezone (an IANA zone).
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (length(btrim(first_name)) between 1 and 80 and first_name !~ '[[:cntrl:]]'),
  last_name text not null check (length(btrim(last_name)) between 1 and 80 and last_name !~ '[[:cntrl:]]'),
  role text not null check (role in ('trainer', 'client')),
  avatar_url text check (avatar_url is null or (length(avatar_url) <= 2048 and avatar_url ~ '^https://')),
  phone text check (phone is null or length(phone) <= 40),
  privacy_accepted_at timestamptz not null,
  privacy_version text not null check (length(btrim(privacy_version)) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trainer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text not null default '' check (length(bio) <= 1000),
  location text not null default '' check (length(location) <= 120),
  studio text not null default '' check (length(studio) <= 120),
  session_duration_minutes integer not null default 60 check (session_duration_minutes in (30,45,60,90)),
  cancellation_hours integer not null default 12 check (cancellation_hours between 0 and 168),
  timezone text not null default 'Europe/Rome',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trainer_availability (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainer_profiles(user_id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_times_valid check (
    start_time < end_time
    and extract(second from start_time) = 0
    and extract(second from end_time) = 0
  ),
  constraint availability_does_not_overlap exclude using gist (
    trainer_id extensions.gist_uuid_ops with =,
    weekday extensions.gist_int4_ops with =,
    int4range((extract(epoch from start_time)::integer / 60),
              (extract(epoch from end_time)::integer / 60), '[)') with &&
  )
);

create table public.trainer_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainer_profiles(user_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or length(reason) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exception_times_valid check (starts_at < ends_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainer_profiles(user_id) on delete cascade,
  client_id uuid not null references public.client_profiles(user_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled','completed')),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_distinct_people check (trainer_id <> client_id),
  constraint booking_positive_duration check (starts_at < ends_at),
  -- [start,end) permits back-to-back sessions. GiST exclusion constraints
  -- arbitrate concurrent writes even if both clients previously saw a free slot.
  constraint bookings_no_trainer_overlap exclude using gist (
    trainer_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled'),
  constraint bookings_no_client_overlap exclude using gist (
    client_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled')
);

create index bookings_client_start_idx on public.bookings(client_id, starts_at);
create index bookings_trainer_start_idx on public.bookings(trainer_id, starts_at);
create index exceptions_trainer_start_idx on public.trainer_availability_exceptions(trainer_id, starts_at);
create index exceptions_period_idx on public.trainer_availability_exceptions using gist (tstzrange(starts_at, ends_at, '[)'));

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create function private.validate_trainer_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone)
     or not exists (select 1 from public.profiles where id = new.user_id and role = 'trainer') then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;
  -- Serialize schedule settings with bookings. Existing appointments retain
  -- their original duration and UTC instants when settings are edited.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  return new;
end;
$$;

create function private.validate_client_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.user_id and role = 'client') then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function private.protect_profile_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.role is distinct from old.role
     or new.privacy_accepted_at is distinct from old.privacy_accepted_at
     or new.privacy_version is distinct from old.privacy_version
     or new.created_at is distinct from old.created_at then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if v_meta->>'role' not in ('trainer','client')
     or v_meta->>'role' is null
     or v_meta->>'privacy_accepted' is distinct from 'true'
     or length(btrim(coalesce(v_meta->>'first_name',''))) not between 1 and 80
     or length(btrim(coalesce(v_meta->>'last_name',''))) not between 1 and 80 then
    raise exception using message = 'INVALID_SIGNUP_METADATA', errcode = 'P0001';
  end if;
  insert into public.profiles(id, first_name, last_name, role, privacy_accepted_at, privacy_version)
  values(new.id, btrim(v_meta->>'first_name'), btrim(v_meta->>'last_name'), v_meta->>'role',
         statement_timestamp(), coalesce(nullif(btrim(v_meta->>'privacy_version'),''), 'draft-v1'));
  if v_meta->>'role' = 'trainer' then
    insert into public.trainer_profiles(user_id) values(new.id);
  else
    insert into public.client_profiles(user_id) values(new.id);
  end if;
  return new;
end;
$$;

create trigger auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

create trigger profiles_protect_identity before update on public.profiles
for each row execute function private.protect_profile_identity();
create trigger trainer_profile_valid before insert or update on public.trainer_profiles
for each row execute function private.validate_trainer_profile();
create trigger client_profile_valid before insert or update on public.client_profiles
for each row execute function private.validate_client_profile();

create trigger profiles_updated before update on public.profiles for each row execute function private.set_updated_at();
create trigger trainer_profiles_updated before update on public.trainer_profiles for each row execute function private.set_updated_at();
create trigger client_profiles_updated before update on public.client_profiles for each row execute function private.set_updated_at();
create trigger availability_updated before update on public.trainer_availability for each row execute function private.set_updated_at();
create trigger exceptions_updated before update on public.trainer_availability_exceptions for each row execute function private.set_updated_at();
create trigger bookings_updated before update on public.bookings for each row execute function private.set_updated_at();

-- This pure schedule expansion is private: all public entry points authorize
-- their caller and add current bookings/exceptions/time filtering.
create function private.schedule_slots(p_trainer_id uuid, p_date date)
returns table(starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with candidates as (
    select s.local_start, s.local_start + pg_catalog.make_interval(mins => t.session_duration_minutes) as local_end,
           t.timezone, t.session_duration_minutes
    from public.trainer_profiles t
    join public.trainer_availability a on a.trainer_id = t.user_id
      and a.weekday = extract(isodow from p_date)::integer
    cross join lateral pg_catalog.generate_series(
      p_date + a.start_time,
      p_date + a.end_time - pg_catalog.make_interval(mins => t.session_duration_minutes),
      pg_catalog.make_interval(mins => t.session_duration_minutes)
    ) as s(local_start)
    where t.user_id = p_trainer_id
  ), instants as (
    select local_start, local_end, timezone, session_duration_minutes,
           local_start at time zone timezone as utc_start,
           local_end at time zone timezone as utc_end
    from candidates
  )
  select utc_start, utc_end from instants
  -- PostgreSQL chooses the standard-time occurrence of ambiguous fall times.
  -- Round trips reject missing spring times; duration check rejects sessions
  -- crossing a DST change with a different elapsed duration.
  where utc_start at time zone timezone = local_start
    and utc_end at time zone timezone = local_end
    and utc_end - utc_start = pg_catalog.make_interval(mins => session_duration_minutes)
  order by utc_start;
$$;

create function private.lock_schedule_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_trainer_id uuid;
begin
  if tg_op = 'DELETE' then v_trainer_id := old.trainer_id;
  else v_trainer_id := new.trainer_id;
  end if;
  if tg_op = 'UPDATE' and old.trainer_id is distinct from new.trainer_id then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  -- BEFORE triggers run before RLS WITH CHECK on inserts: authorize before
  -- inspecting appointment conflicts so cross-owner probes reveal no detail.
  if auth.uid() is not null and auth.uid() <> v_trainer_id then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_trainer_id::text, 0));
  if tg_table_name = 'trainer_availability_exceptions' and tg_op <> 'DELETE' then
    if exists (
      select 1 from public.bookings b where b.trainer_id = new.trainer_id
      and b.status <> 'cancelled'
      and pg_catalog.tstzrange(b.starts_at,b.ends_at,'[)') && pg_catalog.tstzrange(new.starts_at,new.ends_at,'[)')
    ) then
      raise exception using message = 'AVAILABILITY_CONFLICT', errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger availability_schedule_lock before insert or update or delete on public.trainer_availability
for each row execute function private.lock_schedule_change();
create trigger exceptions_schedule_lock before insert or update or delete on public.trainer_availability_exceptions
for each row execute function private.lock_schedule_change();

-- Defense in depth: even trusted backend writes must respect schedule/overlap
-- and the immutable appointment identity. App roles cannot write this table.
create function private.validate_booking_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_timezone text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.trainer_id::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.client_id::text, 1));
  if tg_op = 'INSERT' then
    select t.timezone into v_timezone from public.trainer_profiles t where t.user_id = new.trainer_id;
    -- Locks can wait: use decision time, not the HTTP statement's start time.
    if new.status <> 'confirmed' or new.starts_at <= clock_timestamp()
       or not exists (select 1 from private.schedule_slots(new.trainer_id, (new.starts_at at time zone v_timezone)::date) s
                      where s.starts_at = new.starts_at and s.ends_at = new.ends_at)
       or exists (select 1 from public.trainer_availability_exceptions e
                  where e.trainer_id = new.trainer_id
                    and pg_catalog.tstzrange(e.starts_at,e.ends_at,'[)') && pg_catalog.tstzrange(new.starts_at,new.ends_at,'[)')) then
      raise exception using message = 'SLOT_UNAVAILABLE', errcode = 'P0001';
    end if;
  else
    if new.id is distinct from old.id or new.trainer_id is distinct from old.trainer_id
       or new.client_id is distinct from old.client_id or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at or new.created_at is distinct from old.created_at
       or new.notes is distinct from old.notes then
      raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
    end if;
    if old.status <> 'confirmed' or new.status not in ('cancelled','completed')
       or (new.status = 'completed' and old.ends_at > clock_timestamp()) then
      raise exception using message = 'BOOKING_NOT_CANCELLABLE', errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger booking_validate before insert or update on public.bookings
for each row execute function private.validate_booking_write();

-- Every table uses RLS; public projections are explicit SECURITY DEFINER RPCs,
-- avoiding accidental exposure of phone/consent/private metadata.
alter table public.profiles enable row level security;
alter table public.trainer_profiles enable row level security;
alter table public.client_profiles enable row level security;
alter table public.trainer_availability enable row level security;
alter table public.trainer_availability_exceptions enable row level security;
alter table public.bookings enable row level security;

create policy profiles_own_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy trainer_profiles_own_read on public.trainer_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy trainer_profiles_own_update on public.trainer_profiles for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy client_profiles_own_read on public.client_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy availability_own on public.trainer_availability for all to authenticated
using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy exceptions_own on public.trainer_availability_exceptions for all to authenticated
using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy bookings_participant_read on public.bookings for select to authenticated
using (client_id = (select auth.uid()) or trainer_id = (select auth.uid()));

revoke all on public.profiles, public.trainer_profiles, public.client_profiles,
  public.trainer_availability, public.trainer_availability_exceptions, public.bookings from public, anon, authenticated;
grant select on public.profiles, public.trainer_profiles, public.client_profiles,
  public.trainer_availability, public.trainer_availability_exceptions, public.bookings to authenticated;
grant update(first_name,last_name,avatar_url,phone) on public.profiles to authenticated;
grant update(bio,location,studio,session_duration_minutes,cancellation_hours,timezone) on public.trainer_profiles to authenticated;
grant insert(id,trainer_id,weekday,start_time,end_time) on public.trainer_availability to authenticated;
grant update(weekday,start_time,end_time) on public.trainer_availability to authenticated;
grant insert(id,trainer_id,starts_at,ends_at,reason) on public.trainer_availability_exceptions to authenticated;
grant update(starts_at,ends_at,reason) on public.trainer_availability_exceptions to authenticated;
grant delete on public.trainer_availability, public.trainer_availability_exceptions to authenticated;

create function public.list_trainers()
returns table(user_id uuid, first_name text, last_name text, avatar_url text, bio text,
              location text, studio text, session_duration_minutes integer,
              cancellation_hours integer, timezone text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception using message='NOT_AUTHORIZED', errcode='P0001'; end if;
  return query select t.user_id,p.first_name,p.last_name,p.avatar_url,t.bio,t.location,t.studio,
    t.session_duration_minutes,t.cancellation_hours,t.timezone
  from public.trainer_profiles t join public.profiles p on p.id=t.user_id
  order by p.first_name,p.last_name,t.user_id;
end;
$$;

create function public.get_available_slots(p_trainer_id uuid, p_date date)
returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid()
    and (p.role = 'client' or p.id = p_trainer_id)
  ) then raise exception using message='NOT_AUTHORIZED', errcode='P0001'; end if;
  if p_date is null or p_trainer_id is null then
    raise exception using message='INVALID_INPUT', errcode='P0001';
  end if;
  return query
  select s.starts_at,s.ends_at from private.schedule_slots(p_trainer_id,p_date) s
  where s.starts_at > statement_timestamp()
    and not exists (select 1 from public.trainer_availability_exceptions e
      where e.trainer_id = p_trainer_id
      and pg_catalog.tstzrange(e.starts_at,e.ends_at,'[)') && pg_catalog.tstzrange(s.starts_at,s.ends_at,'[)'))
    and not exists (select 1 from public.bookings b where b.status <> 'cancelled'
      and (b.trainer_id = p_trainer_id or b.client_id = auth.uid())
      and pg_catalog.tstzrange(b.starts_at,b.ends_at,'[)') && pg_catalog.tstzrange(s.starts_at,s.ends_at,'[)'))
  order by s.starts_at;
end;
$$;

create function public.create_booking(p_trainer_id uuid, p_starts_at timestamptz, p_notes text default null)
returns public.bookings
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_trainer public.trainer_profiles;
  v_booking public.bookings;
begin
  if v_uid is null or not exists (select 1 from public.client_profiles where user_id=v_uid) then
    raise exception using message='NOT_AUTHORIZED', errcode='P0001';
  end if;
  if p_trainer_id is null or p_starts_at is null or length(p_notes) > 500 then
    raise exception using message='INVALID_INPUT', errcode='P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_trainer_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,1));
  select * into v_trainer from public.trainer_profiles where user_id=p_trainer_id;
  if not found then raise exception using message='SLOT_UNAVAILABLE', errcode='P0001'; end if;
  insert into public.bookings(trainer_id,client_id,starts_at,ends_at,notes)
  values(p_trainer_id,v_uid,p_starts_at,p_starts_at + pg_catalog.make_interval(mins=>v_trainer.session_duration_minutes),nullif(btrim(p_notes),''))
  returning * into v_booking;
  return v_booking;
exception when exclusion_violation then
  raise exception using message='SLOT_UNAVAILABLE', errcode='P0001';
end;
$$;

create function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_cutoff integer;
  v_now timestamptz;
begin
  if v_uid is null then raise exception using message='NOT_AUTHORIZED',errcode='P0001'; end if;
  select * into v_booking from public.bookings b
  where b.id=p_booking_id and (b.client_id=v_uid or b.trainer_id=v_uid);
  if not found then raise exception using message='NOT_AUTHORIZED',errcode='P0001'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_booking.trainer_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_booking.client_id::text,1));
  select * into v_booking from public.bookings b where b.id=p_booking_id for update;
  if v_booking.status <> 'confirmed' then
    raise exception using message='BOOKING_NOT_CANCELLABLE',errcode='P0001';
  end if;
  v_now := clock_timestamp();
  if v_uid = v_booking.client_id then
    select cancellation_hours into v_cutoff from public.trainer_profiles where user_id=v_booking.trainer_id;
    if v_booking.starts_at <= v_now
       or v_booking.starts_at - v_now < pg_catalog.make_interval(hours=>v_cutoff) then
      raise exception using message='BOOKING_CUTOFF',errcode='P0001';
    end if;
  end if;
  update public.bookings set status='cancelled' where id=p_booking_id returning * into v_booking;
  return v_booking;
end;
$$;

create function public.get_my_bookings()
returns table(id uuid, trainer_id uuid, client_id uuid, starts_at timestamptz, ends_at timestamptz,
              status text, notes text, created_at timestamptz, updated_at timestamptz,
              trainer_name text, client_name text, cancellation_hours integer, trainer_timezone text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception using message='NOT_AUTHORIZED',errcode='P0001'; end if;
  return query select b.id,b.trainer_id,b.client_id,b.starts_at,b.ends_at,
    case when b.status='confirmed' and b.ends_at <= statement_timestamp() then 'completed' else b.status end,
    b.notes,b.created_at,b.updated_at,
    pt.first_name||' '||pt.last_name,pc.first_name||' '||pc.last_name,t.cancellation_hours,t.timezone
  from public.bookings b
  join public.profiles pt on pt.id=b.trainer_id
  join public.profiles pc on pc.id=b.client_id
  join public.trainer_profiles t on t.user_id=b.trainer_id
  where b.client_id=auth.uid() or b.trainer_id=auth.uid()
  order by b.starts_at;
end;
$$;

create function public.get_trainer_clients()
returns table(id uuid, first_name text, last_name text, avatar_url text, next_booking_at timestamptz, total_sessions bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.trainer_profiles t where t.user_id=auth.uid()) then
    raise exception using message='NOT_AUTHORIZED',errcode='P0001';
  end if;
  return query select p.id,p.first_name,p.last_name,p.avatar_url,
    min(b.starts_at) filter (where b.status='confirmed' and b.starts_at > statement_timestamp()),
    count(*) filter (where b.status<>'cancelled')
  from public.bookings b join public.profiles p on p.id=b.client_id
  where b.trainer_id=auth.uid()
  group by p.id,p.first_name,p.last_name,p.avatar_url order by p.first_name,p.last_name,p.id;
end;
$$;

-- Remove default PUBLIC function execution, including trigger helpers.
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.list_trainers() from public,anon,authenticated;
revoke all on function public.get_available_slots(uuid,date) from public,anon,authenticated;
revoke all on function public.create_booking(uuid,timestamptz,text) from public,anon,authenticated;
revoke all on function public.cancel_booking(uuid) from public,anon,authenticated;
revoke all on function public.get_my_bookings() from public,anon,authenticated;
revoke all on function public.get_trainer_clients() from public,anon,authenticated;
grant execute on function public.list_trainers(), public.get_available_slots(uuid,date),
  public.create_booking(uuid,timestamptz,text), public.cancel_booking(uuid),
  public.get_my_bookings(), public.get_trainer_clients() to authenticated;

comment on table public.profiles is 'Private owner profile. role is immutable for the single-role MVP. Never expose this table as a public trainer directory.';
comment on table public.bookings is 'Physical history retained; cancelled bookings release their interval. Read elapsed confirmed bookings via get_my_bookings for effective completed status.';
comment on function public.create_booking(uuid,timestamptz,text) is 'Only authenticated clients. Transactional schedule validation, trainer/client advisory locks, GiST exclusions; SLOT_UNAVAILABLE is safe to show as a stale-slot error.';
