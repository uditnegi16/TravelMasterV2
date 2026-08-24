"""
Closes the guest-trial bypass.

The one-free-trip allowance was keyed on device_id, which the browser
generates and stores in localStorage. Clearing site data produces a new
device_id and therefore a fresh free trip, unlimited times. Since every
trip costs real LLM and flight-API calls, that is a direct billing
exposure, not just a fairness problem.

This adds a second, independent limit keyed on the client IP, which the
user cannot clear. It does not replace the device check -- both apply.

Deliberately imperfect and deliberately generous:
  - Shared IPs are real (offices, universities, mobile CGNAT), so the
    cap is per day and set well above what one honest visitor needs.
    A handful of genuine users behind one NAT will not be blocked.
  - A determined abuser with a VPN can still rotate IPs. The goal is to
    stop trivial "clear storage, repeat" abuse, not to be unbypassable.

Fails OPEN: if Redis is unreachable the request is allowed. A cache
outage taking down guest signup would be worse than the abuse this
prevents, and signed-in quotas are unaffected either way.
"""

from __future__ import annotations

from fastapi import HTTPException, Request

from core.redis_client import redis_client
from shared.logging_config import logger

# Generous: a normal visitor needs one. This only catches repetition.
GUEST_SESSIONS_PER_IP_PER_DAY = 5

_DAY_SECONDS = 24 * 60 * 60


def client_ip(request: Request) -> str:
    """
    The caller's IP as API Gateway reports it.

    Behind API Gateway, request.client.host is the gateway, not the
    user, so X-Forwarded-For is what matters. Its first entry is the
    original client; later entries are proxies. The header is
    client-supplied and therefore spoofable in principle, but API
    Gateway appends the true source IP itself, so the value is not
    attacker-controlled end to end here.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    client = getattr(request, "client", None)
    return getattr(client, "host", None) or "unknown"


def _key(ip: str) -> str:
    return f"guest_sessions:ip:{ip}"


def enforce_guest_session_limit(request: Request) -> None:
    """
    Raises 429 when this IP has started too many guest sessions today.

    Increment-then-compare, the same atomic shape quota_guard uses:
    Redis serializes the INCRs, so concurrent requests cannot both see
    the last remaining slot.
    """
    ip = client_ip(request)
    if ip == "unknown":
        # No usable identity -- the device check still applies.
        return

    key = _key(ip)

    try:
        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, _DAY_SECONDS)
    except Exception:
        logger.warning(
            "guest IP limit: Redis unavailable, allowing request from %s", ip
        )
        return

    if count > GUEST_SESSIONS_PER_IP_PER_DAY:
        logger.warning(
            "guest IP limit hit: ip=%s count=%s limit=%s",
            ip,
            count,
            GUEST_SESSIONS_PER_IP_PER_DAY,
        )
        raise HTTPException(
            status_code=429,
            detail=(
                "Too many free trips started from this network today. "
                "Please sign in to keep planning."
            ),
        )
