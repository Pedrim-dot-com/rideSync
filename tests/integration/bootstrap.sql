-- Minimal Supabase auth contract for isolated PostgreSQL RLS tests only.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Local contract for Supabase private Broadcast authorization/DB notifications.
create schema realtime;
create table realtime.messages(id bigint generated always as identity, extension text not null, topic text not null, payload jsonb);
alter table realtime.messages enable row level security;
grant usage on schema realtime to authenticated;
grant select,insert on realtime.messages to authenticated;
grant usage on sequence realtime.messages_id_seq to authenticated;
create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$
 insert into realtime.messages(extension,topic,payload) values('broadcast',topic,payload);
$$;
revoke all on function realtime.send(jsonb,text,text,boolean) from public,anon,authenticated;
