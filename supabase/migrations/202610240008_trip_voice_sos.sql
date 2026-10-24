begin;
-- Only the latest SOS and current voice floor are retained. No audio recordings.
create table public.trip_sos_alerts (
 trip_id uuid primary key references public.trips(id) on delete cascade,
 raised_by uuid not null references public.profiles(id) on delete cascade,
 reason text not null check(reason in ('puncture','mechanical','left_behind','other')),
 raised_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '90 seconds',
 resolved_at timestamptz
);
create table public.trip_voice_state (
 trip_id uuid primary key references public.trips(id) on delete cascade,
 room_epoch uuid not null default gen_random_uuid(),
 epoch_started_at timestamptz not null default now(),
 speaker_id uuid references public.profiles(id) on delete set null,
 speaker_kind text check(speaker_kind in ('organizer','sos')),
 speaker_until timestamptz,
 ready boolean not null default false,
 operation_id uuid,
 operation_until timestamptz
);
create table public.trip_voice_limits (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 window_start timestamptz not null default now(), requests integer not null default 0
);
alter table public.trip_sos_alerts enable row level security;
alter table public.trip_voice_state enable row level security;
alter table public.trip_voice_limits enable row level security;
revoke all on public.trip_sos_alerts,public.trip_voice_state,public.trip_voice_limits from public,anon,authenticated;

create function public.can_receive_trip_voice(p_topic text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.trip_participants p join public.trips t on t.id=p.trip_id where 'voice:'||p.trip_id::text=p_topic and p.user_id=auth.uid() and p.status='accepted' and t.status='active');
$$;
revoke all on function public.can_receive_trip_voice(text) from public,anon;
grant execute on function public.can_receive_trip_voice(text) to authenticated;
create policy trip_voice_receive on realtime.messages for select to authenticated using(extension='broadcast' and public.can_receive_trip_voice((select realtime.topic())));

create function public.notify_trip_voice() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform realtime.send(jsonb_build_object('trip_id',coalesce(new.trip_id,old.trip_id)), 'voice_changed','voice:'||coalesce(new.trip_id,old.trip_id)::text,true);
 return coalesce(new,old);
end;
$$;
revoke all on function public.notify_trip_voice() from public,anon,authenticated;
create trigger voice_state_changed after insert or update or delete on public.trip_voice_state for each row execute function public.notify_trip_voice();
create trigger sos_changed after insert or update or delete on public.trip_sos_alerts for each row execute function public.notify_trip_voice();

create function public.raise_trip_sos(p_trip_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare alert public.trip_sos_alerts;
begin
 perform 1 from public.trips where id=p_trip_id and status='active' for update;
 if not found or not public.can_read_trip(p_trip_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_reason is null or p_reason not in ('puncture','mechanical','left_behind','other') then raise exception 'Invalid reason' using errcode='22023'; end if;
 select * into alert from public.trip_sos_alerts where trip_id=p_trip_id for update;
 if found and alert.resolved_at is null and alert.expires_at>now() then
  if alert.raised_by=auth.uid() then return; end if;
  raise exception 'SOS_ALREADY_ACTIVE' using errcode='P0001';
 end if;
 if alert.raised_at>now()-interval '10 seconds' then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
 insert into public.trip_sos_alerts(trip_id,raised_by,reason) values(p_trip_id,auth.uid(),p_reason)
 on conflict(trip_id) do update set raised_by=excluded.raised_by,reason=excluded.reason,raised_at=now(),expires_at=now()+interval '90 seconds',resolved_at=null;
 -- Immediately block organizer playback, even before the voice provider responds.
 update public.trip_voice_state set room_epoch=gen_random_uuid(),epoch_started_at=now(),speaker_id=null,speaker_kind=null,speaker_until=null,ready=false,operation_id=null,operation_until=null where trip_id=p_trip_id;
end;
$$;
create function public.resolve_trip_sos(p_trip_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.trips where id=p_trip_id and status='active' for update;
 if not found or not public.can_read_trip(p_trip_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 update public.trip_sos_alerts set resolved_at=now() where trip_id=p_trip_id and resolved_at is null
 and (raised_by=auth.uid() or exists(select 1 from public.trips t where t.id=p_trip_id and t.created_by=auth.uid()));
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 -- New epoch fences off any delayed permission changes in the retired room.
 update public.trip_voice_state set room_epoch=gen_random_uuid(),epoch_started_at=now(),speaker_id=null,speaker_kind=null,speaker_until=null,ready=false,
 operation_id=null,operation_until=null where trip_id=p_trip_id;
end;
$$;

create function public.trip_voice_snapshot(p_trip_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare state public.trip_voice_state; alert public.trip_sos_alerts; current_trip public.trips; speaker_name text; alert_name text;
begin
 select * into current_trip from public.trips where id=p_trip_id for update;
 if not found or not public.can_read_trip(p_trip_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 if current_trip.status='active' then insert into public.trip_voice_state(trip_id) values(p_trip_id) on conflict do nothing; end if;
 select * into state from public.trip_voice_state where trip_id=p_trip_id for update;
 if (state.operation_until<=now() and state.operation_id is not null) or state.speaker_until<=now() then
  update public.trip_voice_state set room_epoch=gen_random_uuid(),epoch_started_at=now(),speaker_id=null,speaker_kind=null,speaker_until=null,ready=false,operation_id=null,operation_until=null
   where trip_id=p_trip_id returning * into state;
 end if;
 -- Force fresh audience authorization at least once per minute during speech.
 if state.ready and state.speaker_id is not null and state.epoch_started_at<now()-interval '60 seconds' then
  update public.trip_voice_state set room_epoch=gen_random_uuid(),epoch_started_at=now() where trip_id=p_trip_id returning * into state;
 end if;
 select * into alert from public.trip_sos_alerts where trip_id=p_trip_id and resolved_at is null and expires_at>now();
 select display_name into speaker_name from public.profiles where id=state.speaker_id;
 select display_name into alert_name from public.profiles where id=alert.raised_by;
 return jsonb_build_object('status',current_trip.status,'server_now',now(),'room_epoch',state.room_epoch,
  'speaker_id',case when state.ready and state.speaker_until>now() and current_trip.status='active' and
    (alert.raised_by is null or (state.speaker_kind='sos' and alert.raised_by=state.speaker_id)) then state.speaker_id else null end,
  'speaker_name',speaker_name,'speaker_kind',state.speaker_kind,'speaker_until',state.speaker_until,
  'ready',coalesce(state.ready,false),'settling',coalesce(state.operation_id is not null and state.operation_until>now(),false),'sos',case when alert.raised_by is not null and current_trip.status='active' then
   jsonb_build_object('user_id',alert.raised_by,'display_name',alert_name,'reason',alert.reason,'raised_at',alert.raised_at,'expires_at',alert.expires_at) else null end);
end;
$$;

-- Service-only floor operations. The Edge Function obtains p_actor from getUser,
-- never from a body supplied by a browser. A bounded lease serializes provider
-- updates. Every floor transition and timeout rotates the room epoch; old
-- publisher tokens cannot authorize speaking to the current audience.
create function public.begin_trip_voice_operation(p_trip_id uuid,p_actor uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare state public.trip_voice_state; current_trip public.trips; alert public.trip_sos_alerts; retired text; op uuid; quota public.trip_voice_limits;
begin
 if p_action is null or p_action not in ('join','speak','sos','stop','leave','heartbeat') then raise exception 'Invalid action' using errcode='22023'; end if;
 select * into current_trip from public.trips where id=p_trip_id for update;
 if not found or current_trip.status<>'active' or not exists(select 1 from public.trip_participants where trip_id=p_trip_id and user_id=p_actor and status='accepted') then
  raise exception 'Forbidden' using errcode='42501';
 end if;
 insert into public.trip_voice_limits(user_id,requests) values(p_actor,1) on conflict(user_id) do update
  set window_start=case when trip_voice_limits.window_start<now()-interval '1 minute' then now() else trip_voice_limits.window_start end,
  requests=case when trip_voice_limits.window_start<now()-interval '1 minute' then 1 else trip_voice_limits.requests+1 end returning * into quota;
 if quota.requests>30 then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
 insert into public.trip_voice_state(trip_id) values(p_trip_id) on conflict do nothing;
 select * into state from public.trip_voice_state where trip_id=p_trip_id for update;
 if state.operation_id is not null and state.operation_until>now() then raise exception 'VOICE_BUSY' using errcode='P0001'; end if;
 if state.operation_id is not null or state.speaker_until<=now() then
  retired:='ridesync-'||p_trip_id::text||'-'||state.room_epoch::text;
  state.room_epoch:=gen_random_uuid();state.epoch_started_at:=now();state.speaker_id:=null;state.speaker_kind:=null;state.speaker_until:=null;state.ready:=false;state.operation_id:=null;state.operation_until:=null;
 end if;
 select * into alert from public.trip_sos_alerts where trip_id=p_trip_id and resolved_at is null and expires_at>now();
 if p_action in ('stop','leave') and state.speaker_id is distinct from p_actor then
  return jsonb_build_object('access',true,'room','ridesync-'||p_trip_id::text||'-'||state.room_epoch::text);
 end if;
 if p_action in ('join','heartbeat') then
  if p_action='heartbeat' and state.speaker_id=p_actor and state.speaker_kind='organizer' and alert.raised_by is null then
   state.speaker_until:=now()+interval '45 seconds';
  end if;
  update public.trip_voice_state set room_epoch=state.room_epoch,epoch_started_at=state.epoch_started_at,speaker_id=state.speaker_id,speaker_kind=state.speaker_kind,
   speaker_until=state.speaker_until,ready=state.ready,operation_id=state.operation_id,operation_until=state.operation_until where trip_id=p_trip_id;
  return jsonb_build_object('access',true,'room','ridesync-'||p_trip_id::text||'-'||state.room_epoch::text,'retired_room',retired,
   'can_publish',coalesce(state.ready and state.speaker_id=p_actor and state.speaker_until>now() and
    (alert.raised_by is null or (state.speaker_kind='sos' and alert.raised_by=p_actor)),false));
 end if;
 if p_action='speak' then
  if current_trip.created_by<>p_actor then raise exception 'Forbidden' using errcode='42501'; end if;
  if alert.raised_by is not null then raise exception 'SOS_ALREADY_ACTIVE' using errcode='P0001'; end if;
  state.speaker_id:=p_actor;state.speaker_kind:='organizer';state.speaker_until:=now()+interval '45 seconds';
 elsif p_action='sos' then
  if alert.raised_by is distinct from p_actor then raise exception 'Forbidden' using errcode='42501'; end if;
  state.speaker_id:=p_actor;state.speaker_kind:='sos';state.speaker_until:=alert.expires_at;
 elsif p_action in ('stop','leave') and state.speaker_id=p_actor then
  state.speaker_id:=null;state.speaker_kind:=null;state.speaker_until:=null;
 elsif p_action='heartbeat' and state.speaker_id=p_actor and state.speaker_kind='organizer' and alert.raised_by is null then
  state.speaker_until:=now()+interval '45 seconds';
 end if;
 if (alert.raised_by is not null and state.speaker_kind='organizer') or
    (state.speaker_kind='sos' and alert.raised_by is distinct from state.speaker_id) then
  state.speaker_id:=null;state.speaker_kind:=null;state.speaker_until:=null;
 end if;
 retired:=coalesce(retired,'ridesync-'||p_trip_id::text||'-'||state.room_epoch::text);
 state.room_epoch:=gen_random_uuid();state.epoch_started_at:=now();
 op:=gen_random_uuid();
 update public.trip_voice_state set room_epoch=state.room_epoch,epoch_started_at=state.epoch_started_at,speaker_id=state.speaker_id,speaker_kind=state.speaker_kind,
  speaker_until=state.speaker_until,ready=false,operation_id=op,operation_until=now()+interval '25 seconds' where trip_id=p_trip_id;
 return jsonb_build_object('operation_id',op,'room','ridesync-'||p_trip_id::text||'-'||state.room_epoch::text,'retired_room',retired,'speaker_id',state.speaker_id);
end;
$$;
create function public.finish_trip_voice_operation(p_trip_id uuid,p_operation_id uuid,p_success boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.trips where id=p_trip_id and status='active' for update;
 if not found then return false; end if;
 if p_success then
  update public.trip_voice_state set ready=true,operation_id=null,operation_until=null
   where trip_id=p_trip_id and operation_id=p_operation_id and operation_until>now();
 else
  update public.trip_voice_state set room_epoch=gen_random_uuid(),epoch_started_at=now(),speaker_id=null,speaker_kind=null,speaker_until=null,
   ready=false,operation_id=null,operation_until=null where trip_id=p_trip_id and operation_id=p_operation_id;
 end if;
 return found;
end;
$$;
create function public.close_trip_voice_on_finish() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'active' and old.status='active' then
  delete from public.trip_sos_alerts where trip_id=new.id;
  delete from public.trip_voice_state where trip_id=new.id;
 end if;
 return new;
end;
$$;
revoke all on function public.close_trip_voice_on_finish() from public,anon,authenticated;
create trigger close_trip_voice after update of status on public.trips for each row execute function public.close_trip_voice_on_finish();
revoke all on function public.raise_trip_sos(uuid,text),public.resolve_trip_sos(uuid),public.trip_voice_snapshot(uuid) from public,anon;
grant execute on function public.raise_trip_sos(uuid,text),public.resolve_trip_sos(uuid),public.trip_voice_snapshot(uuid) to authenticated;
revoke all on function public.begin_trip_voice_operation(uuid,uuid,text),public.finish_trip_voice_operation(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.begin_trip_voice_operation(uuid,uuid,text),public.finish_trip_voice_operation(uuid,uuid,boolean) to service_role;
commit;
