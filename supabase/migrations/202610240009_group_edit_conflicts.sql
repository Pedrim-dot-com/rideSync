begin;
-- Expected optimistic conflicts are HTTP 409, not retryable SQL serialization
-- failures (40001). Preserve grants and avoid mutating migration 007.
create or replace function public.save_motard_group(p_group_id uuid,p_revision integer,p_name text,p_description text,
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
  if p_revision is distinct from current_group.revision then raise exception 'GROUP_CHANGED' using errcode='PT409'; end if;
  update public.motard_groups set name=trim(p_name),description=trim(p_description),legal_name=trim(p_legal_name),
   registration_number=trim(p_registration_number),headquarters_address=trim(p_address),latitude=p_latitude,longitude=p_longitude,
   updated_at=now(),revision=revision+1 where id=p_group_id;
  target:=p_group_id;
 end if;
 return target;
end;
$$;

commit;
