begin;
-- A receipt proves that this account opened the bearer link. No plaintext token
-- is persisted, and receipt creation does not consume the link or join a trip.
create table public.trip_invitation_receipts (
 id uuid primary key default gen_random_uuid(),
 invitation_id uuid not null references public.trip_invitations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 received_at timestamptz not null default now(),
 unique(invitation_id,user_id)
);
create index trip_invitation_receipts_user_idx on public.trip_invitation_receipts(user_id,received_at desc);
alter table public.trip_invitation_receipts enable row level security;
revoke all on public.trip_invitation_receipts from public,anon,authenticated;

create function public.remember_trip_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invitation public.trip_invitations; current_trip public.trips; target_trip uuid; receipt uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
  raise exception 'INVITATION_UNAVAILABLE' using errcode='P0001';
 end if;
 select i.trip_id into target_trip from public.trip_invitations i
 where i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if not found then raise exception 'INVITATION_UNAVAILABLE' using errcode='P0001'; end if;
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
 insert into public.trip_invitation_receipts(invitation_id,user_id) values(invitation.id,auth.uid())
 on conflict(invitation_id,user_id) do update set user_id=excluded.user_id
 returning id into receipt;
 return receipt;
end;
$$;

create function public.respond_invitation_internal(p_invitation_id uuid,p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.trip_invitations; target_trip uuid; current_trip public.trips;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_accept is null or p_invitation_id is null then
  raise exception 'INVITATION_UNAVAILABLE' using errcode='P0001';
 end if;
 select i.trip_id into target_trip from public.trip_invitations i
 where i.id=p_invitation_id;
 if not found then raise exception 'INVITATION_UNAVAILABLE' using errcode='P0001'; end if;
 -- Same lock order as edits/revocation; concurrent acceptors cannot share a token.
 select * into current_trip from public.trips where id=target_trip for update;
 select * into invitation from public.trip_invitations i
 where i.id=p_invitation_id for update;
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

-- Shared implementation is deliberately not executable by API roles.
revoke all on function public.respond_invitation_internal(uuid,boolean) from public,anon,authenticated;

-- Preserve existing clients while serializing both response paths identically.
create or replace function public.respond_trip_invitation(p_token text,p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
  raise exception 'INVITATION_UNAVAILABLE' using errcode='P0001';
 end if;
 select i.id into target from public.trip_invitations i
 where i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 return public.respond_invitation_internal(target,p_accept);
end;
$$;

create function public.respond_received_trip_invitation(p_receipt_id uuid,p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select r.invitation_id into target from public.trip_invitation_receipts r
 where r.id=p_receipt_id and r.user_id=auth.uid();
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 return public.respond_invitation_internal(target,p_accept);
end;
$$;

create function public.list_received_trip_invitations()
returns table(receipt_id uuid,title text,departure_at timestamptz,inviter_name text,
 expires_at timestamptz,received_at timestamptz,status text,trip_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return query select r.id,t.title,t.departure_at,coalesce(nullif(pr.display_name,''),nullif(pr.username,''),'Organizador'),
 i.expires_at,r.received_at,
 case when i.used_by=auth.uid() then i.response
      when i.used_at is not null then 'used'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at<=now() then 'expired'
      when t.status not in ('draft','planned') then 'unavailable'
      when exists(select 1 from public.trip_participants p where p.trip_id=t.id and p.user_id=auth.uid() and p.status='accepted') then 'joined'
      else 'pending' end,
 case when public.can_read_trip(t.id) then t.id else null end
 from public.trip_invitation_receipts r
 join public.trip_invitations i on i.id=r.invitation_id
 join public.trips t on t.id=i.trip_id
 join public.profiles pr on pr.id=i.invited_by
 where r.user_id=auth.uid() order by r.received_at desc,r.id;
end;
$$;
revoke all on function public.remember_trip_invitation(text),public.respond_received_trip_invitation(uuid,boolean),public.list_received_trip_invitations() from public,anon;
grant execute on function public.remember_trip_invitation(text),public.respond_received_trip_invitation(uuid,boolean),public.list_received_trip_invitations() to authenticated;
commit;
