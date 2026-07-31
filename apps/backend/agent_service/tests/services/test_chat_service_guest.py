"""
Issue 1 -- guest trial: one trip, no account required.

Decision (2026-07-31): a signed-out visitor can plan exactly one trip
with zero account. Enforced via device_id, since there's no account_id
for an anonymous requester. Once a guest signs in and claims their
session (Issue 2's claim_sessions), account_id is no longer null and
the anonymous path stops matching -- correctly requiring sign-in for
anything past the one free trip.
"""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from test_chat_service_ownership import FakeQuery, ACCOUNT_A


def _patch_sessions_table(monkeypatch, rows):
    fake = FakeQuery(rows)
    monkeypatch.setattr("services.chat_service._sessions_table", lambda: fake)
    return fake


def test_new_device_has_not_used_guest_trial(monkeypatch):
    _patch_sessions_table(monkeypatch, [])
    from services import chat_service

    assert chat_service.has_used_guest_trial("brand-new-device") is False


def test_device_with_existing_unclaimed_session_has_used_trial(monkeypatch):
    from services import chat_service

    rows = [{"id": "s1", "device_id": "device-x", "account_id": None, "status": "active"}]
    _patch_sessions_table(monkeypatch, rows)

    assert chat_service.has_used_guest_trial("device-x") is True


def test_device_with_claimed_session_can_start_a_new_guest_trial(monkeypatch):
    """
    Once a guest's old session is claimed (account_id set), it no
    longer counts against the device -- a fresh browser/device_id reset
    scenario shouldn't be permanently blocked by an already-claimed row.
    """
    from services import chat_service

    rows = [{"id": "s1", "device_id": "device-x", "account_id": ACCOUNT_A, "status": "active"}]
    _patch_sessions_table(monkeypatch, rows)

    assert chat_service.has_used_guest_trial("device-x") is False


def test_create_guest_session_stores_no_account_id(monkeypatch):
    from services import chat_service

    fake = _patch_sessions_table(monkeypatch, [])
    chat_service.create_guest_session("device-x", title="Trial trip")

    assert fake.inserted_with["device_id"] == "device-x"
    assert "account_id" not in fake.inserted_with


def test_guest_can_access_their_own_unclaimed_session(monkeypatch):
    from services import chat_service

    rows = [{"id": "s1", "device_id": "device-x", "account_id": None, "status": "active"}]
    _patch_sessions_table(monkeypatch, rows)

    result = chat_service.assert_guest_session_owner("s1", "device-x")
    assert result["id"] == "s1"


def test_stranger_cannot_access_guest_session_with_wrong_device_id(monkeypatch):
    from services import chat_service

    rows = [{"id": "s1", "device_id": "device-x", "account_id": None, "status": "active"}]
    _patch_sessions_table(monkeypatch, rows)

    with pytest.raises(HTTPException) as exc_info:
        chat_service.assert_guest_session_owner("s1", "someone-elses-device")

    assert exc_info.value.status_code == 404


def test_claimed_session_no_longer_reachable_as_guest(monkeypatch):
    """
    Once a session is claimed by a real account, the anonymous path
    must stop working entirely -- forces sign-in, doesn't leave a
    permanent backdoor into data that now belongs to an account.
    """
    from services import chat_service

    rows = [{"id": "s1", "device_id": "device-x", "account_id": ACCOUNT_A, "status": "active"}]
    _patch_sessions_table(monkeypatch, rows)

    with pytest.raises(HTTPException) as exc_info:
        chat_service.assert_guest_session_owner("s1", "device-x")

    assert exc_info.value.status_code == 404
