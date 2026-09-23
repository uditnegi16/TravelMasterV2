"""
Admin Panel — business logic.

Five surfaces, matching the plan doc: Dashboard, Users, Contact
submissions, Analytics, Monitoring (+ an MLOps analytics dashboard on
top, since the pipeline underneath is agentic and that's worth
surfacing on its own).

Users are Clerk's source of truth (no shadow `users` table — role
lives in Clerk publicMetadata, see core/auth.py). Everything else
reads from Supabase tables that already exist (chat.sessions,
chat.messages, contact_messages) plus the shared/metrics.py Redis
counters for MLOps numbers.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from core.auth import clerk
from core.supabase_client import supabase
from core.redis_client import redis_client
from shared import metrics
from shared.logging_config import logger
from shared.circuit_breaker import CircuitBreaker

CONTACT_TABLE = "contact_messages"


# ---------------------------------------------------------------------
# Users (Clerk)
# ---------------------------------------------------------------------
def list_users(limit: int = 50, offset: int = 0, query: Optional[str] = None) -> Dict[str, Any]:
    from clerk_backend_api import models

    request = models.GetUserListRequest(
        limit=limit,
        offset=offset,
        query=query,
    )
    users = clerk.users.list(request=request)

    return {
        "total": len(users),
        "users": [
            {
                "id": u.id,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email_addresses[0].email_address if u.email_addresses else None,
                "role": (u.public_metadata or {}).get("role", "user"),
                "created_at": u.created_at,
                "last_active_at": getattr(u, "last_active_at", None),
                "banned": getattr(u, "banned", False),
            }
            for u in users
        ],
    }


def set_user_role(user_id: str, role: str) -> Dict[str, Any]:
    if role not in ("user", "admin", "superadmin"):
        raise ValueError("role must be one of: user, admin, superadmin")

    updated = clerk.users.update_metadata(
        user_id=user_id,
        public_metadata={"role": role},
    )
    return {
        "id": updated.id,
        "role": (updated.public_metadata or {}).get("role", "user"),
    }


def set_user_banned(user_id: str, banned: bool) -> Dict[str, Any]:
    if banned:
        clerk.users.ban(user_id=user_id)
    else:
        clerk.users.unban(user_id=user_id)
    return {"id": user_id, "banned": banned}


# ---------------------------------------------------------------------
# Contact submissions
# ---------------------------------------------------------------------
def list_contact_submissions(status: Optional[str] = None) -> List[Dict[str, Any]]:
    query = supabase.table(CONTACT_TABLE).select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    res = query.execute()
    return res.data or []


def update_contact_submission_status(submission_id: str, status: str) -> Dict[str, Any]:
    if status not in ("new", "in_progress", "resolved"):
        raise ValueError("status must be one of: new, in_progress, resolved")

    res = (
        supabase.table(CONTACT_TABLE)
        .update({"status": status})
        .eq("id", submission_id)
        .execute()
    )
    if not res.data:
        raise LookupError("Submission not found")
    return res.data[0]


# ---------------------------------------------------------------------
# Analytics (product usage — sessions/messages/trips)
# ---------------------------------------------------------------------
def get_analytics_overview(days: int = 7) -> Dict[str, Any]:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    sessions_table = supabase.schema("chat").table("sessions")
    messages_table = supabase.schema("chat").table("messages")

    total_sessions = sessions_table.select("id", count="exact").execute().count or 0
    new_sessions = (
        sessions_table.select("id", count="exact").gte("created_at", since).execute().count or 0
    )
    total_messages = messages_table.select("id", count="exact").execute().count or 0

    trip_messages = (
        messages_table.select("id", count="exact")
        .not_.is_("trip_data", "null")
        .execute()
        .count
        or 0
    )

    recent_messages = (
        messages_table.select("role,created_at")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(1000)
        .execute()
        .data
        or []
    )

    by_day: Dict[str, int] = {}
    for m in recent_messages:
        if m.get("role") != "user":
            continue
        day = str(m["created_at"])[:10]
        by_day[day] = by_day.get(day, 0) + 1

    return {
        "window_days": days,
        "total_sessions": total_sessions,
        "new_sessions_in_window": new_sessions,
        "total_messages": total_messages,
        "trips_generated": trip_messages,
        "user_messages_by_day": dict(sorted(by_day.items())),
        "conversation_type_distribution": metrics.get_distribution(
            "conversation_type",
            ["NEW_TRIP", "MODIFY_TRIP", "FOLLOW_UP", "GENERAL_CHAT"],
        ),
    }


# ---------------------------------------------------------------------
# Time series (admin sparklines)
# ---------------------------------------------------------------------
# PostgREST caps a single response at 1,000 rows by default, and a bare
# .limit(1000) silently undercounts on a busy week -- so read in pages
# via .range(). The hard cap bounds cost on a runaway table; hitting it
# is reported back as `truncated` rather than hidden.
TIMESERIES_PAGE_SIZE = 1000
TIMESERIES_MAX_ROWS = 50_000


def _created_at_values(make_query, since_iso: str) -> tuple[List[str], bool]:
    """All created_at values since `since_iso`, paging through results.
    Selects ONLY created_at -- never message bodies or trip_data."""
    values: List[str] = []
    start = 0
    while True:
        batch = (
            make_query()
            .gte("created_at", since_iso)
            .order("created_at")
            .range(start, start + TIMESERIES_PAGE_SIZE - 1)
            .execute()
            .data
            or []
        )
        values.extend(str(r["created_at"]) for r in batch if r.get("created_at"))
        if len(batch) < TIMESERIES_PAGE_SIZE:
            return values, False
        start += TIMESERIES_PAGE_SIZE
        if start >= TIMESERIES_MAX_ROWS:
            return values, True


def get_timeseries(days: int = 14) -> Dict[str, Any]:
    """
    Daily counts for the admin dashboard sparklines, one zero-filled
    bucket per UTC day, oldest first, ending today:

      sessions -- chat sessions created
      messages -- user messages sent (the demand signal; assistant
                  replies would just double it)
      trips    -- assistant messages that stored a trip plan (same
                  definition as the "Trips generated" total above)

    Read-only. Built from created_at timestamps already in the tables
    -- no new tables, no migration.
    """
    days = max(7, min(int(days), 90))
    today = datetime.now(timezone.utc).date()
    first_day = today - timedelta(days=days - 1)
    since = datetime(first_day.year, first_day.month, first_day.day, tzinfo=timezone.utc).isoformat()
    dates = [(first_day + timedelta(days=i)).isoformat() for i in range(days)]

    sessions_table = lambda: supabase.schema("chat").table("sessions")  # noqa: E731
    messages_table = lambda: supabase.schema("chat").table("messages")  # noqa: E731
    sources = {
        "sessions": lambda: sessions_table().select("created_at"),
        "messages": lambda: messages_table().select("created_at").eq("role", "user"),
        "trips": lambda: messages_table().select("created_at").not_.is_("trip_data", "null"),
    }

    series: Dict[str, List[int]] = {}
    truncated = False
    index = {d: i for i, d in enumerate(dates)}
    for name, make_query in sources.items():
        counts = [0] * days
        values, hit_cap = _created_at_values(make_query, since)
        truncated = truncated or hit_cap
        for ts in values:
            i = index.get(ts[:10])  # ISO timestamps from Supabase are UTC
            if i is not None:
                counts[i] += 1
        series[name] = counts

    return {
        "days": days,
        "timezone": "UTC",
        "dates": dates,
        "series": series,
        "truncated": truncated,
    }


# ---------------------------------------------------------------------
# Monitoring (system health)
# ---------------------------------------------------------------------
def get_monitoring_snapshot() -> Dict[str, Any]:
    checks: Dict[str, Any] = {}

    started = time.perf_counter()
    try:
        redis_client.ping() if hasattr(redis_client, "ping") else redis_client.get("__healthcheck__")
        checks["redis"] = {"ok": True, "latency_ms": round((time.perf_counter() - started) * 1000, 2)}
    except Exception as exc:
        checks["redis"] = {"ok": False, "error": str(exc)}

    started = time.perf_counter()
    try:
        supabase.table(CONTACT_TABLE).select("id").limit(1).execute()
        checks["supabase"] = {"ok": True, "latency_ms": round((time.perf_counter() - started) * 1000, 2)}
    except Exception as exc:
        checks["supabase"] = {"ok": False, "error": str(exc)}

    return {
        "checks": checks,
        "cache": {
            "hits": metrics.get_counter("cache_hit"),
            "misses": metrics.get_counter("cache_miss"),
        },
        "chat": {
            "success": metrics.get_counter("chat_turn_success"),
            "errors": metrics.get_counter("chat_turn_errors"),
        },
        "rag": {
            "calls": metrics.get_counter("rag_retrieval_calls"),
            "errors": metrics.get_counter("rag_retrieval_errors"),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------
# MLOps analytics dashboard
# ---------------------------------------------------------------------
def get_mlops_dashboard() -> Dict[str, Any]:
    chat_turn_samples = metrics.get_recent_latencies("chat_turn", limit=200)
    rag_samples = metrics.get_recent_latencies("rag_retrieval", limit=200)

    cache_hits = metrics.get_counter("cache_hit")
    cache_misses = metrics.get_counter("cache_miss")
    total_cache = cache_hits + cache_misses
    cache_hit_rate = round(cache_hits / total_cache, 4) if total_cache else None

    avg_docs_retrieved = None
    if rag_samples:
        doc_counts = [s.get("doc_count", 0) for s in rag_samples]
        avg_docs_retrieved = round(sum(doc_counts) / len(doc_counts), 2)

    return {
        "pipeline_latency": {
            "end_to_end_chat_turn": metrics.latency_stats(chat_turn_samples),
            "rag_retrieval": metrics.latency_stats(rag_samples),
        },
        "retrieval_quality": {
            "avg_docs_retrieved": avg_docs_retrieved,
            "retrieval_calls": metrics.get_counter("rag_retrieval_calls"),
            "retrieval_errors": metrics.get_counter("rag_retrieval_errors"),
        },
        "cache": {
            "hit_rate": cache_hit_rate,
            "hits": cache_hits,
            "misses": cache_misses,
        },
        "conversation_routing": metrics.get_distribution(
            "conversation_type",
            ["NEW_TRIP", "MODIFY_TRIP", "FOLLOW_UP", "GENERAL_CHAT"],
        ),
        "reliability": {
            "chat_turn_success": metrics.get_counter("chat_turn_success"),
            "chat_turn_errors": metrics.get_counter("chat_turn_errors"),
            "error_rate": (
                round(
                    metrics.get_counter("chat_turn_errors")
                    / max(
                        1,
                        metrics.get_counter("chat_turn_success")
                        + metrics.get_counter("chat_turn_errors"),
                    ),
                    4,
                )
            ),
        },
        "recent_chat_turns": chat_turn_samples[:20],
        "note": (
            "Metrics are recorded in-process via shared/metrics.py (Redis-backed "
            "rolling counters/samples) as of the current admin build. There is no "
            "separate metrics store yet, so counts reset if Redis data is cleared."
        ),
    }