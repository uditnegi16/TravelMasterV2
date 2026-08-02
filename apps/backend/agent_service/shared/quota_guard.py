"""
Issue 5 -- account-bound quotas and rate limiting.

Two independent, separately-enforced limits (per the backlog's own
requirement to keep these distinct):
  - Burst protection: short-window request-rate limiting, applies
    regardless of plan tier or whether requests succeed.
  - Monthly quota: the actual product entitlement (7/month free,
    100/month premium -- V1's real numbers, confirmed 2026-07-31).
    Only real, billable trip-planning turns count -- a request that
    fails outright before producing any output is refunded.

Deliberately does NOT apply to guest-trial sessions (Issue 1) --
guests have no account_id, and their allowance (exactly one session,
ever, per device) is a completely separate mechanism already enforced
in chat_service.has_used_guest_trial. Applying this module to guests
would be applying an account-based system to something that has no
account; the two are intentionally decoupled so fixing one can't
disturb the other.

Atomicity: Upstash's REST API executes each individual command
(INCR, DECR, EXPIRE) atomically server-side. The check-then-act
pattern here is the standard atomic rate-limiter shape: increment
first, then compare the *returned* value against the limit. Under
concurrent requests, Redis serializes the increments, so only the
request that receives the value landing exactly at the limit is
allowed through -- this is what makes the backlog's "4 concurrent
requests, 1 remaining slot, at most one succeeds" scenario hold, and
it's covered by a real concurrency test (not just sequential asserts)
in tests/shared/test_quota_guard.py.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from core.redis_client import redis_client
from shared.subscription_guard import subscription_guard

FREE_MONTHLY_LIMIT = 7
PREMIUM_MONTHLY_LIMIT = 100

BURST_LIMIT = 3
BURST_WINDOW_SECONDS = 10

# Safety-net TTL on the monthly key -- the real "reset" mechanism is
# the key name itself changing every calendar month (see
# _monthly_quota_key), this TTL just cleans up old keys eventually so
# they don't accumulate forever.
MONTHLY_KEY_TTL_SECONDS = 35 * 24 * 60 * 60


def _monthly_quota_key(account_id: str) -> str:
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    return f"quota:monthly:{account_id}:{period}"


def _burst_key(account_id: str) -> str:
    return f"quota:burst:{account_id}"


def _limit_for(clerk_user_id: str) -> int:
    if subscription_guard.is_premium(clerk_user_id):
        return PREMIUM_MONTHLY_LIMIT
    return FREE_MONTHLY_LIMIT


def _next_reset_iso() -> str:
    now = datetime.now(timezone.utc)
    if now.month == 12:
        reset = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        reset = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return reset.isoformat()


def check_and_increment_quota(account_id: str, clerk_user_id: str) -> None:
    """
    Raises HTTPException(429) if the account is over its burst or
    monthly limit; otherwise increments the monthly counter and
    returns normally. Call this AFTER validating the request (session
    ownership, etc.) but BEFORE invoking the agent graph, so
    validation errors never consume quota. If the graph invocation
    then fails outright, call refund_quota() to give the slot back --
    a request that produced no output shouldn't count as billable.
    """
    burst_key = _burst_key(account_id)
    burst_count = redis_client.incr(burst_key)
    if burst_count == 1:
        redis_client.expire(burst_key, BURST_WINDOW_SECONDS)
    if burst_count > BURST_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="You're sending requests too quickly. Please wait a moment and try again.",
        )

    limit = _limit_for(clerk_user_id)
    monthly_key = _monthly_quota_key(account_id)
    monthly_count = redis_client.incr(monthly_key)
    if monthly_count == 1:
        redis_client.expire(monthly_key, MONTHLY_KEY_TTL_SECONDS)

    if monthly_count > limit:
        raise HTTPException(
            status_code=429,
            detail={
                "message": f"Monthly limit reached ({limit} trips this month).",
                "limit": limit,
                "remaining": 0,
                "resets_at": _next_reset_iso(),
            },
        )


def refund_quota(account_id: str) -> None:
    """
    Gives back a monthly-quota slot for a request that failed outright
    before producing any usable output (backlog: "Do not consume quota
    for validation errors or provider outages"). Does NOT refund the
    burst counter -- burst limiting is about request rate, not
    success/failure, so a failed request still counts against it.
    """
    redis_client.decr(_monthly_quota_key(account_id))


def get_quota_status(account_id: str, clerk_user_id: str) -> dict:
    """
    Non-incrementing read -- lets the UI show remaining allowance
    before the last request, per the acceptance criteria.
    """
    limit = _limit_for(clerk_user_id)
    used_raw = redis_client.get(_monthly_quota_key(account_id))
    used = int(used_raw) if used_raw else 0
    return {
        "limit": limit,
        "used": used,
        "remaining": max(0, limit - used),
        "resets_at": _next_reset_iso(),
    }
