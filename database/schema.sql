-- TravelMaster V2 Database Schema
--
-- Corrected 2026-08-03 (Issue 11, README/setup-file accuracy pass).
-- The previous version of this file used clerk_user_id directly as the
-- ownership/FK anchor on every table. That was an earlier draft, written
-- before the real production schema was inspected during Issue 4 --
-- database/rls_and_admin_users_migration.sql's own comment documents the
-- correction explicitly: "an earlier draft of this migration assumed the
-- wrong anchor column before the live schema was inspected." This file
-- was never updated to match that correction until now. Running the old
-- version against a fresh database would have produced a schema
-- genuinely incompatible with the real application code (chat_service.py,
-- subscription_service.py, core/auth.py) -- all of which read/write
-- account_id, never clerk_user_id directly, as of tonight's Issues 1-10.
--
-- Column shapes below match the real production schema exactly, verified
-- via information_schema queries against the live Supabase project
-- (2026-07-31), not assumed or re-derived from application code alone.
--
-- Setup order: this file -> indexes.sql -> match_travel_knowledge.sql ->
-- rls_and_admin_users_migration.sql -> share_token_hashing_migration.sql
-- -> admin_panel_migration.sql. RLS policies and user_db.admin_users are
-- deliberately NOT created here -- rls_and_admin_users_migration.sql
-- already does that, is already verified working against production,
-- and this file would only conflict with it if it duplicated that work.

create extension if not exists vector;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create schema if not exists chat;
create schema if not exists user_db;

-- =======================================================================
-- user_db.user_profiles
-- account_id (not clerk_user_id) is the primary key and the anchor every
-- other table's account_id column references -- derived as
-- uuid_generate_v5(uuid_ns_dns(), <clerk sub claim>), the same derivation
-- core/auth.py::get_account_id() and get_clerk_user_id() use, and that
-- rls_and_admin_users_migration.sql's current_account_id() function
-- reproduces server-side for RLS policies.
-- =======================================================================
create table if not exists user_db.user_profiles (
  account_id      uuid primary key,
  email           text not null unique,
  full_name       text,
  tier            text check (tier in ('free', 'premium')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =======================================================================
-- user_db.subscriptions
-- Two-phase status flow (Issue 6): a row is created with status='pending'
-- at Razorpay order-creation time, bound to account_id immediately --
-- this is what closes the account-hijack gap verify_payment used to have
-- (a valid Razorpay signature alone was being treated as sufficient
-- proof of ownership, which it isn't). clerk_user_id is kept alongside
-- account_id for convenience but is nullable and not the ownership
-- anchor. razorpay_payment_id is nullable (not yet set for pending rows)
-- but unique once populated -- multiple pending rows can share a null
-- payment_id without conflict, Postgres treats NULLs as distinct under a
-- unique constraint.
-- =======================================================================
create table if not exists user_db.subscriptions (
  subscription_id       uuid primary key default gen_random_uuid(),
  account_id            uuid not null references user_db.user_profiles(account_id),
  clerk_user_id         text,
  plan_name             text not null,
  status                text not null check (status in ('pending', 'active', 'expired', 'cancelled')),
  razorpay_order_id     text not null unique,
  razorpay_payment_id   text unique,
  amount                numeric not null,
  currency              text not null,
  starts_at             timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- =======================================================================
-- chat.sessions
-- device_id is NOT NULL (always present, browser-generated); account_id
-- is nullable -- a null account_id is a guest-trial session (Issue 1),
-- never claimed by an account, or not yet claimed (claim-on-login). Once
-- claimed, account_id is set and the anonymous access path in
-- chat_service.py::assert_guest_session_owner() stops matching it.
-- =======================================================================
create table if not exists chat.sessions (
  id                uuid primary key default gen_random_uuid(),
  device_id         text not null,
  account_id        uuid references user_db.user_profiles(account_id),
  title             text not null default 'New trip',
  status            text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  pinned            boolean not null default false,
  last_message_at   timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- =======================================================================
-- chat.messages
-- share_token is included directly here (plaintext column + its unique
-- index) -- share_token_hashing_migration.sql assumes this column
-- already exists (its own header comment: "already has a share_token
-- column (plaintext) with a unique index") and only ADDS the
-- share_token_hash/expires_at/revoked_at columns on top plus backfills
-- existing rows. Getting this dependency direction backwards would mean
-- that migration fails outright on a fresh database.
-- =======================================================================
create table if not exists chat.messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references chat.sessions(id) on delete cascade,
  role          text not null check (role in ('user', 'assistant', 'system')),
  content       text not null,
  trip_data     jsonb,
  created_at    timestamptz not null default now(),
  share_token   text
);

create unique index if not exists idx_chat_messages_share_token
  on chat.messages (share_token)
  where share_token is not null;

-- =======================================================================
-- public.contact_messages
-- `status` column is added by admin_panel_migration.sql (idempotent, ADD
-- COLUMN IF NOT EXISTS) -- not duplicated here. That migration must run
-- AFTER this file.
-- =======================================================================
create table if not exists public.contact_messages (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  subject       text not null,
  message       text not null,
  created_at    timestamptz not null default now()
);

-- =======================================================================
-- public.travel_knowledge
-- version is integer (a real version NUMBER, e.g. incremented on
-- knowledge-base updates), not text -- confirmed via information_schema
-- against the live table. embedding dimension is 384, matching the real
-- embedder (sentence-transformers/all-MiniLM-L6-v2), not a guessed 1536
-- (OpenAI) dimension.
-- =======================================================================
create table if not exists public.travel_knowledge (
  id            uuid primary key default gen_random_uuid(),
  chunk_id      text not null unique,
  title         text not null,
  category      text not null,
  source_file   text not null,
  chunk_index   integer not null,
  version       integer not null,
  content       text not null,
  embedding     vector(384) not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
