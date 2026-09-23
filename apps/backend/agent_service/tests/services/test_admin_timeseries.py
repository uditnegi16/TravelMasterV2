"""
Admin sparklines (UI objective #10): GET /admin/timeseries and the
daily-bucket service behind it.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from services import admin_service


class FakeQuery:
    """Enough of postgrest-py's builder: filters on created_at / role /
    trip_data, ordering, and .range() paging like the real 1,000-row cap."""

    def __init__(self, rows, log):
        self.rows = rows
        self.log = log

    def select(self, cols):
        self.log.append(("select", cols))
        return self

    def eq(self, col, val):
        self.rows = [r for r in self.rows if r.get(col) == val]
        return self

    @property
    def not_(self):
        return self

    def is_(self, col, val):  # only used as not_.is_(col, "null")
        self.rows = [r for r in self.rows if r.get(col) is not None]
        return self

    def gte(self, col, val):
        self.rows = [r for r in self.rows if r[col] >= val]
        return self

    def order(self, col):
        self.rows = sorted(self.rows, key=lambda r: r[col])
        return self

    def range(self, start, end):
        self.log.append(("range", start, end))
        self.rows = self.rows[start : end + 1]
        return self

    def execute(self):
        r = MagicMock()
        r.data = [{"created_at": x["created_at"]} for x in self.rows]
        return r


def _ts(days_ago: int, hour: int = 12) -> str:
    d = datetime.now(timezone.utc).replace(hour=hour, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)
    return d.isoformat()


@pytest.fixture
def fake_db(monkeypatch):
    tables = {"sessions": [], "messages": []}
    log = []

    class Schema:
        def table(self, name):
            return FakeQuery(list(tables[name]), log)

    fake = MagicMock()
    fake.schema.return_value = Schema()
    monkeypatch.setattr(admin_service, "supabase", fake)
    return tables, log


def test_zero_filled_daily_buckets_oldest_first_ending_today(fake_db):
    tables, _ = fake_db
    tables["sessions"] = [{"created_at": _ts(0)}, {"created_at": _ts(0)}, {"created_at": _ts(3)},
                          {"created_at": _ts(30)}]  # outside the window
    tables["messages"] = [
        {"created_at": _ts(1), "role": "user", "trip_data": None},
        {"created_at": _ts(1), "role": "assistant", "trip_data": {"x": 1}},
        {"created_at": _ts(1), "role": "assistant", "trip_data": None},
    ]

    out = admin_service.get_timeseries(days=14)

    assert out["days"] == 14 and out["timezone"] == "UTC" and out["truncated"] is False
    assert len(out["dates"]) == 14
    assert out["dates"][-1] == datetime.now(timezone.utc).date().isoformat()
    s = out["series"]
    assert len(s["sessions"]) == len(s["messages"]) == len(s["trips"]) == 14
    assert s["sessions"][-1] == 2 and s["sessions"][-4] == 1 and sum(s["sessions"]) == 3
    assert s["messages"][-2] == 1 and sum(s["messages"]) == 1  # user messages only
    assert s["trips"][-2] == 1 and sum(s["trips"]) == 1        # only rows with trip_data


def test_pages_past_the_1000_row_cap_instead_of_undercounting(fake_db):
    tables, log = fake_db
    tables["sessions"] = [{"created_at": _ts(2, hour=h % 24)} for h in range(2500)]

    out = admin_service.get_timeseries(days=14)

    assert sum(out["series"]["sessions"]) == 2500
    session_ranges = [e for e in log if e[0] == "range"][:3]
    assert session_ranges == [("range", 0, 999), ("range", 1000, 1999), ("range", 2000, 2999)]


def test_reports_truncation_when_the_hard_cap_is_hit(fake_db, monkeypatch):
    tables, _ = fake_db
    monkeypatch.setattr(admin_service, "TIMESERIES_PAGE_SIZE", 10)
    monkeypatch.setattr(admin_service, "TIMESERIES_MAX_ROWS", 20)
    tables["sessions"] = [{"created_at": _ts(1)} for _ in range(50)]

    out = admin_service.get_timeseries(days=7)

    assert out["truncated"] is True
    assert sum(out["series"]["sessions"]) == 20


def test_only_created_at_is_ever_selected(fake_db):
    _, log = fake_db
    admin_service.get_timeseries(days=7)
    assert {e[1] for e in log if e[0] == "select"} == {"created_at"}


def test_days_is_clamped(fake_db):
    assert admin_service.get_timeseries(days=1)["days"] == 7
    assert admin_service.get_timeseries(days=500)["days"] == 90


def test_route_validates_days_and_returns_the_series(monkeypatch):
    from api import admin_routes
    from core.auth import require_admin

    monkeypatch.setattr(admin_routes.admin_service, "get_timeseries",
                        lambda days: {"days": days, "dates": [], "series": {}, "truncated": False})
    app = FastAPI()
    app.include_router(admin_routes.router)
    app.dependency_overrides[require_admin] = lambda: {"role": "admin"}
    client = TestClient(app)

    assert client.get("/admin/timeseries").json()["days"] == 14
    assert client.get("/admin/timeseries?days=30").json()["days"] == 30
    assert client.get("/admin/timeseries?days=3").status_code == 422
    assert client.get("/admin/timeseries?days=365").status_code == 422