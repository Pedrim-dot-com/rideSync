begin;
-- Members propose invitations; leaders approve them before delivery. A leader
-- may invite directly. Only the recipient's acceptance creates membership.
create table public.group_invitations (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.motard_groups(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 invited_by uuid references public.profiles(id) on delete set null,
 approved_by uuid references public.profiles(id) on delete set null,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 status text not null default 'review' check(status in ('review','pending','accepted','declined','revoked','expired','rejected')),
 responded_at timestamptz,
 check(expires_at>created_at and isfinite(expires_at)),
 check(approved_at is null or approved_at>=created_at),
 check(status not in ('pending','accepted','declined') or approved_at is not null),
 check(status<>'review' or approved_at is null),
 check((status in ('review','pending') and responded_at is null) or (status not in ('review','pending') and responded_at is not null))
);
create unique index group_invitations_pending_idx on public.group_invitations(group_id,recipient_id) where status in ('review','pending');
create index group_invitations_recipient_idx on public.group_invitations(recipient_id,created_at desc);
create index group_invitations_group_created_idx on public.group_invitations(group_id,created_at desc);
alter table public.group_invitations enable row level security;
revoke all on public.group_invitations from public,anon,authenticated;

create function public.invite_group_member(p_group_id uuid,p_username text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid; invitation public.group_invitations; leader boolean; new_id uuid;
begin
 perform 1 from public.motard_groups where id=p_group_id for update;
 if not found or not exists(select 1 from public.group_memberships m where m.group_id=p_group_id and m.user_id=auth.uid() and m.status='accepted') then raise exception 'Forbidden' using errcode='42501'; end if;
 leader:=public.is_group_leader(p_group_id);
 if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,30}$' then raise exception 'GROUP_RECIPIENT_UNAVAILABLE' using errcode='P0001'; end if;
 select id into target from public.profiles where username=p_username for update;
 if not found or target=auth.uid() or exists(select 1 from public.group_memberships where user_id=target and status in ('accepted','pending')) then
  raise exception 'GROUP_RECIPIENT_UNAVAILABLE' using errcode='P0001';
 end if;
 update public.group_invitations set status='expired',responded_at=now()
 where group_id=p_group_id and recipient_id=target and status in ('review','pending') and expires_at<=now();
 select * into invitation from public.group_invitations where group_id=p_group_id and recipient_id=target and status in ('review','pending');
 if found then
  if leader and invitation.status='review' then
   update public.group_invitations set status='pending',approved_by=auth.uid(),approved_at=now(),expires_at=now()+interval '7 days' where id=invitation.id;
  end if;
  return invitation.id;
 end if;
 if (select count(*) from public.group_invitations where group_id=p_group_id and created_at>now()-interval '1 minute')>=10
 or (select count(*) from public.group_invitations where group_id=p_group_id and created_at>now()-interval '1 day')>=50 then
  raise exception 'GROUP_INVITATION_RATE_LIMITED' using errcode='P0001';
 end if;
 insert into public.group_invitations(group_id,recipient_id,invited_by,status,approved_by,approved_at)
 values(p_group_id,target,auth.uid(),case when leader then 'pending' else 'review' end,
  case when leader then auth.uid() else null end,case when leader then now() else null end) returning id into new_id;
 return new_id;
end;
$$;

create function public.review_group_invitation(p_group_id uuid,p_invitation_id uuid,p_approve boolean) returns void
language plpgsql security definer set search_path='' as $$
declare invitation public.group_invitations;
begin
 perform 1 from public.motard_groups where id=p_group_id for update;
 if not found or not public.is_group_leader(p_group_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into invitation from public.group_invitations where id=p_invitation_id and group_id=p_group_id;
 if not found or p_approve is null or invitation.status<>'review' or invitation.expires_at<=now() then
  raise exception 'GROUP_INVITATION_UNAVAILABLE' using errcode='P0001';
 end if;
 perform 1 from public.profiles where id=invitation.recipient_id for update;
 if p_approve and exists(select 1 from public.group_memberships where user_id=invitation.recipient_id and status in ('accepted','pending')) then
  raise exception 'GROUP_RECIPIENT_UNAVAILABLE' using errcode='P0001';
 end if;
 update public.group_invitations set status=case when p_approve then 'pending' else 'rejected' end,
  approved_by=case when p_approve then auth.uid() else null end,approved_at=case when p_approve then now() else null end,
  responded_at=case when p_approve then null else now() end,
  expires_at=case when p_approve then now()+interval '7 days' else expires_at end where id=p_invitation_id;
end;
$$;

create function public.list_sent_group_invitations(p_group_id uuid)
returns table(invitation_id uuid,display_name text,username text,created_at timestamptz,expires_at timestamptz,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.group_memberships m where m.group_id=p_group_id and m.user_id=auth.uid() and m.status='accepted') then raise exception 'Forbidden' using errcode='42501'; end if;
 return query select i.id,p.display_name,p.username,i.created_at,i.expires_at,
 case when i.status='accepted' then case
      when exists(select 1 from public.group_memberships m where m.group_id=i.group_id and m.user_id=i.recipient_id and m.status='accepted') then 'joined'
      when exists(select 1 from public.group_memberships m where m.group_id=i.group_id and m.user_id=i.recipient_id and m.status='left') then 'left'
      else 'accepted' end
      when i.status not in ('review','pending') then i.status when i.expires_at<=now() then 'expired'
      when exists(select 1 from public.group_memberships m where m.user_id=i.recipient_id and m.status='accepted' and m.group_id=i.group_id) then 'joined'
      when exists(select 1 from public.group_memberships m where m.user_id=i.recipient_id and m.status in ('accepted','pending') and (m.group_id<>i.group_id or i.status='review')) then 'unavailable'
      else i.status end
 from public.group_invitations i join public.profiles p on p.id=i.recipient_id
 where i.group_id=p_group_id and (i.invited_by=auth.uid() or public.is_group_leader(p_group_id)) order by i.created_at desc,i.id;
end;
$$;
create function public.revoke_group_invitation(p_group_id uuid,p_invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.motard_groups where id=p_group_id for update;
 if not found or not exists(select 1 from public.group_memberships m where m.group_id=p_group_id and m.user_id=auth.uid() and m.status='accepted') then raise exception 'Forbidden' using errcode='42501'; end if;
 update public.group_invitations set status='revoked',responded_at=now()
 where id=p_invitation_id and group_id=p_group_id and status in ('review','pending') and expires_at>now()
 and (invited_by=auth.uid() or public.is_group_leader(p_group_id));
 if not found then raise exception 'GROUP_INVITATION_UNAVAILABLE' using errcode='P0001'; end if;
end;
$$;

create function public.list_received_group_invitations()
returns table(invitation_id uuid,group_id uuid,group_name text,inviter_name text,created_at timestamptz,expires_at timestamptz,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return query select i.id,i.group_id,g.name,coalesce(nullif(p.display_name,''),'Um membro'),i.created_at,i.expires_at,
 case when i.status='accepted' then case
      when exists(select 1 from public.group_memberships m where m.group_id=i.group_id and m.user_id=auth.uid() and m.status='accepted') then 'joined'
      when exists(select 1 from public.group_memberships m where m.group_id=i.group_id and m.user_id=auth.uid() and m.status='left') then 'left'
      else 'accepted' end
      when i.status<>'pending' then i.status when i.expires_at<=now() then 'expired'
      when exists(select 1 from public.group_memberships m where m.user_id=auth.uid() and m.status='accepted' and m.group_id=i.group_id) then 'joined'
      when exists(select 1 from public.group_memberships m where m.user_id=auth.uid() and m.status in ('accepted','pending') and m.group_id<>i.group_id) then 'unavailable'
      when not exists(select 1 from public.group_memberships m where m.group_id=i.group_id and m.status='accepted' and m.role='leader') then 'unavailable'
      else 'pending' end
 from public.group_invitations i join public.motard_groups g on g.id=i.group_id
 left join public.profiles p on p.id=i.invited_by
 where i.recipient_id=auth.uid() and i.approved_at is not null order by i.created_at desc,i.id;
end;
$$;

create function public.respond_group_invitation(p_invitation_id uuid,p_accept boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare target_group uuid; invitation public.group_invitations;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select group_id into target_group from public.group_invitations where id=p_invitation_id and recipient_id=auth.uid();
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.motard_groups where id=target_group for update;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into invitation from public.group_invitations where id=p_invitation_id and recipient_id=auth.uid() for update;
 if not found or p_accept is null or invitation.status<>'pending' or invitation.approved_at is null or invitation.expires_at<=now() then
  raise exception 'GROUP_INVITATION_UNAVAILABLE' using errcode='P0001';
 end if;
 if p_accept then
  if not exists(select 1 from public.group_memberships where group_id=target_group and status='accepted' and role='leader') then
   raise exception 'GROUP_INVITATION_UNAVAILABLE' using errcode='P0001';
  end if;
  if exists(select 1 from public.group_memberships where user_id=auth.uid() and
   (status='accepted' or (status='pending' and group_id<>target_group))) then
   raise exception 'GROUP_MEMBERSHIP_EXISTS' using errcode='P0001';
  end if;
  insert into public.group_memberships(group_id,user_id,role,status) values(target_group,auth.uid(),'member','accepted')
  on conflict(group_id,user_id) do update set role='member',status='accepted',updated_at=now();
 end if;
 update public.group_invitations set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now() where id=p_invitation_id;
 if p_accept then return target_group; end if;
 return null;
end;
$$;
revoke all on function public.invite_group_member(uuid,text),public.review_group_invitation(uuid,uuid,boolean),public.list_sent_group_invitations(uuid),public.revoke_group_invitation(uuid,uuid),public.list_received_group_invitations(),public.respond_group_invitation(uuid,boolean) from public,anon;
grant execute on function public.invite_group_member(uuid,text),public.review_group_invitation(uuid,uuid,boolean),public.list_sent_group_invitations(uuid),public.revoke_group_invitation(uuid,uuid),public.list_received_group_invitations(),public.respond_group_invitation(uuid,boolean) to authenticated;
commit;
