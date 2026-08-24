"""
Tests for the guest-trial bypass fix.

The allowance was keyed on device_id, which lives in localStorage --
clearing site data produced a new device_id and a fresh free trip,
unlimited times. Every trip costs real LLM and flight-API calls, so this
was a billing exposure.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from shared import guest_ip_guard
from shared.guest_ip_guard import (
    GUEST_SESSIONS_PER_IP_PER_DAY,
    client_ip,
    enforce_guest_session_limit,
)


def _request(forwarded=None, host="10.0.0.1"):
    req = MagicMock()
    req.headers = {"x-forwarded-for": forwarded} if forwarded else {}
    req.client = MagicMock()
    req.client.host = host
    return req


class TestClientIp:
    def test_prefers_the_original_client_from_x_forwarded_for(self):
        """Behind API Gateway, request.client.host is the gateway."""
        req = _request(forwarded="203.0.113.7, 70.41.3.18, 150.172.238.178")
        assert client_ip(req) == "203.0.113.7"

    def test_falls_back_to_the_socket_peer(self):
        assert client_ip(_request(host="192.0.2.4")) == "192.0.2.4"

    def test_returns_unknown_when_there_is_nothing_to_go_on(self):
        req = MagicMock()
        req.headers = {}
        req.client = None
        assert client_ip(req) == "unknown"


class TestGuestSessionLimit:
    def test_allows_requests_below_the_cap(self):
        with patch.object(guest_ip_guard, "redis_client") as redis:
            for n in range(1, GUEST_SESSIONS_PER_IP_PER_DAY + 1):
                redis.incr.return_value = n
                enforce_guest_session_limit(_request(forwarded="203.0.113.7"))

    def test_blocks_once_the_cap_is_passed(self):
        """The actual bypass: clearing storage no longer helps."""
        with patch.object(guest_ip_guard, "redis_client") as redis:
            redis.incr.return_value = GUEST_SESSIONS_PER_IP_PER_DAY + 1

            with pytest.raises(HTTPException) as exc:
                enforce_guest_session_limit(_request(forwarded="203.0.113.7"))

            assert exc.value.status_code == 429
            assert "sign in" in exc.value.detail.lower()

    def test_sets_a_ttl_only_on_the_first_hit(self):
        """Re-expiring on every request would make the window slide and
        never reset for a busy IP."""
        with patch.object(guest_ip_guard, "redis_client") as redis:
            redis.incr.return_value = 1
            enforce_guest_session_limit(_request(forwarded="203.0.113.7"))
            assert redis.expire.call_count == 1

            redis.expire.reset_mock()
            redis.incr.return_value = 2
            enforce_guest_session_limit(_request(forwarded="203.0.113.7"))
            assert redis.expire.call_count == 0

    def test_fails_open_when_redis_is_down(self):
        """A cache outage must not take down guest signup."""
        with patch.object(guest_ip_guard, "redis_client") as redis:
            redis.incr.side_effect = ConnectionError("upstash unreachable")
            enforce_guest_session_limit(_request(forwarded="203.0.113.7"))

    def test_skips_the_check_when_the_ip_is_unknown(self):
        req = MagicMock()
        req.headers = {}
        req.client = None
        with patch.object(guest_ip_guard, "redis_client") as redis:
            enforce_guest_session_limit(req)
            redis.incr.assert_not_called()

    def test_counts_each_ip_separately(self):
        with patch.object(guest_ip_guard, "redis_client") as redis:
            redis.incr.return_value = 1
            enforce_guest_session_limit(_request(forwarded="203.0.113.7"))
            enforce_guest_session_limit(_request(forwarded="198.51.100.2"))

            keys = [c.args[0] for c in redis.incr.call_args_list]
            assert keys == [
                "guest_sessions:ip:203.0.113.7",
                "guest_sessions:ip:198.51.100.2",
            ]
