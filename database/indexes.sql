-- TravelMaster V2 Database Indexes
--
-- Corrected 2026-08-03 (Issue 11) -- previously indexed clerk_user_id,
-- the same superseded-draft column schema.sql was corrected from. Real
-- queries (chat_service.py) filter/order by account_id.
-- Run after schema.sql.

-- chat.sessions -- sidebar list is queried per-owner, ordered by
-- pinned-then-recent (confirmed shape in chat_service.py); device_id
-- kept indexed for both guest-session lookups (Issue 1) and the
-- claim-on-login migration path (Issue 2), not for authorization itself.
create index if not exists sessions_account_id_idx
  on chat.sessions (account_id);

create index if not exists sessions_owner_sidebar_idx
  on chat.sessions (account_id, pinned desc, last_message_at desc)
  where status = 'active';

create index if not exists sessions_device_id_idx
  on chat.sessions (device_id);

-- chat.messages -- thread is always fetched by session, ordered by time
create index if not exists messages_session_id_idx
  on chat.messages (session_id);

create index if not exists messages_session_created_idx
  on chat.messages (session_id, created_at);

-- user_db.subscriptions -- looked up by owner (billing/quota checks).
-- razorpay_order_id / razorpay_payment_id already have unique indexes
-- from their UNIQUE constraints in schema.sql, not duplicated here.
create index if not exists subscriptions_account_id_idx
  on user_db.subscriptions (account_id);

-- public.contact_messages -- status index created idempotently by
-- admin_panel_migration.sql; not duplicated here.

-- public.travel_knowledge -- vector similarity index for the RAG
-- pipeline. HNSW chosen over IVFFlat: no training/list-count tuning
-- needed and better recall at query time, which matters more than build
-- time for a knowledge base this size (curated destination guides, not
-- bulk corpus).
create index if not exists travel_knowledge_embedding_hnsw_idx
  on public.travel_knowledge
  using hnsw (embedding vector_cosine_ops);

create index if not exists travel_knowledge_category_idx
  on public.travel_knowledge (category);
