"""
Issue 2 -- "tests to write first", from the Critical Product and TDD
Backlog, translated to what's actually true about this codebase:

Every /chat/* route already requires a valid Clerk session
(Depends(get_current_user)) -- confirmed by reading chat_routes.py.
There is no true anonymous access. The real vulnerability is that
ownership checks trust a client-supplied `device_id` instead of the
authenticated user's own identity -- so User B, while legitimately
signed in, can access User A's session by supplying User A's
device_id. These tests verify ownership is now scoped to account_id
(derived from the Clerk JWT, matching core/auth.py::get_account_id and
the RLS policies from Issue 4), not device_id.
"""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException


class FakeQuery:
    """
    Minimal stand-in for supabase-py's chainable query builder.
    Records every .eq()/.neq() call so tests can assert *which* column
    ownership was actually checked against -- the whole point of these
    tests -- and returns canned rows from .execute().
    """

    def __init__(self, rows):
        self._rows = rows
        self._single = False
        self.eq_calls = []
        self.neq_calls = []
        self.updated_with = None
        self.inserted_with = None

    def single(self):
        self._single = True
        return self

    def select(self, *a, **kw):
        return self

    def eq(self, column, value):
        self.eq_calls.append((column, value))
        # Simulate real filtering: if this eq() targets a column/value
        # that doesn't match any row, no rows survive.
        self._rows = [r for r in self._rows if r.get(column) == value]
        return self

    def neq(self, column, value):
        self.neq_calls.append((column, value))
        self._rows = [r for r in self._rows if r.get(column) != value]
        return self

    def order(self, *a, **kw):
        return self

    def limit(self, *a, **kw):
        return self

    def is_(self, column, value):
        if value == "null":
            self._rows = [r for r in self._rows if r.get(column) is None]
        else:
            self._rows = [r for r in self._rows if r.get(column) is not None]
        return self

    def not_(self):
        return self

    def update(self, values):
        self.updated_with = values
        return self

    def insert(self, values):
        self.inserted_with = values
        self._rows = [{**values, "id": "new-id"}]
        return self

    def execute(self):
        response = MagicMock()
        if self._single:
            response.data = self._rows[0] if self._rows else None
        else:
            response.data = self._rows
        return response


def _patch_sessions_table(monkeypatch, rows):
    fake = FakeQuery(rows)
    monkeypatch.setattr(
        "services.chat_service._sessions_table", lambda: fake
    )
    return fake


ACCOUNT_A = "71aa2955-a39d-5d5a-923d-fe14e369f239"
ACCOUNT_B = "83f02866-51cc-5e63-b22c-b8a9ed472cd4"


def test_user_b_cannot_access_user_a_session_via_device_id(monkeypatch):
    """
    Given User A owns Session A
    When User B requests Session A using User A's device_id
    Then the API returns 404

    (Both users are authenticated -- User B is signed in as themself,
    just supplying User A's device_id, which used to be the entire
    ownership check.)
    """
    from services import chat_service

    session_a = {
        "id": "session-a",
        "device_id": "device-belonging-to-a",
        "account_id": ACCOUNT_A,
        "status": "active",
    }
    fake = _patch_sessions_table(monkeypatch, [session_a])

    with pytest.raises(HTTPException) as exc_info:
        # User B's real account_id, but they supply/know A's device_id --
        # irrelevant now, since ownership no longer checks device_id.
        chat_service.assert_session_owner("session-a", ACCOUNT_B)

    assert exc_info.value.status_code == 404
    # The critical assertion: ownership was checked against account_id,
    # not device_id -- device_id must never appear in an eq() call here.
    assert ("device_id", "device-belonging-to-a") not in fake.eq_calls
    assert ("account_id", ACCOUNT_B) in fake.eq_calls


def test_user_a_can_still_access_their_own_session(monkeypatch):
    """Sanity check: the real owner, using their real account_id, still works."""
    from services import chat_service

    session_a = {
        "id": "session-a",
        "device_id": "device-belonging-to-a",
        "account_id": ACCOUNT_A,
        "status": "active",
    }
    _patch_sessions_table(monkeypatch, [session_a])

    result = chat_service.assert_session_owner("session-a", ACCOUNT_A)
    assert result["id"] == "session-a"


def test_changing_device_id_has_no_effect_on_listed_sessions(monkeypatch):
    """
    Given User A changes the device_id in a request
    When User A lists sessions
    Then only User A's account-owned sessions are returned
    (device_id is never part of the query at all anymore).
    """
    from services import chat_service

    rows = [
        {"id": "s1", "account_id": ACCOUNT_A, "device_id": "old-device", "status": "active"},
        {"id": "s2", "account_id": ACCOUNT_B, "device_id": "some-other-device", "status": "active"},
    ]
    fake = _patch_sessions_table(monkeypatch, rows)

    result = chat_service.list_sessions(ACCOUNT_A)

    assert [r["id"] for r in result] == ["s1"]
    assert all(col != "device_id" for col, _ in fake.eq_calls)


def test_create_session_stores_both_account_id_and_device_id(monkeypatch):
    """
    New sessions store account_id (authoritative ownership) AND device_id
    (kept only for the future claim-matching flow, per the migration
    design -- explicit user confirmation, never silent).
    """
    from services import chat_service

    fake = _patch_sessions_table(monkeypatch, [])

    chat_service.create_session(ACCOUNT_A, device_id="browser-xyz", title="Trip")

    assert fake.inserted_with["account_id"] == ACCOUNT_A
    assert fake.inserted_with["device_id"] == "browser-xyz"


def test_claim_sessions_only_claims_matching_unclaimed_rows(monkeypatch):
    """
    claim_sessions() -- the explicit-migration action -- must only touch
    rows matching the given device_id AND currently unclaimed
    (account_id is null). Never silently reassigns an already-owned row.
    """
    from services import chat_service

    fake = _patch_sessions_table(
        monkeypatch,
        [{"id": "s1", "device_id": "browser-xyz", "account_id": None, "status": "active"}],
    )

    claimed = chat_service.claim_sessions("browser-xyz", ACCOUNT_A)

    assert fake.updated_with == {"account_id": ACCOUNT_A}
    assert ("device_id", "browser-xyz") in fake.eq_calls
    assert claimed == 1
