-- Issue 4 (revised) -- RLS enablement + admin_users
--
-- Written against the REAL production schema (confirmed via
-- information_schema / pg_constraint / pg_indexes / pg_policies queries
-- against the live Supabase project on 2026-07-30), not the empty
-- database/schema.sql placeholder. Additive only -- does not touch any
-- existing table, column, constraint, or index. Matches the style of
-- database/admin_panel_migration.sql (the one real prior migration).
--
-- What this migration does NOT need to do, because it's already real and
-- correct in production:
--   - chat.sessions / chat.messages / user_db.subscriptions /
--     user_db.user_profiles / public.contact_messages /
--     public.travel_knowledge: all exist, all correctly constrained/indexed.
--   - public.match_travel_knowledge: already correct, richer than what an
--     earlier draft of this migration assumed.
--
-- What it does fix, confirmed as real gaps via direct inspection:
--   - RLS was disabled (relrowsecurity = false) on all 7 tables. Confirmed
--     nothing else queries these tables except the backend's service-role
--     client (grepped frontend, mlops_service -- no anon-key usage
--     anywhere), so enabling RLS here is safe: it changes nothing until
--     Issue 2 actually switches a route to the request-scoped client.
--   - user_db.admin_users does not exist at all.
--
-- Ownership derivation: production already computes
-- account_id = uuid5(NAMESPACE_DNS, clerk_user_id) in Python
-- (payment_routes.py::_clerk_user_id + uuid.uuid5), keyed off the JWT
-- `sub` claim. Verified Postgres's uuid_generate_v5(uuid_ns_dns(), sub)
-- produces an IDENTICAL uuid to Python's uuid.uuid5 for the same input
-- (checked directly: both produced cc579667-30f5-509f-aa65-05a57444aff2
-- for the same test string) -- so RLS can derive account_id straight from
-- the Clerk JWT without a stored clerk_user_id->account_id mapping table.

create extension if not exists "uuid-ossp";

-- Supabase provisions anon/authenticated automatically; guarded here only
-- for portability (e.g. running this against a non-Supabase Postgres for
-- testing).
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

-- Reusable helper: the authenticated caller's account_id, derived from the
-- Clerk JWT's `sub` claim the same way the backend already computes it.
-- STABLE (not IMMUTABLE) because it reads the per-request JWT via
-- auth.jwt(). Wrapped in `(select ...)` at each call site per Supabase's
-- documented RLS performance guidance, so the planner caches it once per
-- statement instead of re-evaluating per row.
create or replace function public.current_account_id()
returns uuid
language sql
stable
as $$
  select uuid_generate_v5(uuid_ns_dns(), auth.jwt()->>'sub');
$$;

-- =======================================================================
-- user_db.admin_users -- genuinely missing in production, confirmed.
-- Keyed on account_id to match this project's real convention (not
-- clerk_user_id -- an earlier draft of this migration assumed the wrong
-- anchor column before the live schema was inspected). Schema-only for
-- now: nothing in the codebase reads/writes this table yet. No
-- authenticated/anon policies on purpose -- default deny, service-role
-- only, until a follow-up issue wires require_admin() in core/auth.py to
-- check it.
-- =======================================================================
create table if not exists user_db.admin_users (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null unique references user_db.user_profiles(account_id),
  granted_by    text,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz
);

alter table user_db.admin_users enable row level security;
-- Intentionally no policies.

-- =======================================================================
-- Grants -- required before RLS policies are evaluated. Supabase grants
-- these automatically for `public`, but not for custom schemas
-- (`chat`, `user_db`). Verified by hand in an earlier draft of this work:
-- without these, every authenticated-role query fails with
-- "permission denied for schema chat" regardless of RLS policy content.
-- =======================================================================
grant usage on schema chat to authenticated;
grant usage on schema user_db to authenticated;
-- Supabase grants `usage on schema auth` to authenticated/anon
-- automatically as part of platform provisioning -- explicit here anyway,
-- since current_account_id() calling auth.jwt() fails with "permission
-- denied for schema auth" without it, confirmed while testing this
-- migration. Harmless/idempotent if already granted.
grant usage on schema auth to authenticated, anon;

grant select, insert, update, delete on chat.sessions to authenticated;
grant select, insert, update, delete on chat.messages to authenticated;

grant select, update on user_db.user_profiles to authenticated;
grant select on user_db.subscriptions to authenticated;
-- user_db.admin_users: no grant -- service-role only.

grant insert on public.contact_messages to anon, authenticated;
grant select on public.travel_knowledge to anon, authenticated;

-- =======================================================================
-- RLS policies
-- =======================================================================

alter table chat.sessions enable row level security;

drop policy if exists "sessions_owner_all" on chat.sessions;
create policy "sessions_owner_all"
  on chat.sessions for all
  to authenticated
  using (account_id = (select public.current_account_id()))
  with check (account_id = (select public.current_account_id()));
-- Note: account_id is nullable today (guest/device_id-only sessions).
-- account_id = <uuid> is false, never true, when account_id is null, so
-- guest sessions are correctly invisible via this RLS path -- they remain
-- reachable only through the service-role client's existing device_id
-- logic, unchanged by this migration. Issue 2 is what actually backfills
-- and enforces account_id going forward.

alter table chat.messages enable row level security;

drop policy if exists "messages_owner_all" on chat.messages;
create policy "messages_owner_all"
  on chat.messages for all
  to authenticated
  using (
    exists (
      select 1 from chat.sessions s
      where s.id = messages.session_id
        and s.account_id = (select public.current_account_id())
    )
  )
  with check (
    exists (
      select 1 from chat.sessions s
      where s.id = messages.session_id
        and s.account_id = (select public.current_account_id())
    )
  );

alter table user_db.user_profiles enable row level security;

drop policy if exists "profiles_select_own" on user_db.user_profiles;
create policy "profiles_select_own"
  on user_db.user_profiles for select
  to authenticated
  using (account_id = (select public.current_account_id()));

drop policy if exists "profiles_update_own" on user_db.user_profiles;
create policy "profiles_update_own"
  on user_db.user_profiles for update
  to authenticated
  using (account_id = (select public.current_account_id()))
  with check (account_id = (select public.current_account_id()));

alter table user_db.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on user_db.subscriptions;
create policy "subscriptions_select_own"
  on user_db.subscriptions for select
  to authenticated
  using (account_id = (select public.current_account_id()));
-- No write policies: subscriptions are only ever written by
-- payment_routes.py / the Razorpay webhook, via the service-role client.

alter table public.contact_messages enable row level security;

drop policy if exists "contact_messages_insert_public" on public.contact_messages;
create policy "contact_messages_insert_public"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);
-- No select policy: POST /contact has no auth dependency (confirmed by
-- reading contact_routes.py) -- write-only from the public's perspective.
-- Admin reads happen via admin_routes.py using the service-role client.

alter table public.travel_knowledge enable row level security;

drop policy if exists "travel_knowledge_select_public" on public.travel_knowledge;
create policy "travel_knowledge_select_public"
  on public.travel_knowledge for select
  to anon, authenticated
  using (true);
-- No write policies: ingestion is a service-role-only pipeline
-- (vector_store_service.py::insert_chunk).
