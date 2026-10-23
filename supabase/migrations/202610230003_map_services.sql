begin;
create table public.map_request_limits (
 user_id uuid not null references public.profiles(id) on delete cascade,
 action text not null check(action in ('calculate-route','search-places')),
 window_started_at timestamptz not null,
 requests integer not null check(requests > 0),
 primary key(user_id,action)
);
alter table public.map_request_limits enable row level security;
revoke all on public.map_request_limits from public,anon,authenticated;
create function public.consume_map_request(p_action text) returns void language plpgsql security definer set search_path = '' as $$
declare current_requests integer; request_limit integer; request_time timestamptz := clock_timestamp();
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if p_action not in ('calculate-route','search-places') or p_action is null then raise exception 'Invalid action' using errcode = '22023'; end if;
 request_limit := case when p_action = 'calculate-route' then 10 else 30 end;
 insert into public.map_request_limits(user_id,action,window_started_at,requests)
 values(auth.uid(),p_action,request_time,1)
 on conflict(user_id,action) do update set
 requests = case when public.map_request_limits.window_started_at <= request_time - interval '60 seconds' then 1 else public.map_request_limits.requests + 1 end,
 window_started_at = case when public.map_request_limits.window_started_at <= request_time - interval '60 seconds' then request_time else public.map_request_limits.window_started_at end
 returning requests into current_requests;
 if current_requests > request_limit then raise exception 'RATE_LIMITED'; end if;
end;
$$;
revoke all on function public.consume_map_request(text) from public,anon;
grant execute on function public.consume_map_request(text) to authenticated;
-- Only the trusted Edge Function service role may store provider results.
create function public.store_trip_route(p_trip_id uuid,p_actor uuid,p_expected_revision integer,p_geometry jsonb,p_distance_m double precision,p_duration_s double precision,p_calculated_at timestamptz) returns void language plpgsql security definer set search_path = '' as $$
declare current_trip public.trips; route_coordinates jsonb; point jsonb;
begin
 select * into current_trip from public.trips where id=p_trip_id and created_by=p_actor for update;
 if not found then raise exception 'Trip unavailable' using errcode='42501'; end if;
 if current_trip.revision is distinct from p_expected_revision then raise exception 'Trip changed' using errcode='40001'; end if;
 if current_trip.status not in ('draft','planned') then raise exception 'Itinerary locked' using errcode='55000'; end if;
 if p_geometry->>'type' is distinct from 'LineString' or jsonb_typeof(p_geometry->'coordinates') is distinct from 'array' then raise exception 'Invalid geometry' using errcode='22023'; end if;
 route_coordinates := p_geometry->'coordinates';
 if jsonb_array_length(route_coordinates) not between 2 and 50000 then raise exception 'Invalid geometry' using errcode='22023'; end if;
 for point in select value from jsonb_array_elements(route_coordinates) loop
  if jsonb_typeof(point) is distinct from 'array' then raise exception 'Invalid coordinate' using errcode='22023'; end if;
  if jsonb_array_length(point) <> 2 or jsonb_typeof(point->0) is distinct from 'number' or jsonb_typeof(point->1) is distinct from 'number' then raise exception 'Invalid coordinate' using errcode='22023'; end if;
  if (point->>0)::double precision not between -180 and 180 or (point->>1)::double precision not between -90 and 90 then raise exception 'Invalid coordinate' using errcode='22023'; end if;
 end loop;
 if p_calculated_at is null or not isfinite(p_calculated_at) then raise exception 'Invalid timestamp' using errcode='22023'; end if;
 insert into public.trip_routes(trip_id,geometry,distance_m,duration_s,routing_provider,calculated_at)
 values(p_trip_id,p_geometry,p_distance_m,p_duration_s,'openrouteservice',p_calculated_at)
 on conflict(trip_id) do update set geometry=excluded.geometry,distance_m=excluded.distance_m,duration_s=excluded.duration_s,routing_provider=excluded.routing_provider,calculated_at=excluded.calculated_at;
 update public.trips set revision=revision+1,updated_at=now() where id=p_trip_id;
end;
$$;
revoke all on function public.store_trip_route(uuid,uuid,integer,jsonb,double precision,double precision,timestamptz) from public,anon,authenticated;
grant execute on function public.store_trip_route(uuid,uuid,integer,jsonb,double precision,double precision,timestamptz) to service_role;
commit;
