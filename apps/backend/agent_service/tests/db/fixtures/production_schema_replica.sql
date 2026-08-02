-- Test-only replica of the real production schema.
--
-- NOT a source of truth -- the real production schema was built
-- directly via the Supabase console (confirmed 2026-07-31 via
-- information_schema/pg_constraint/pg_indexes queries against the
-- live project), not from a committed schema.sql (which remains an
-- empty Phase 0 placeholder). This file exists purely so CI has a
-- blank-database starting point to apply the REAL migration files
-- (rls_and_admin_users_migration.sql, share_token_hashing_migration.sql)
-- against and verify they work correctly -- exactly the manual
-- verification already done by hand before those migrations were
-- ever shipped, now formalized into a repeatable, committed test.
--
-- Column shapes match the real information_schema output exactly, not
-- a guess.

create extension if not exists vector;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create schema if not exists chat;
create schema if not exists user_db;

create table user_db.user_profiles (
  account_id uuid primary key,
  email text not null unique,
  full_name text,
  tier text check (tier in ('free','premium')),
  created_at timestamptz,
  updated_at timestamptz
);

create table user_db.subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  plan_name text not null,
  status text not null check (status in ('pending','active','expired','cancelled')),
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  amount numeric not null,
  currency text not null,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  clerk_user_id text
);

create table chat.sessions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  account_id uuid,
  title text not null,
  status text not null check (status in ('active','archived','deleted')),
  pinned boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chat.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat.sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  trip_data jsonb,
  created_at timestamptz not null default now(),
  share_token text
);
create unique index idx_chat_messages_share_token on chat.messages(share_token) where share_token is not null;

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now(),
  status text not null check (status in ('new','in_progress','resolved'))
);

create table public.travel_knowledge (
  id uuid primary key default gen_random_uuid(),
  chunk_id text not null unique,
  title text not null,
  category text not null,
  source_file text not null,
  chunk_index integer not null,
  version integer not null,
  content text not null,
  embedding vector(384) not null,
  created_at timestamptz,
  updated_at timestamptz
);

create or replace function public.match_travel_knowledge(query_embedding vector, match_count integer default 5)
 returns table(id uuid, chunk_id text, title text, category text, source_file text, chunk_index integer, version integer, content text, similarity double precision)
 language sql
as $function$
SELECT id, chunk_id, title, category, source_file, chunk_index, version, content,
       1 - (embedding <=> query_embedding) AS similarity
FROM travel_knowledge
ORDER BY embedding <=> query_embedding
LIMIT match_count;
$function$;

-- Supabase provisions these automatically in real environments; a
-- genuinely blank Postgres (like CI's) needs them created explicitly.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb
$$;
grant usage on schema auth to authenticated, anon;
