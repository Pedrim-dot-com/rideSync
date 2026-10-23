begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
 display_name text not null default '' check (char_length(display_name) <= 80),
 avatar_path text,
 created_at timestamptz not null default now()
);
create table public.motorcycles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 brand text not null check (char_length(trim(brand)) between 1 and 80),
 model text not null check (char_length(trim(model)) between 1 and 120),
 manufacture_year integer check (manufacture_year between 1885 and 2100),
 engine_cc integer check (engine_cc between 1 and 10000),
 color text check (char_length(color) <= 60),
 photo_path text,
 is_primary boolean not null default false,
 created_at timestamptz not null default now()
);
create index motorcycles_user_id_idx on public.motorcycles(user_id);
create unique index motorcycles_one_primary on public.motorcycles(user_id) where is_primary;
alter table public.profiles enable row level security;
alter table public.motorcycles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy motorcycles_select_own on public.motorcycles for select to authenticated using (user_id = (select auth.uid()));
create policy motorcycles_insert_own on public.motorcycles for insert to authenticated with check (user_id = (select auth.uid()));
create policy motorcycles_update_own on public.motorcycles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy motorcycles_delete_own on public.motorcycles for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.profiles, public.motorcycles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username,display_name) on public.profiles to authenticated;
grant select,insert,update,delete on public.motorcycles to authenticated;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id) values (new.id);
 return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Also support projects with existing accounts. Never copy untrusted auth metadata.
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;
create function public.set_primary_motorcycle(motorcycle_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
 if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 -- Serialize changes per owner before touching any motorcycles.
 perform 1 from public.profiles where id = current_user_id for update;
 perform 1 from public.motorcycles where id = motorcycle_id and user_id = current_user_id for update;
 if not found then raise exception 'Motorcycle unavailable' using errcode = '42501'; end if;
 update public.motorcycles set is_primary = false where user_id = current_user_id and is_primary;
 update public.motorcycles set is_primary = true where id = motorcycle_id and user_id = current_user_id;
 if not found then raise exception 'Motorcycle unavailable' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.set_primary_motorcycle(uuid) from public, anon;
grant execute on function public.set_primary_motorcycle(uuid) to authenticated;
commit;
