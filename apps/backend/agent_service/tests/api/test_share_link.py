"""
Share links (POST /chat/messages/{id}/share, GET /chat/share/{token}).

Regression: links were generated on the old Amplify address whenever
APP_URL wasn't set (it never was in production). After API Gateway CORS
was locked to https://travel.uditnegi.com, a share page opened on that
old address couldn't load the trip -- every share link broke.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import chat_routes
from core.auth import get_current_user

PROD = "https://travel.uditnegi.com"
OLD = "https://main.d2dqny356lcrsz.amplifyapp.com"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("APP_URL", raising=False)
    monkeypatch.setenv("CLERK_AUTHORIZED_PARTIES", PROD)
    monkeypatch.setattr(chat_routes, "get_account_id", lambda user: "acct-1")
    monkeypatch.setattr(chat_routes.chat_service, "get_owned_message",
                        lambda message_id, account_id: {"id": message_id, "trip_data": {"summary": "x"}})
    monkeypatch.setattr(chat_routes.chat_service, "create_share_token", lambda message_id: "tok123")

    app = FastAPI()
    app.include_router(chat_routes.router)
    app.dependency_overrides[get_current_user] = lambda: {"sub": "user_1"}
    return TestClient(app)


def share(client, origin=None):
    headers = {"Origin": origin} if origin else {}
    r = client.post("/chat/messages/m1/share", headers=headers)
    assert r.status_code == 200
    return r.json()["url"]


def test_link_opens_on_the_site_the_user_shared_from(client):
    assert share(client, PROD) == f"{PROD}/share/tok123"


def test_link_never_uses_the_old_amplify_address_by_default(client):
    url = share(client)  # no Origin header (e.g. server-side caller)
    assert url == f"{PROD}/share/tok123"
    assert "amplifyapp" not in url


def test_forged_origin_cannot_redirect_the_link(client):
    assert share(client, "https://evil.example") == f"{PROD}/share/tok123"


def test_local_dev_links_point_at_local_frontend(client, monkeypatch):
    monkeypatch.setenv("CLERK_AUTHORIZED_PARTIES", f"http://localhost:5173,{PROD}")
    assert share(client, "http://localhost:5173") == "http://localhost:5173/share/tok123"
    # no origin -> first https entry, never the http localhost one
    assert share(client) == f"{PROD}/share/tok123"


def test_app_url_still_wins_when_set(client, monkeypatch):
    monkeypatch.setenv("APP_URL", "https://custom.example/")
    assert share(client, PROD) == "https://custom.example/share/tok123"


def test_falls_back_to_production_domain_when_nothing_is_configured(client, monkeypatch):
    monkeypatch.setenv("CLERK_AUTHORIZED_PARTIES", "")
    assert share(client, OLD) == f"{PROD}/share/tok123"


def test_public_payload_only_contains_what_the_share_page_renders(client, monkeypatch):
    stored = {
        "summary": "s", "recommended": {"profile": "Best Value"}, "itinerary": {}, "multi_itineraries": [],
        "flights": [], "hotels": [], "places": [{"name": "Fort"}], "weather": {"city": "Jaipur"},
        "parsed_trip": {"destination": "Jaipur"},
        # internal planner state -- must not be public
        "flight_categories": {"cheapest": ["huge raw offer blob"]}, "hotel_budget": 1234, "conversation_type": "NEW_TRIP",
    }
    monkeypatch.setattr(chat_routes.chat_service, "get_message_by_share_token",
                        lambda token: {"trip_data": stored, "content": "Your Jaipur plan"})

    body = client.get("/chat/share/tok123").json()

    assert body["summary"] == "Your Jaipur plan"
    assert set(body["trip"]) == {"summary", "recommended", "itinerary", "multi_itineraries",
                                 "flights", "hotels", "places", "weather", "parsed_trip"}
    assert "flight_categories" not in body["trip"]
    assert "hotel_budget" not in body["trip"]
    assert "conversation_type" not in body["trip"]


def test_invalid_or_expired_token_is_410(client, monkeypatch):
    monkeypatch.setattr(chat_routes.chat_service, "get_message_by_share_token", lambda token: None)
    r = client.get("/chat/share/nope")
    assert r.status_code == 410
