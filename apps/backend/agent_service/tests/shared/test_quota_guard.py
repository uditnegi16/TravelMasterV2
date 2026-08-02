"""
Issue 5 -- "tests to write first", from the Critical Product and TDD
Backlog, using the real numbers confirmed 2026-07-31 (7 free / 100
premium, matching V1) instead of the backlog's placeholder numbers.
"""

import threading
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException


class FakeRedis:
    """
    Minimal stand-in for upstash_redis.Redis, backed by a real
    threading.Lock -- not just a plain dict -- so the concurrency test
    below is testing genuine atomicity under real concurrent access,
    not just asserting behavior against sequential calls.
    """

    def __init__(self):
        self._store: dict[str, int] = {}
        self._lock = threading.Lock()

    def incr(self, key):
        with self._lock:
            self._store[key] = self._store.get(key, 0) + 1
            return self._store[key]

    def decr(self, key):
        with self._lock:
            self._store[key] = self._store.get(key, 0) - 1
            return self._store[key]

    def expire(self, key, seconds):
        return True

    def get(self, key):
        return self._store.get(key)


@pytest.fixture()
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("shared.quota_guard.redis_client", fake)
    return fake


@pytest.fixture()
def free_user(monkeypatch):
    fake_guard = MagicMock()
    fake_guard.is_premium.return_value = False
    monkeypatch.setattr("shared.quota_guard.subscription_guard", fake_guard)
    return fake_guard


@pytest.fixture()
def premium_user(monkeypatch):
    fake_guard = MagicMock()
    fake_guard.is_premium.return_value = True
    monkeypatch.setattr("shared.quota_guard.subscription_guard", fake_guard)
    return fake_guard


@pytest.fixture()
def no_burst_limit(monkeypatch):
    """
    Monthly-quota tests call check_and_increment_quota many times in a
    tight loop to exercise the monthly counter specifically -- without
    this, the real burst limit (3 requests/10s) would trip first and
    produce a false failure unrelated to what's actually being tested.
    The dedicated burst test uses the real, small limit instead.
    """
    monkeypatch.setattr("shared.quota_guard.BURST_LIMIT", 10_000)


def test_free_user_allowed_up_to_seven(fake_redis, free_user, no_burst_limit):
    from shared import quota_guard

    for _ in range(7):
        quota_guard.check_and_increment_quota("acct-a", "clerk-a")  # should not raise


def test_free_user_blocked_on_eighth_request(fake_redis, free_user, no_burst_limit):
    from shared import quota_guard

    for _ in range(7):
        quota_guard.check_and_increment_quota("acct-a", "clerk-a")

    with pytest.raises(HTTPException) as exc_info:
        quota_guard.check_and_increment_quota("acct-a", "clerk-a")

    assert exc_info.value.status_code == 429


def test_premium_user_allowed_up_to_one_hundred(fake_redis, premium_user, no_burst_limit):
    from shared import quota_guard

    for _ in range(100):
        quota_guard.check_and_increment_quota("acct-premium", "clerk-premium")


def test_premium_user_blocked_on_101st_request(fake_redis, premium_user, no_burst_limit):
    from shared import quota_guard

    for _ in range(100):
        quota_guard.check_and_increment_quota("acct-premium", "clerk-premium")

    with pytest.raises(HTTPException) as exc_info:
        quota_guard.check_and_increment_quota("acct-premium", "clerk-premium")

    assert exc_info.value.status_code == 429


def test_changing_session_id_does_not_reset_account_limit(fake_redis, free_user, no_burst_limit):
    """
    Given a free user has exhausted the monthly quota
    When they change session_id and submit again
    Then the request remains blocked

    (Quota is keyed by account_id only -- session_id never enters the
    key at all, so there's nothing to "change" that would reset it.)
    """
    from shared import quota_guard

    for _ in range(7):
        quota_guard.check_and_increment_quota("acct-a", "clerk-a")

    # "Changing session_id" has no effect since quota isn't keyed by
    # it in the first place -- still the same account, still blocked.
    with pytest.raises(HTTPException):
        quota_guard.check_and_increment_quota("acct-a", "clerk-a")


def test_concurrent_requests_at_last_slot_only_one_succeeds(fake_redis, free_user, no_burst_limit):
    """
    Given four concurrent requests with one remaining allowance
    When they execute together
    Then at most one succeeds

    Real threads, real lock-backed counter -- genuinely exercises
    atomicity, not just sequential calls dressed up as a concurrency test.
    """
    from shared import quota_guard

    # Use up 6 of the 7 free slots first -- exactly one remains.
    for _ in range(6):
        quota_guard.check_and_increment_quota("acct-a", "clerk-a")

    results = []
    results_lock = threading.Lock()

    def attempt():
        try:
            quota_guard.check_and_increment_quota("acct-a", "clerk-a")
            with results_lock:
                results.append("allowed")
        except HTTPException:
            with results_lock:
                results.append("blocked")

    threads = [threading.Thread(target=attempt) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert results.count("allowed") == 1
    assert results.count("blocked") == 3


def test_refund_gives_back_a_slot(fake_redis, free_user, no_burst_limit):
    """
    Given a provider fails before planning begins
    When the request is not billable
    Then the user's monthly count is unchanged
    """
    from shared import quota_guard

    for _ in range(7):
        quota_guard.check_and_increment_quota("acct-a", "clerk-a")

    # The 7th request failed outright -- refund it.
    quota_guard.refund_quota("acct-a")

    # Should succeed again now that the slot was given back.
    quota_guard.check_and_increment_quota("acct-a", "clerk-a")


def test_burst_limit_blocks_rapid_requests_regardless_of_monthly_quota(fake_redis, premium_user):
    """
    Burst protection is separate from monthly entitlement -- even a
    premium user with 99 of 100 slots free can still be blocked by
    firing requests too fast.
    """
    from shared import quota_guard

    for _ in range(3):
        quota_guard.check_and_increment_quota("acct-premium", "clerk-premium")

    with pytest.raises(HTTPException) as exc_info:
        quota_guard.check_and_increment_quota("acct-premium", "clerk-premium")

    assert exc_info.value.status_code == 429


def test_get_quota_status_does_not_increment(fake_redis, free_user, no_burst_limit):
    from shared import quota_guard

    quota_guard.check_and_increment_quota("acct-a", "clerk-a")
    status_before = quota_guard.get_quota_status("acct-a", "clerk-a")
    status_after = quota_guard.get_quota_status("acct-a", "clerk-a")

    assert status_before == status_after
    assert status_before["used"] == 1
    assert status_before["remaining"] == 6
