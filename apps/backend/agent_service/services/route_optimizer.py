from __future__ import annotations

from typing import Any

from services.route_enricher import enrich_flight
from services.route_ranker import score_route

from collections import defaultdict
PROFILE_ROUTE_WEIGHTS = {
    "Budget Saver": {
        "price": 0.60,
        "route": 0.25,
        "stops": 0.15,
    },
    "Best Value": {
        "price": 0.35,
        "route": 0.45,
        "stops": 0.20,
    },
    "Luxury": {
        "price": 0.10,
        "route": 0.65,
        "stops": 0.25,
    },
}
def enrich_routes(
    flights: list[dict[str, Any]],
    budget: str = "",
    strategy: str = "prefer_direct",
) -> dict[str, Any]:
    """
    Orchestrates route enrichment and ranking.

    Responsibilities:
    - Enrich flight metadata
    - Calculate route scores
    - Sort routes

    Contains no business logic.
    """

    enriched_routes: list[dict[str, Any]] = []

    for flight in flights:

        enriched = enrich_flight(flight)

        enriched["route_score"] = score_route(
            enriched,
            budget,
        )

        enriched_routes.append(enriched)

    enriched_routes.sort(
        key=lambda route: route["route_score"],
        reverse=True,
    )

    categorized = categorize_routes(
    enriched_routes
    )

    recommended = select_recommended_route(
    categorized,
    strategy,
    )

    return {
        "all": enriched_routes,
        "categorized": categorized,
        "recommended": recommended,
    }
def categorize_routes(
    flights: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """
    Categorize optimized routes for downstream consumers.
    """

    categorized = defaultdict(list)

    for flight in flights:

        if flight["is_direct"]:
            categorized["direct"].append(flight)
        else:
            categorized["one_stop"].append(flight)

    return dict(categorized)
def select_recommended_route(
    categorized: dict[str, list[dict[str, Any]]],
    strategy: str,
) -> dict[str, Any] | None:
    """
    Select the best route according to the planner strategy.
    """

    direct = categorized.get("direct", [])
    one_stop = categorized.get("one_stop", [])

    if strategy == "direct_only":
        return direct[0] if direct else None

    if strategy == "prefer_direct":
        if direct:
            return direct[0]
        return one_stop[0] if one_stop else None

    if strategy in (
        "allow_one_stop",
        "cheapest_available",
    ):
        candidates = direct + one_stop

        if not candidates:
            return None

        return max(
            candidates,
            key=lambda f: f["route_score"],
        )

    return None
def rank_routes_for_profile(
    flights: list[dict[str, Any]],
    profile: str,
) -> list[dict[str, Any]]:

    if not flights:
        return []

    weights = PROFILE_ROUTE_WEIGHTS[profile]

    max_price = max(
        float(f["price"])
        for f in flights
    )

    ranked = []

    for flight in flights:

        route_score = (
            flight.get("route_score", 0)
            / 100
        )

        price_score = (
            1
            - (
                float(flight["price"])
                / max_price
            )
        )

        stop_score = (
            1
            if flight["is_direct"]
            else max(
                0,
                0.7 - (flight["stops"] * 0.2),
            )
        )

        score = (
            price_score * weights["price"]
            + route_score * weights["route"]
            + stop_score * weights["stops"]
        )

        updated = flight.copy()

        updated["profile_route_score"] = round(
            score * 100,
            2,
        )

        ranked.append(updated)

    ranked.sort(
        key=lambda f: f["profile_route_score"],
        reverse=True,
    )

    return ranked