-- Admin Panel — Phase A, Item 4
-- contact_messages didn't previously have a workflow status; the admin
-- panel's Contact Submissions view needs one (new -> in_progress -> resolved)
-- so submissions can be triaged instead of just sitting in a flat list.

alter table public.contact_messages
  add column if not exists status text not null default 'new'
  check (status in ('new', 'in_progress', 'resolved'));

create index if not exists contact_messages_status_idx
  on public.contact_messages (status);
