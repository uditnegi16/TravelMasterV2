-- Issue 3 -- share-link token hashing, expiry, revocation
--
-- Additive migration against the real production schema (same
-- convention as rls_and_admin_users_migration.sql). chat.messages
-- already has a `share_token` column (plaintext) with a unique index --
-- confirmed live in production, 2026-07-31. That column is being
-- retired in favor of a hashed token, per the backlog's explicit
-- requirement ("high-entropy tokens stored as hashes"), not dropped
-- outright: any already-issued share links are backfilled below so
-- they keep working under the new hash-based lookup, rather than
-- silently breaking every link anyone has already shared.
--
-- Hash function: sha256, verified to produce IDENTICAL hex output in
-- both Python's hashlib.sha256(...).hexdigest() and Postgres's
-- encode(digest(..., 'sha256'), 'hex') for the same input (checked
-- directly against a real Postgres instance before writing this).

create extension if not exists pgcrypto;

alter table chat.messages
  add column if not exists share_token_hash text,
  add column if not exists share_token_expires_at timestamptz,
  add column if not exists share_token_revoked_at timestamptz;

create unique index if not exists chat_messages_share_token_hash_idx
  on chat.messages (share_token_hash)
  where share_token_hash is not null;

-- Backfill: any message that already has a plaintext share_token gets
-- an equivalent hash + a fresh 7-day expiry from the moment this
-- migration runs (not from whenever the link was originally created,
-- since that timestamp isn't tracked anywhere) -- existing links keep
-- working under the new lookup, just with expiry starting now.
update chat.messages
set
  share_token_hash = encode(digest(share_token, 'sha256'), 'hex'),
  share_token_expires_at = now() + interval '7 days'
where share_token is not null
  and share_token_hash is null;
