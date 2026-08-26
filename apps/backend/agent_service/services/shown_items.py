"""
Stops "where else can I visit" returning the same list every time.

info_request_node called search_places(city) and sliced [:5]. The search
is deterministic, so asking twice produced an identical answer -- the
node had no memory of what it had already shown. OpenTripMap returns up
to 12 results, so the material for a genuinely different answer was
there; it was just never reached.

Seen names live in Redis keyed by session and category, expiring with
the conversation rather than persisting forever.

Fails OPEN in both directions: if Redis is unavailable the node still
answers (repeating results is a far smaller problem than erroring), and
if every result has been shown the caller is told so honestly rather
than being handed the first five again.
"""

from __future__ import annotations

from core.redis_client import redis_client
from shared.logging_config import logger

# A conversation that goes quiet for this long can start fresh.
_TTL_SECONDS = 12 * 60 * 60

# Guard against one very chatty session growing the set without bound.
_MAX_REMEMBERED = 200


def _key(session_id: str, category: str) -> str:
    return f"shown:{category}:{session_id}"


def _name_of(item: dict) -> str:
    """Places use 'name'; hotels sometimes only carry 'city'."""
    return str(item.get("name") or item.get("city") or "").strip().lower()


def filter_already_shown(
    session_id: str | None,
    category: str,
    results: list[dict],
) -> list[dict]:
    """Returns only results this session has not been shown yet."""
    if not session_id or not results:
        return results

    try:
        seen = redis_client.smembers(_key(session_id, category)) or set()
    except Exception as exc:
        logger.warning(f"shown-items lookup failed, not filtering | {exc}")
        return results

    # Redis clients differ on bytes vs str depending on decode_responses.
    seen_names = {
        (s.decode() if isinstance(s, bytes) else str(s)).lower() for s in seen
    }

    fresh = [r for r in results if _name_of(r) and _name_of(r) not in seen_names]

    # Everything already shown: let the caller say so rather than
    # silently repeating the same five.
    return fresh


def remember_shown(
    session_id: str | None,
    category: str,
    results: list[dict],
) -> None:
    """Records what we just showed, so the next ask can differ."""
    if not session_id or not results:
        return

    names = [_name_of(r) for r in results if _name_of(r)]
    if not names:
        return

    key = _key(session_id, category)

    try:
        if redis_client.scard(key) >= _MAX_REMEMBERED:
            # Long conversation -- start over rather than grow forever.
            redis_client.delete(key)

        redis_client.sadd(key, *names)
        redis_client.expire(key, _TTL_SECONDS)
    except Exception as exc:
        # Not remembering just means the next answer may repeat.
        logger.warning(f"shown-items write failed | {exc}")
