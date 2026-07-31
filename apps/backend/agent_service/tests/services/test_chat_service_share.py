"""
Issue 3 -- "tests to write first" for the share/PDF ownership and
token-hashing fix.

Covers the real gap found 2026-07-31: get_message_by_id had no
ownership check at all, so PDF export and share-link creation were
reachable by anyone who knew/guessed a message_id. Also covers the
share-token hashing/expiry/revocation the backlog requires -- verified
against a real Postgres instance that Python's hashlib.sha256 and the
migration's pgcrypto digest() produce identical hex output, so this
mock-based unit coverage and the real DB backfill agree.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from test_chat_service_ownership import FakeQuery, ACCOUNT_A, ACCOUNT_B


def _patch_both_tables(monkeypatch, session_rows, message_rows):
    sessions_fake = FakeQuery(session_rows)
    messages_fake = FakeQuery(message_rows)
    monkeypatch.setattr("services.chat_service._sessions_table", lambda: sessions_fake)
    monkeypatch.setattr("services.chat_service._messages_table", lambda: messages_fake)
    return sessions_fake, messages_fake


def test_user_b_cannot_pdf_export_user_a_message(monkeypatch):
    """
    Given User A owns a trip message
    When User B requests its PDF (via get_owned_message)
    Then access is denied (404) and no message data is returned
    """
    from services import chat_service

    session_a = {"id": "session-a", "account_id": ACCOUNT_A, "status": "active"}
    message_a = {"id": "msg-1", "session_id": "session-a", "trip_data": {"secret": "yes"}}
    _patch_both_tables(monkeypatch, [session_a], [message_a])

    with pytest.raises(HTTPException) as exc_info:
        chat_service.get_owned_message("msg-1", ACCOUNT_B)

    assert exc_info.value.status_code == 404


def test_owner_can_still_access_their_own_message(monkeypatch):
    from services import chat_service

    session_a = {"id": "session-a", "account_id": ACCOUNT_A, "status": "active"}
    message_a = {"id": "msg-1", "session_id": "session-a", "trip_data": {"secret": "yes"}}
    _patch_both_tables(monkeypatch, [session_a], [message_a])

    result = chat_service.get_owned_message("msg-1", ACCOUNT_A)
    assert result["trip_data"] == {"secret": "yes"}


def test_create_share_token_stores_only_hash_not_raw_token(monkeypatch):
    """
    The raw token must never be persisted -- only its hash.
    """
    from services import chat_service

    _, messages_fake = _patch_both_tables(monkeypatch, [], [])

    token = chat_service.create_share_token("msg-1")

    stored = messages_fake.updated_with
    assert "share_token_hash" in stored
    assert stored["share_token_hash"] == chat_service._hash_token(token)
    # The raw token itself must not appear anywhere in what got stored.
    assert token not in str(stored)
    assert "share_token_expires_at" in stored


def test_revoked_token_returns_none_not_the_trip(monkeypatch):
    """
    Given a revoked share token
    When looked up
    Then no message/trip data is returned (route layer turns this into 410)
    """
    from services import chat_service

    token = "some-real-token"
    token_hash = chat_service._hash_token(token)
    message = {
        "id": "msg-1",
        "trip_data": {"secret": "yes"},
        "share_token_hash": token_hash,
        "share_token_revoked_at": "2026-07-31T00:00:00+00:00",
        "share_token_expires_at": "2099-01-01T00:00:00+00:00",
    }
    _patch_both_tables(monkeypatch, [], [message])

    result = chat_service.get_message_by_share_token(token)
    assert result is None


def test_expired_token_returns_none(monkeypatch):
    from services import chat_service

    token = "some-real-token"
    token_hash = chat_service._hash_token(token)
    message = {
        "id": "msg-1",
        "trip_data": {"secret": "yes"},
        "share_token_hash": token_hash,
        "share_token_revoked_at": None,
        "share_token_expires_at": "2000-01-01T00:00:00+00:00",  # long expired
    }
    _patch_both_tables(monkeypatch, [], [message])

    result = chat_service.get_message_by_share_token(token)
    assert result is None


def test_valid_unexpired_token_returns_the_message(monkeypatch):
    from services import chat_service

    token = "some-real-token"
    token_hash = chat_service._hash_token(token)
    message = {
        "id": "msg-1",
        "trip_data": {"secret": "yes"},
        "share_token_hash": token_hash,
        "share_token_revoked_at": None,
        "share_token_expires_at": "2099-01-01T00:00:00+00:00",
    }
    _patch_both_tables(monkeypatch, [], [message])

    result = chat_service.get_message_by_share_token(token)
    assert result is not None
    assert result["trip_data"] == {"secret": "yes"}
