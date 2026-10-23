begin;
-- Invitation secrets are returned once; only their SHA-256 hashes are retained.
create table public.trip_invitations (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
 invited_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '48 hours'),
 used_by uuid references public.profiles(id),
 used_at timestamptz,
 response text check (response in ('accepted','declined')),
 revoked_at timestamptz,
 check (expires_at > created_at and isfinite(expires_at)),
 check ((used_at is null and used_by is null and response is null) or
        (used_at is not null and used_by is not null and response is not null))
);
create index trip_invitations_trip_idx on public.trip_invitations(trip_id);
create index trip_invitations_sender_created_idx on public.trip_invitations(invited_by,created_at);
alter table public.trip_invitations enable row level security;
-- No client access to raw invitations, including token hashes. Narrow RPCs only.
revoke all on public.trip_invitations from public,anon,authenticated;

create function public.create_trip_invitation(p_trip_id uuid)
returns table(invitation_id uuid,token text,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare current_trip public.trips; secret text; new_id uuid; expiry timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- Serializes the per-sender quota across different trips, before the trip lock.
 perform pg_advisory_xact_lock(hashtextextended('trip-invitations:' || auth.uid()::text,0));
 select * into current_trip from public.trips where id=p_trip_id and created_by=auth.uid() for update;
 if not found then raise exception 'Trip unavailable' using errcode='42501'; end if;
 if current_trip.status not in ('draft','planned') then raise exception 'Trip locked' using errcode='55000'; end if;
 if (select count(*) from public.trip_invitations i where i.invited_by=auth.uid() and i.created_at > now()-interval '24 hours') >= 30
 or (select count(*) from public.trip_invitations i where i.trip_id=p_trip_id and i.created_at > now()-interval '24 hours') >= 10 then
  raise exception 'INVITATION_RATE_LIMITED' using errcode='P0001';
 end if;
 -- Two independent v4 UUIDs provide 244 random bits; no pgcrypto dependency.
 secret := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
 insert into public.trip_invitations(trip_id,token_hash,invited_by)
 values(p_trip_id,encode(sha256(convert_to(secret,'UTF8')),'hex'),auth.uid())
 returning id,trip_invitations.expires_at into new_id,expiry;
 return query select new_id,secret,expiry;
end;
$$;

create function public.list_trip_invitations(p_trip_id uuid)
returns table(invitation_id uuid,created_at timestamptz,expires_at timestamptz,used_at timestamptz,response text,revoked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.trips t where t.id=p_trip_id and t.created_by=auth.uid()) then
  raise exception 'Trip unavailable' using errcode='42501';
 end if;
 return query select i.id,i.created_at,i.expires_at,i.used_at,i.response,i.revoked_at
 from public.trip_invitations i where i.trip_id=p_trip_id order by i.created_at desc,i.id;
end;
$$;

create function public.revoke_trip_invitation(p_trip_id uuid,p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.trips t where t.id=p_trip_id and t.created_by=auth.uid() for update;
 if not found then raise exception 'Trip unavailable' using errcode='42501'; end if;
 update public.trip_invitations set revoked_at=coalesce(revoked_at,now())
 where id=p_invitation_id and trip_id=p_trip_id and used_at is null;
end;
$$;

create function public.respond_trip_invitation(p_token text,p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.trip_invitations; target_trip uuid; current_trip public.trips;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_accept is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' then
  raise exception 'INVITATION_UNAVAILABLE' using errcode='P0001';
 end if;
 select i.trip_id into target_trip from public.trip_invitations i
 where i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if not found then raise exception 'INVITATION_UNAVAILABLE' using errcode='P0001'; end if;
 -- Same lock order as edits/revocation; concurrent acceptors cannot share a token.
 select * into current_trip from public.trips where id=target_trip for update;
 select * into invitation from public.trip_invitations i
 where i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or invitation.revoked_at is not null or invitation.used_at is not null
 or invitation.expires_at <= now() or current_trip.status not in ('draft','planned') then
  raise exception 'INVITATION_UNAVAILABLE' using errcode='P0001';
 end if;
 if exists(select 1 from public.trip_participants p where p.trip_id=target_trip and p.user_id=auth.uid() and p.status='accepted') then
  raise exception 'ALREADY_PARTICIPATING' using errcode='P0001';
 end if;
 insert into public.trip_participants(trip_id,user_id,role,status,joined_at)
 values(target_trip,auth.uid(),'rider',case when p_accept then 'accepted' else 'declined' end,now())
 on conflict(trip_id,user_id) do update set status=excluded.status,motorcycle_id=null,joined_at=excluded.joined_at;
 update public.trip_invitations set used_by=auth.uid(),used_at=now(),response=case when p_accept then 'accepted' else 'declined' end
 where id=invitation.id;
 if p_accept then return target_trip; end if;
 return null;
end;
$$;

-- Share only the accepted participants' public names and their selected bike.
-- Raw profile and garage RLS stays private; no email, full garage or coordinates.
create function public.list_trip_members(p_trip_id uuid)
returns table(user_id uuid,role text,display_name text,username text,motorcycle_brand text,motorcycle_model text)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.can_read_trip(p_trip_id) then raise exception 'Trip unavailable' using errcode='42501'; end if;
 return query select p.user_id,p.role,pr.display_name,pr.username,m.brand,m.model
 from public.trip_participants p join public.profiles pr on pr.id=p.user_id
 left join public.motorcycles m on m.id=p.motorcycle_id and m.user_id=p.user_id
 where p.trip_id=p_trip_id and p.status='accepted'
 order by (p.role='organizer') desc,p.joined_at,p.user_id;
end;
$$;

create function public.set_trip_motorcycle(p_trip_id uuid,p_motorcycle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare current_trip public.trips;
begin
 select * into current_trip from public.trips where id=p_trip_id for update;
 if not found or not public.can_read_trip(p_trip_id) then raise exception 'Trip unavailable' using errcode='42501'; end if;
 if current_trip.status not in ('draft','planned') then raise exception 'Trip locked' using errcode='55000'; end if;
 if p_motorcycle_id is not null then
  -- Keep ownership stable until the association commits; deletion later sets null.
  perform 1 from public.motorcycles m where m.id=p_motorcycle_id and m.user_id=auth.uid() for key share;
  if not found then raise exception 'Motorcycle unavailable' using errcode='42501'; end if;
 end if;
 update public.trip_participants set motorcycle_id=p_motorcycle_id
 where trip_id=p_trip_id and user_id=auth.uid() and status='accepted';
end;
$$;

revoke all on function public.create_trip_invitation(uuid),public.list_trip_invitations(uuid),
 public.revoke_trip_invitation(uuid,uuid),public.respond_trip_invitation(text,boolean),
 public.list_trip_members(uuid),public.set_trip_motorcycle(uuid,uuid) from public,anon;
grant execute on function public.create_trip_invitation(uuid),public.list_trip_invitations(uuid),
 public.revoke_trip_invitation(uuid,uuid),public.respond_trip_invitation(text,boolean),
 public.list_trip_members(uuid),public.set_trip_motorcycle(uuid,uuid) to authenticated;
commit;
