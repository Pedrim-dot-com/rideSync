begin;
create table public.trips (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references public.profiles(id),
 title text not null check (char_length(trim(title)) between 1 and 120),
 departure_at timestamptz not null check (isfinite(departure_at)),
 status text not null default 'draft' check (status in ('draft','planned','active','completed','cancelled')),
 revision integer not null default 1 check (revision > 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index trips_created_by_idx on public.trips(created_by);
create index trips_departure_at_idx on public.trips(departure_at);
create table public.trip_participants (
 trip_id uuid not null references public.trips(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 role text not null check (role in ('organizer','rider')),
 status text not null check (status in ('invited','accepted','declined','removed')),
 motorcycle_id uuid references public.motorcycles(id) on delete set null,
 joined_at timestamptz not null default now(),
 primary key (trip_id,user_id)
);
create index trip_participants_user_id_idx on public.trip_participants(user_id);
create unique index trip_one_organizer on public.trip_participants(trip_id) where role = 'organizer';
create table public.trip_waypoints (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 position integer not null check (position between 0 and 11),
 label text not null check (char_length(trim(label)) between 1 and 120),
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 unique (trip_id,position)
);
create table public.trip_routes (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null unique references public.trips(id) on delete cascade,
 geometry jsonb not null check (
  coalesce(geometry->>'type' = 'LineString' and jsonb_typeof(geometry->'coordinates') = 'array'
  and jsonb_array_length(geometry->'coordinates') >= 2, false)
 ),
 distance_m double precision not null check (distance_m >= 0 and distance_m < 'Infinity'::double precision),
 duration_s double precision not null check (duration_s >= 0 and duration_s < 'Infinity'::double precision),
 routing_provider text not null check (routing_provider = 'openrouteservice'),
 calculated_at timestamptz not null default now()
);
alter table public.trips enable row level security;
alter table public.trip_participants enable row level security;
alter table public.trip_waypoints enable row level security;
alter table public.trip_routes enable row level security;
-- Minimal non-recursive membership check. No caller-supplied user identity.
create function public.can_read_trip(p_trip_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.trip_participants p
 where p.trip_id = p_trip_id and p.user_id = auth.uid() and p.status = 'accepted');
$$;
revoke all on function public.can_read_trip(uuid) from public,anon;
grant execute on function public.can_read_trip(uuid) to authenticated;
create policy trips_members_read on public.trips for select to authenticated using (public.can_read_trip(id));
create policy participants_members_read on public.trip_participants for select to authenticated using (public.can_read_trip(trip_id));
create policy waypoints_members_read on public.trip_waypoints for select to authenticated using (public.can_read_trip(trip_id));
create policy routes_members_read on public.trip_routes for select to authenticated using (public.can_read_trip(trip_id));
-- Client writes use narrow RPCs only: no ability to forge role, owner or status.
revoke all on public.trips,public.trip_participants,public.trip_waypoints,public.trip_routes from anon,authenticated;
grant select on public.trips,public.trip_participants,public.trip_waypoints,public.trip_routes to authenticated;
create function public.add_trip_organizer() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.trip_participants(trip_id,user_id,role,status) values (new.id,new.created_by,'organizer','accepted');
 return new;
end;
$$;
revoke all on function public.add_trip_organizer() from public,anon,authenticated;
create trigger trip_organizer_created after insert on public.trips for each row execute function public.add_trip_organizer();
create function public.validate_participant_motorcycle() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.motorcycle_id is not null and not exists(select 1 from public.motorcycles m where m.id = new.motorcycle_id and m.user_id = new.user_id) then
  raise exception 'Motorcycle must belong to participant' using errcode = '42501';
 end if;
 return new;
end;
$$;
revoke all on function public.validate_participant_motorcycle() from public,anon,authenticated;
create trigger participant_motorcycle_owner before insert or update of motorcycle_id,user_id on public.trip_participants for each row execute function public.validate_participant_motorcycle();
-- Internal helper. Not executable by clients; all public RPCs lock the trip first.
create function public.replace_trip_waypoints(p_trip_id uuid,p_waypoints jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
 if jsonb_typeof(p_waypoints) is distinct from 'array' then
  raise exception 'Waypoints must be an array' using errcode = '22023';
 end if;
 if jsonb_array_length(p_waypoints) not between 2 and 12 then
  raise exception 'Expected 2 to 12 waypoints' using errcode = '22023';
 end if;
 if exists(select 1 from jsonb_array_elements(p_waypoints) w where
  jsonb_typeof(w) is distinct from 'object' or
  jsonb_typeof(w->'label') is distinct from 'string' or
  jsonb_typeof(w->'latitude') is distinct from 'number' or
  jsonb_typeof(w->'longitude') is distinct from 'number') then
  raise exception 'Invalid waypoint fields' using errcode = '22023';
 end if;
 delete from public.trip_routes where trip_id = p_trip_id;
 delete from public.trip_waypoints where trip_id = p_trip_id;
 insert into public.trip_waypoints(trip_id,position,label,latitude,longitude)
 select p_trip_id,(ordinality-1)::integer,trim(w->>'label'),(w->>'latitude')::double precision,(w->>'longitude')::double precision
 from jsonb_array_elements(p_waypoints) with ordinality as points(w,ordinality);
end;
$$;
revoke all on function public.replace_trip_waypoints(uuid,jsonb) from public,anon,authenticated;
create function public.create_trip(p_title text,p_departure_at timestamptz,p_waypoints jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_trip_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 insert into public.trips(created_by,title,departure_at) values (auth.uid(),trim(p_title),p_departure_at) returning id into new_trip_id;
 perform public.replace_trip_waypoints(new_trip_id,p_waypoints);
 return new_trip_id;
end;
$$;
revoke all on function public.create_trip(text,timestamptz,jsonb) from public,anon;
grant execute on function public.create_trip(text,timestamptz,jsonb) to authenticated;
create function public.update_trip(p_trip_id uuid,p_title text,p_departure_at timestamptz,p_waypoints jsonb,p_expected_revision integer) returns void language plpgsql security definer set search_path = '' as $$
declare current_trip public.trips;
begin
 select * into current_trip from public.trips where id = p_trip_id and created_by = auth.uid() for update;
 if not found then raise exception 'Trip unavailable' using errcode = '42501'; end if;
 if p_expected_revision is distinct from current_trip.revision then raise exception 'Trip changed' using errcode = '40001'; end if;
 if current_trip.status not in ('draft','planned') then raise exception 'Itinerary is locked' using errcode = '55000'; end if;
 update public.trips set title = trim(p_title),departure_at = p_departure_at,revision = revision+1,updated_at = now() where id = p_trip_id;
 perform public.replace_trip_waypoints(p_trip_id,p_waypoints);
end;
$$;
revoke all on function public.update_trip(uuid,text,timestamptz,jsonb,integer) from public,anon;
grant execute on function public.update_trip(uuid,text,timestamptz,jsonb,integer) to authenticated;
-- Tracking lifecycle transitions are deliberately reserved for future start/stop RPCs.
create function public.set_trip_status(p_trip_id uuid,p_status text,p_expected_revision integer) returns void language plpgsql security definer set search_path = '' as $$
declare current_trip public.trips;
begin
 select * into current_trip from public.trips where id = p_trip_id and created_by = auth.uid() for update;
 if not found then raise exception 'Trip unavailable' using errcode = '42501'; end if;
 if p_expected_revision is distinct from current_trip.revision then raise exception 'Trip changed' using errcode = '40001'; end if;
 if not ((current_trip.status = 'draft' and p_status in ('planned','cancelled')) or (current_trip.status = 'planned' and p_status in ('draft','cancelled'))) or p_status is null then
  raise exception 'Invalid state transition' using errcode = '55000';
 end if;
 update public.trips set status = p_status,revision = revision+1,updated_at = now() where id = p_trip_id;
end;
$$;
revoke all on function public.set_trip_status(uuid,text,integer) from public,anon;
grant execute on function public.set_trip_status(uuid,text,integer) to authenticated;
create function public.delete_trip(p_trip_id uuid,p_expected_revision integer) returns void language plpgsql security definer set search_path = '' as $$
declare current_trip public.trips;
begin
 select * into current_trip from public.trips where id = p_trip_id and created_by = auth.uid() for update;
 if not found then raise exception 'Trip unavailable' using errcode = '42501'; end if;
 if p_expected_revision is distinct from current_trip.revision then raise exception 'Trip changed' using errcode = '40001'; end if;
 if current_trip.status not in ('draft','cancelled') then raise exception 'Trip cannot be deleted' using errcode = '55000'; end if;
 delete from public.trips where id = p_trip_id;
end;
$$;
revoke all on function public.delete_trip(uuid,integer) from public,anon;
grant execute on function public.delete_trip(uuid,integer) to authenticated;
commit;
