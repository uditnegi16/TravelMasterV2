from __future__ import annotations

from typing import Any

DIRECT_FLIGHT_BONUS = 10
OVERNIGHT_PENALTY = 8
HOTEL_REQUIRED_PENALTY = 12


def score_route(
    flight: dict[str, Any],
    budget: str = "",
) -> float:

    price = float(flight["total_amount"])
    price = float(
    flight.get(
        "price",
        flight.get("total_amount", 0),
        )
    )

    budget_value = _parse_budget(budget)
    if budget_value > 0:

        budget_limit = budget_value * 0.35

        if price > budget_limit:
            score -= 15
    score = 100.0

    if price <= 5000:
        score += 15
    elif price <= 10000:
        score += 10
    elif price <= 15000:
        score += 5
    elif price >= 30000:
        score -= 10

    if not flight["is_direct"]:
        score -= DIRECT_FLIGHT_BONUS

    layover = flight.get(
        "layover_duration_minutes"
    )

    if layover is not None:

        hours = layover / 60

        if hours > 2:
            score -= (hours - 2)

    if flight.get("overnight_layover"):
        score -= OVERNIGHT_PENALTY

    if flight.get("requires_layover_hotel"):
        score -= HOTEL_REQUIRED_PENALTY

    return max(0.0, round(score, 2))
import re


def _parse_budget(budget: str) -> float:
    """
    Converts strings like:
    ₹60,000
    60000
    INR 50000

    into float values.
    """

    if not budget:
        return 0

    cleaned = re.sub(r"[^\d.]", "", budget)

    if not cleaned:
        return 0

    return float(cleaned)