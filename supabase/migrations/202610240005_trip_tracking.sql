begin;
create table public.tracking_sessions (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null unique references public.trips(id) on delete cascade,
 started_by uuid not null references public.profiles(id),
 started_at timestamptz not null default clock_timestamp(),
 ended_at timestamptz,
 check (ended_at is null or ended_at >= started_at)
);
-- A new share_id per opt-in invalidates delayed updates from a previous watcher/tab.
create table public.location_shares (
 session_id uuid not null references public.tracking_sessions(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 share_id uuid not null default gen_random_uuid(),
 expires_at timestamptz not null default (clock_timestamp()+interval '60 seconds'),
 last_published_at timestamptz,
 primary key(session_id,user_id)
);
create table public.rider_locations (
 trip_id uuid not null references public.trips(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 session_id uuid not null,
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 accuracy_m double precision not null check (accuracy_m >= 0 and accuracy_m < 'Infinity'::double precision),
 heading double precision check (heading >= 0 and heading < 360),
 recorded_at timestamptz not null,
 received_at timestamptz not null default clock_timestamp(),
 primary key(trip_id,user_id),
 foreign key(session_id,user_id) references public.location_shares(session_id,user_id) on delete cascade
);
create index rider_locations_session_idx on public.rider_locations(session_id);
alter table public.tracking_sessions enable row level security;
alter table public.location_shares enable row level security;
alter table public.rider_locations enable row level security;
revoke all on public.tracking_sessions,public.location_shares,public.rider_locations from public,anon,authenticated;
grant select on public.tracking_sessions,public.rider_locations to authenticated;
create policy sessions_members_read on public.tracking_sessions for select to authenticated using(public.can_read_trip(trip_id));
-- Shares are private implementation state. The definer helper avoids exposing them.
create function public.can_read_location(p_trip_id uuid,p_session_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.can_read_trip(p_trip_id) and exists(
  select 1 from public.tracking_sessions s join public.trips t on t.id=s.trip_id
  join public.location_shares sh on sh.session_id=s.id
  join public.trip_participants p on p.trip_id=t.id and p.user_id=sh.user_id and p.status='accepted'
  where s.id=p_session_id and s.trip_id=p_trip_id and s.ended_at is null and t.status='active'
  and sh.user_id=p_user_id and sh.expires_at>now());
$$;
revoke all on function public.can_read_location(uuid,uuid,uuid) from public,anon;
grant execute on function public.can_read_location(uuid,uuid,uuid) to authenticated;
create policy locations_members_read on public.rider_locations for select to authenticated
 using(public.can_read_location(trip_id,session_id,user_id) and recorded_at>now()-interval '60 seconds');

create function public.start_trip(p_trip_id uuid,p_expected_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.trips; new_session uuid;
begin
 select * into t from public.trips where id=p_trip_id and created_by=auth.uid() for update;
 if not found then raise exception 'Trip unavailable' using errcode='42501'; end if;
 if t.revision is distinct from p_expected_revision then raise exception 'Trip changed' using errcode='40001'; end if;
 if t.status not in ('draft','planned') then raise exception 'Trip locked' using errcode='55000'; end if;
 if not exists(select 1 from public.trip_routes where trip_id=p_trip_id) then raise exception 'ROUTE_REQUIRED' using errcode='P0001'; end if;
 insert into public.tracking_sessions(trip_id,started_by) values(p_trip_id,auth.uid()) returning id into new_session;
 update public.trips set status='active',revision=revision+1,updated_at=clock_timestamp() where id=p_trip_id;
 return new_session;
end;
$$;
create function public.finish_trip(p_trip_id uuid,p_expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare t public.trips;
begin
 select * into t from public.trips where id=p_trip_id and created_by=auth.uid() for update;
 if not found then raise exception 'Trip unavailable' using errcode='42501'; end if;
 if t.revision is distinct from p_expected_revision then raise exception 'Trip changed' using errcode='40001'; end if;
 if t.status<>'active' then raise exception 'Trip not active' using errcode='55000'; end if;
 update public.tracking_sessions set ended_at=greatest(clock_timestamp(),started_at) where trip_id=p_trip_id and ended_at is null;
 if not found then raise exception 'Session unavailable' using errcode='55000'; end if;
 delete from public.location_shares where session_id in(select id from public.tracking_sessions where trip_id=p_trip_id);
 update public.trips set status='completed',revision=revision+1,updated_at=clock_timestamp() where id=p_trip_id;
end;
$$;
create function public.start_location_sharing(p_session_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.trips; generation uuid;
begin
 select tr.* into t from public.trips tr join public.tracking_sessions s on s.trip_id=tr.id
 where s.id=p_session_id and s.ended_at is null for update of tr;
 if not found or not public.can_read_trip(t.id) then raise exception 'Session unavailable' using errcode='42501'; end if;
 if t.status<>'active' then raise exception 'Session inactive' using errcode='55000'; end if;
 delete from public.rider_locations where session_id=p_session_id and user_id=auth.uid();
 insert into public.location_shares(session_id,user_id) values(p_session_id,auth.uid())
 on conflict(session_id,user_id) do update set share_id=gen_random_uuid(),expires_at=clock_timestamp()+interval '60 seconds'
 returning share_id into generation;
 return generation;
end;
$$;
create function public.stop_location_sharing(p_session_id uuid,p_share_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- Serialize with publish/finish. Retain only a timestamp to prevent quota bypass.
 perform 1 from public.trips t join public.tracking_sessions s on s.trip_id=t.id where s.id=p_session_id for update of t;
 if exists(select 1 from public.location_shares where session_id=p_session_id and user_id=auth.uid() and share_id=p_share_id) then
  delete from public.rider_locations where session_id=p_session_id and user_id=auth.uid();
  update public.location_shares set share_id=gen_random_uuid(),expires_at=clock_timestamp()-interval '1 second'
  where session_id=p_session_id and user_id=auth.uid() and share_id=p_share_id;
 end if;
end;
$$;
create function public.publish_rider_location(p_session_id uuid,p_share_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_m double precision,p_heading double precision,p_recorded_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare t public.trips; previous_time timestamptz; received timestamptz:=clock_timestamp();
begin
 select tr.* into t from public.trips tr join public.tracking_sessions s on s.trip_id=tr.id
 where s.id=p_session_id and s.ended_at is null for update of tr;
 if not found or not public.can_read_trip(t.id) then raise exception 'Session unavailable' using errcode='42501'; end if;
 if t.status<>'active' then raise exception 'Session inactive' using errcode='55000'; end if;
 received:=clock_timestamp();
 perform 1 from public.location_shares where session_id=p_session_id and user_id=auth.uid() and share_id=p_share_id and expires_at>received;
 if not found then raise exception 'SHARING_STOPPED' using errcode='P0001'; end if;
 if p_recorded_at is null or p_recorded_at < received-interval '30 seconds' or p_recorded_at > received+interval '5 seconds' then
  raise exception 'INVALID_POSITION_TIME' using errcode='22023';
 end if;
 select last_published_at into previous_time from public.location_shares where session_id=p_session_id and user_id=auth.uid();
 if previous_time is not null and received<previous_time+interval '5 seconds' then raise exception 'LOCATION_RATE_LIMITED' using errcode='P0001'; end if;
 if exists(select 1 from public.rider_locations where trip_id=t.id and user_id=auth.uid() and recorded_at>=p_recorded_at) then
  raise exception 'INVALID_POSITION_TIME' using errcode='22023';
 end if;
 insert into public.rider_locations(trip_id,user_id,session_id,latitude,longitude,accuracy_m,heading,recorded_at,received_at)
 values(t.id,auth.uid(),p_session_id,p_latitude,p_longitude,p_accuracy_m,p_heading,p_recorded_at,received)
 on conflict(trip_id,user_id) do update set session_id=excluded.session_id,latitude=excluded.latitude,longitude=excluded.longitude,
 accuracy_m=excluded.accuracy_m,heading=excluded.heading,recorded_at=excluded.recorded_at,received_at=excluded.received_at;
 update public.location_shares set last_published_at=received,expires_at=received+interval '60 seconds' where session_id=p_session_id and user_id=auth.uid() and share_id=p_share_id;
end;
$$;
create function public.tracking_snapshot(p_trip_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.can_read_trip(p_trip_id) then raise exception 'Trip unavailable' using errcode='42501'; end if;
 -- Lazy physical expiry complements immediate stop/finish deletion and read TTL.
 delete from public.rider_locations l where l.trip_id=p_trip_id and
  (l.recorded_at<=now()-interval '60 seconds' or not public.can_read_location(l.trip_id,l.session_id,l.user_id));
 select jsonb_build_object('server_now',now(),'status',t.status,'revision',t.revision,
 'session',(select jsonb_build_object('id',s.id,'started_at',s.started_at,'ended_at',s.ended_at) from public.tracking_sessions s where s.trip_id=t.id),
 'positions',coalesce((select jsonb_agg(jsonb_build_object('user_id',l.user_id,'latitude',l.latitude,'longitude',l.longitude,'accuracy_m',l.accuracy_m,
 'heading',l.heading,'recorded_at',l.recorded_at,'display_name',p.display_name))
 from public.rider_locations l join public.profiles p on p.id=l.user_id
 where l.trip_id=t.id and l.recorded_at>now()-interval '60 seconds' and public.can_read_location(l.trip_id,l.session_id,l.user_id)),'[]'::jsonb)) into result
 from public.trips t where t.id=p_trip_id;
 return result;
end;
$$;
-- Only server transactions announce changes; browsers never trust coordinates in messages.
create function public.notify_trip_tracking() returns trigger language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
 tid:=case when TG_OP='DELETE' then old.trip_id else new.trip_id end;
 perform realtime.send(jsonb_build_object('changed',true),'tracking_changed','trip:'||tid::text,true);
 return null;
end;
$$;
revoke all on function public.notify_trip_tracking() from public,anon,authenticated;
create trigger tracking_session_changed after insert or update on public.tracking_sessions for each row execute function public.notify_trip_tracking();
create trigger rider_location_changed after insert or update or delete on public.rider_locations for each row execute function public.notify_trip_tracking();
create function public.can_receive_trip_tracking(p_topic text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.trip_participants p where 'trip:'||p.trip_id::text=p_topic and p.user_id=auth.uid() and p.status='accepted');
$$;
revoke all on function public.can_receive_trip_tracking(text) from public,anon;
grant execute on function public.can_receive_trip_tracking(text) to authenticated;
create policy trip_tracking_receive on realtime.messages for select to authenticated
 using(extension='broadcast' and public.can_receive_trip_tracking((select realtime.topic())));
revoke all on function public.start_trip(uuid,integer),public.finish_trip(uuid,integer),public.start_location_sharing(uuid),
 public.stop_location_sharing(uuid,uuid),public.publish_rider_location(uuid,uuid,double precision,double precision,double precision,double precision,timestamptz),public.tracking_snapshot(uuid) from public,anon;
grant execute on function public.start_trip(uuid,integer),public.finish_trip(uuid,integer),public.start_location_sharing(uuid),
 public.stop_location_sharing(uuid,uuid),public.publish_rider_location(uuid,uuid,double precision,double precision,double precision,double precision,timestamptz),public.tracking_snapshot(uuid) to authenticated;
commit;
