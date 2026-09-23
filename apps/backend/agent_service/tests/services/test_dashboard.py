"""
Account dashboard (UI objective #9): GET /chat/dashboard and the trip
summaries behind it. Everything must come from stored data -- these
tests pin down which stored row wins per session and that nothing is
estimated or invented.
"""

from unittest.mock import MagicMock

import pytest

from services import chat_service

ACCOUNT = "71aa2955-a39d-5d5a-923d-fe14e369f239"


class FakeMessages:
    """Chainable stand-in for the messages query. Records the select and
    filters so tests can assert we never pull the full trip_data blob."""

    def __init__(self, rows):
        self.rows = rows
        self.selected = None
        self.calls = []

    def select(self, cols):
        self.selected = cols
        return self

    def in_(self, col, values):
        self.calls.append(("in", col, tuple(values)))
        self.rows = [r for r in self.rows if r["session_id"] in values]
        return self

    def eq(self, col, value):
        self.calls.append(("eq", col, value))
        return self

    @property
    def not_(self):  # postgrest-py exposes `not_` as a property
        return self

    def is_(self, col, value):
        self.calls.append(("not_is", col, value))
        return self

    def order(self, col, desc=False):
        self.rows = sorted(self.rows, key=lambda r: r["created_at"], reverse=desc)
        return self

    def execute(self):
        r = MagicMock()
        r.data = self.rows
        return r


SESSIONS = [
    {"id": "s-pinned", "title": "Goa", "pinned": True, "last_message_at": "2026-09-20T10:00:00Z"},
    {"id": "s-recent", "title": "Jaipur trip", "pinned": False, "last_message_at": "2026-09-22T10:00:00Z"},
    {"id": "s-chat-only", "title": "Visa question", "pinned": False, "last_message_at": "2026-09-21T10:00:00Z"},
]


def _row(sid, created, **kw):
    base = {"session_id": sid, "created_at": created, "parsed": None, "profile": None,
            "rec_cost": None, "hotel": None,
            "p0": None, "c0": None, "p1": None, "c1": None, "p2": None, "c2": None}
    base.update(kw)
    return base


@pytest.fixture
def patch_tables(monkeypatch):
    def _apply(rows):
        fake = FakeMessages(rows)
        monkeypatch.setattr(chat_service, "list_sessions", lambda account_id: SESSIONS)
        monkeypatch.setattr(chat_service, "_messages_table", lambda: fake)
        return fake
    return _apply


def test_newest_real_plan_wins_and_clarification_turns_are_skipped(patch_tables):
    patch_tables([
        # original plan
        _row("s-recent", "2026-09-22T09:00:00Z",
             parsed={"origin": "Kolkata", "destination": "Jaipur", "start_date": "2026-10-24", "end_date": "2026-10-28", "travelers": 1},
             profile="Best Value", rec_cost="18078.4", hotel="Swagatam RTDC Hotel"),
        # later MODIFY_TRIP -> should win
        _row("s-recent", "2026-09-22T09:30:00Z",
             parsed={"origin": "Kolkata", "destination": "Jaipur", "start_date": "2026-10-24", "end_date": "2026-10-28"},
             profile="Budget Saver", rec_cost="12000", hotel="Cheaper Inn"),
        # even later clarification turn: empty trip, no cost -> skipped
        _row("s-recent", "2026-09-22T09:45:00Z", parsed={"destination": "Jaipur"}),
    ])

    trips = chat_service.list_trip_summaries(ACCOUNT)

    assert [t["session_id"] for t in trips] == ["s-recent"]
    t = trips[0]
    assert t["profile"] == "Budget Saver"
    assert t["total_cost"] == 12000.0
    assert t["hotel"] == "Cheaper Inn"
    assert t["destination"] == "Jaipur" and t["start_date"] == "2026-10-24"


def test_sessions_without_any_trip_are_left_out_and_sidebar_order_is_kept(patch_tables):
    patch_tables([
        _row("s-recent", "2026-09-22T09:00:00Z", parsed={"destination": "Jaipur"}, rec_cost="100"),
        _row("s-pinned", "2026-09-10T09:00:00Z", parsed={"destination_city": "Goa", "destination": "goa, india"}, rec_cost="50"),
    ])

    trips = chat_service.list_trip_summaries(ACCOUNT)

    # pinned first (list_sessions order), chat-only session absent
    assert [t["session_id"] for t in trips] == ["s-pinned", "s-recent"]
    assert trips[0]["destination"] == "Goa"  # destination_city preferred
    assert trips[0]["pinned"] is True


def test_cost_falls_back_to_the_matching_package_then_the_first(patch_tables):
    patch_tables([
        _row("s-recent", "2026-09-22T09:00:00Z", profile="Luxury",
             p0="Budget Saver", c0="9000", p1="Luxury", c1="44478"),
        _row("s-pinned", "2026-09-10T09:00:00Z", profile="Unknown", p0="Budget Saver", c0="9000"),
    ])

    trips = {t["session_id"]: t for t in chat_service.list_trip_summaries(ACCOUNT)}

    assert trips["s-recent"]["total_cost"] == 44478.0
    assert trips["s-pinned"]["total_cost"] == 9000.0


def test_never_selects_the_whole_trip_data_blob(patch_tables):
    fake = patch_tables([])
    chat_service.list_trip_summaries(ACCOUNT)

    cols = [c.strip() for c in fake.selected.split(",")]
    assert "trip_data" not in cols
    assert all("->" in c for c in cols if c.split(":")[-1].startswith("trip_data"))
    assert ("eq", "role", "assistant") in fake.calls
    assert ("not_is", "trip_data", "null") in fake.calls
    # scoped to this account's own sessions only
    assert ("in", "session_id", ("s-pinned", "s-recent", "s-chat-only")) in fake.calls


def test_no_sessions_means_no_query(monkeypatch):
    monkeypatch.setattr(chat_service, "list_sessions", lambda account_id: [])
    monkeypatch.setattr(chat_service, "_messages_table", lambda: pytest.fail("should not query"))
    assert chat_service.list_trip_summaries(ACCOUNT) == []


def test_dashboard_route_combines_quota_plan_and_trips(monkeypatch):
    from api import chat_routes

    monkeypatch.setattr(chat_routes, "get_account_id", lambda user: ACCOUNT)
    monkeypatch.setattr(chat_routes, "get_clerk_user_id", lambda user: "user_123")
    monkeypatch.setattr(chat_routes.quota_guard, "get_quota_status",
                        lambda a, c: {"limit": 7, "used": 4, "remaining": 3, "resets_at": "2026-10-01T00:00:00+00:00"})
    monkeypatch.setattr(chat_routes.chat_service, "list_trip_summaries", lambda a: [{"session_id": "s1"}])

    monkeypatch.setattr(chat_routes.subscription_guard, "get_active_subscription", lambda c: None)
    free = chat_routes.get_dashboard(user=object())
    assert free["plan"] == {"tier": "free", "name": "Free", "expires_at": None}
    assert free["quota"]["used"] == 4 and free["trips"] == [{"session_id": "s1"}]

    monkeypatch.setattr(chat_routes.subscription_guard, "get_active_subscription",
                        lambda c: {"plan_name": "Premium Monthly", "expires_at": "2026-10-15T00:00:00+00:00"})
    paid = chat_routes.get_dashboard(user=object())
    assert paid["plan"] == {"tier": "premium", "name": "Premium Monthly", "expires_at": "2026-10-15T00:00:00+00:00"}


def test_session_ids_are_batched_and_newest_plan_still_wins_across_batches(monkeypatch):
    many = [{"id": f"s{i:03d}", "title": f"t{i}", "pinned": False, "last_message_at": None} for i in range(120)]
    calls = []

    class BatchFake(FakeMessages):
        def in_(self, col, values):
            calls.append(len(values))
            return super().in_(col, values)

    rows = [_row("s000", "2026-09-01T00:00:00Z", rec_cost="1"),
            _row("s000", "2026-09-05T00:00:00Z", rec_cost="2"),   # newest for s000
            _row("s119", "2026-09-03T00:00:00Z", rec_cost="3")]
    monkeypatch.setattr(chat_service, "list_sessions", lambda account_id: many)
    monkeypatch.setattr(chat_service, "_messages_table", lambda: BatchFake(list(rows)))

    trips = {t["session_id"]: t for t in chat_service.list_trip_summaries(ACCOUNT)}

    assert calls == [50, 50, 20]
    assert trips["s000"]["total_cost"] == 2.0 and trips["s119"]["total_cost"] == 3.0