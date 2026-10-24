begin;
create table public.motard_groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 3 and 100),
 description text not null default '' check(length(description)<=1000),
 legal_name text not null default '' check(length(legal_name)<=160),
 registration_number text not null default '' check(length(registration_number)<=80),
 headquarters_address text not null check(length(trim(headquarters_address)) between 3 and 240),
 latitude double precision not null check(latitude between -90 and 90 and latitude<>'NaN'::float8),
 longitude double precision not null check(longitude between -180 and 180 and longitude<>'NaN'::float8),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1 check(revision>0)
);
create table public.group_memberships (
 group_id uuid not null references public.motard_groups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null default 'member' check(role in ('member','leader')),
 status text not null check(status in ('pending','accepted','declined','left')),
 updated_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create unique index one_motard_group_per_user on public.group_memberships(user_id) where status='accepted';
create unique index one_group_request_per_user on public.group_memberships(user_id) where status='pending';
create index group_memberships_group_status_idx on public.group_memberships(group_id,status);
alter table public.motard_groups enable row level security;
alter table public.group_memberships enable row level security;
revoke all on public.motard_groups,public.group_memberships from public,anon,authenticated;
grant select(id,name,description,legal_name,registration_number,headquarters_address,latitude,longitude,created_at,updated_at,revision) on public.motard_groups to authenticated;
grant select on public.group_memberships to authenticated;
create function public.is_group_leader(p_group_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_memberships where group_id=p_group_id and user_id=auth.uid() and status='accepted' and role='leader');
$$;
revoke all on function public.is_group_leader(uuid) from public,anon;
grant execute on function public.is_group_leader(uuid) to authenticated;
create policy groups_directory_read on public.motard_groups for select to authenticated using(true);
create policy group_memberships_private_read on public.group_memberships for select to authenticated
 using(user_id=auth.uid() or public.is_group_leader(group_id));

create function public.save_motard_group(p_group_id uuid,p_revision integer,p_name text,p_description text,
 p_legal_name text,p_registration_number text,p_address text,p_latitude double precision,p_longitude double precision)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid; current_group public.motard_groups;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_group_id is null then
  -- Same user lock is used for requests/approval across different groups.
  perform 1 from public.profiles where id=auth.uid() for update;
  if exists(select 1 from public.group_memberships where user_id=auth.uid() and status in ('accepted','pending')) then
   raise exception 'GROUP_MEMBERSHIP_EXISTS' using errcode='P0001';
  end if;
  if (select count(*) from public.motard_groups where created_by=auth.uid() and created_at>now()-interval '1 day')>=3 then
   raise exception 'GROUP_RATE_LIMITED' using errcode='P0001';
  end if;
  insert into public.motard_groups(name,description,legal_name,registration_number,headquarters_address,latitude,longitude,created_by)
  values(trim(p_name),trim(p_description),trim(p_legal_name),trim(p_registration_number),trim(p_address),p_latitude,p_longitude,auth.uid()) returning id into target;
  insert into public.group_memberships(group_id,user_id,role,status) values(target,auth.uid(),'leader','accepted');
 else
  select * into current_group from public.motard_groups where id=p_group_id for update;
  if not found or not public.is_group_leader(p_group_id) then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_revision is distinct from current_group.revision then raise exception 'Group changed' using errcode='40001'; end if;
  update public.motard_groups set name=trim(p_name),description=trim(p_description),legal_name=trim(p_legal_name),
   registration_number=trim(p_registration_number),headquarters_address=trim(p_address),latitude=p_latitude,longitude=p_longitude,
   updated_at=now(),revision=revision+1 where id=p_group_id;
  target:=p_group_id;
 end if;
 return target;
end;
$$;

create function public.change_group_membership(p_group_id uuid,p_action text,p_user_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; membership public.group_memberships; self_action boolean;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('request','withdraw','leave','approve','reject','promote','demote','remove') then
  raise exception 'Invalid action' using errcode='22023';
 end if;
 self_action:=p_action in ('request','withdraw','leave');
 target:=case when self_action then auth.uid() else p_user_id end;
 if target is null or (self_action and p_user_id is not null and p_user_id<>auth.uid()) then
  raise exception 'Forbidden' using errcode='42501';
 end if;
 -- Group lock serializes leadership/last-leader checks. Profile lock serializes
 -- membership in different groups; creates only lock the newly created group.
 perform 1 from public.motard_groups where id=p_group_id for update;
 if not found then raise exception 'Group unavailable' using errcode='42501'; end if;
 if not self_action and not public.is_group_leader(p_group_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.profiles where id=target for update;
 if not found then raise exception 'Member unavailable' using errcode='42501'; end if;
 select * into membership from public.group_memberships where group_id=p_group_id and user_id=target;
 if p_action='request' then
  if exists(select 1 from public.group_memberships where user_id=target and status in ('accepted','pending')) then
   raise exception 'GROUP_MEMBERSHIP_EXISTS' using errcode='P0001';
  end if;
  insert into public.group_memberships(group_id,user_id,role,status) values(p_group_id,target,'member','pending')
  on conflict(group_id,user_id) do update set status='pending',role='member',updated_at=now();
  return;
 end if;
 if membership.user_id is null then raise exception 'Member unavailable' using errcode='42501'; end if;
 if p_action in ('approve','reject','withdraw') then
  if membership.status<>'pending' then raise exception 'GROUP_REQUEST_UNAVAILABLE' using errcode='P0001'; end if;
  if p_action='approve' and exists(select 1 from public.group_memberships where user_id=target and status='accepted') then
   raise exception 'GROUP_MEMBERSHIP_EXISTS' using errcode='P0001';
  end if;
  update public.group_memberships set status=case when p_action='approve' then 'accepted' when p_action='reject' then 'declined' else 'left' end,
   role='member',updated_at=now() where group_id=p_group_id and user_id=target;
  return;
 end if;
 if membership.status<>'accepted' then raise exception 'GROUP_REQUEST_UNAVAILABLE' using errcode='P0001'; end if;
 if p_action in ('demote','remove','leave') and membership.role='leader'
 and (select count(*) from public.group_memberships where group_id=p_group_id and status='accepted' and role='leader')<=1 then
  raise exception 'GROUP_LAST_LEADER' using errcode='P0001';
 end if;
 update public.group_memberships set
  status=case when p_action in ('leave','remove') then 'left' else status end,
  role=case when p_action='promote' then 'leader' when p_action='demote' then 'member' else role end,
  updated_at=now() where group_id=p_group_id and user_id=target;
end;
$$;

create function public.list_group_members(p_group_id uuid)
returns table(user_id uuid,display_name text,username text,role text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.group_memberships m where m.group_id=p_group_id and m.user_id=auth.uid() and m.status='accepted') then
  raise exception 'Forbidden' using errcode='42501';
 end if;
 return query select m.user_id,p.display_name,p.username,m.role,m.status
 from public.group_memberships m join public.profiles p on p.id=m.user_id
 where m.group_id=p_group_id and (m.status='accepted' or (m.status='pending' and public.is_group_leader(p_group_id)))
 order by (m.status='pending') desc,(m.role='leader') desc,p.display_name,m.user_id;
end;
$$;
revoke all on function public.save_motard_group(uuid,integer,text,text,text,text,text,double precision,double precision),
 public.change_group_membership(uuid,text,uuid),public.list_group_members(uuid) from public,anon;
grant execute on function public.save_motard_group(uuid,integer,text,text,text,text,text,double precision,double precision),
 public.change_group_membership(uuid,text,uuid),public.list_group_members(uuid) to authenticated;
commit;
