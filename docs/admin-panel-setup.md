# Admin Panel — Setup Notes

Phase A, item 4. Backend: `apps/backend/agent_service/api/admin_routes.py`
(+ `admin_service.py`, `admin_schemas.py`). Frontend: `apps/frontend/src/app/routes/admin/*`.

No new packages or infrastructure — reuses Clerk, Supabase, and the
existing Upstash Redis instance.

## 1. RBAC — one manual step required

Roles live in Clerk `publicMetadata.role` (`user` | `admin` | `superadmin`),
not in a new DB table — same pattern Auth0/Firebase/Cognito use, and the
same JWT the app already verifies on every request.

By default Clerk does **not** put `publicMetadata` on the session JWT, so
`core/auth.py`'s `require_admin` dependency will treat everyone as `user`
until you add a custom claim:

1. Clerk Dashboard → **Sessions** → **Customize session token**
2. Add:
   ```json
   { "metadata": "{{user.public_metadata}}" }
   ```
3. Save. New sessions will include `payload.metadata.role`.

To make yourself an admin: Clerk Dashboard → Users → your user → Metadata →
set **Public metadata** to `{"role": "admin"}`. (Once you have one admin,
you can promote/demote others from the Admin Panel's Users page instead.)

## 2. Database migration

`contact_messages` didn't have a workflow status column. Run:

```
database/admin_panel_migration.sql
```

against Supabase before opening **Contact submissions** in the panel
(the PATCH-status route will 500 without it).

## 3. What's in each tab

| Tab | Backed by |
|---|---|
| Dashboard | Rolls up analytics + monitoring + open contact count |
| Users | Clerk `users.list` / `update_metadata` / `ban`/`unban` |
| Contact | `contact_messages` table, status triage |
| Analytics | `chat.sessions` / `chat.messages` counts + conversation-type mix |
| Monitoring | Live Redis/Supabase pings + cache/chat/RAG counters |
| MLOps | Latency (avg/p50/p95) for chat turns and RAG retrieval, cache hit rate, retrieval doc counts, conversation routing, error rate — all recorded via `shared/metrics.py` (Redis-backed rolling counters, added alongside this feature) |

## 4. Known gaps / next passes

- MLOps metrics reset if Redis is flushed — there's no durable metrics
  store yet. Fine for a first pass; worth moving to a proper time-series
  store (or Supabase table) if this needs to survive Redis restarts.
- Clerk's `users.list` is not paginated in the UI yet beyond the first
  page (`limit`/`offset` are wired on the backend, just not exposed as
  pagination controls in `AdminUsersPage.tsx`).
- No audit log for role changes / bans yet.
