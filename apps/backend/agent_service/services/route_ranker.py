from __future__ import annotations

from typing import Any

DIRECT_FLIGHT_BONUS = 10
OVERNIGHT_PENALTY = 8
HOTEL_REQUIRED_PENALTY = 12


def score_route(
    flight: dict[str, Any],
    budget: str = "",
) -> float:

    price = float(
        flight.get(
            "price",
            flight.get("total_amount", 0),
        )
    )

    score = 100.0

    budget_value = _parse_budget(budget)
    if budget_value > 0:

        budget_limit = budget_value * 0.35

        if price > budget_limit:
            score -= 15

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
    # Total journey duration (real data from Duffel's slice duration,
    # e.g. "PT3H25M") as a comfort factor - distinct from the layover-only
    # penalty above, since a long direct flight has no layover but is
    # still less comfortable than a short one.
    duration_minutes = _parse_duration_minutes(
        flight.get("duration", "")
    )

    if duration_minutes > 480:
        score -= 12
    elif duration_minutes > 360:
        score -= 6
    elif duration_minutes > 240:
        score -= 3
    return max(0.0, round(score, 2))
import re
def _parse_duration_minutes(duration: str) -> int:
    """
    Converts an ISO 8601 duration string like "PT3H25M" (as returned by
    Duffel) into total minutes. Returns 0 for missing/unparseable input.
    """

    if not duration:
        return 0

    match = re.match(
        r"PT(?:(\d+)H)?(?:(\d+)M)?",
        duration,
    )

    if not match:
        return 0

    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)

    return hours * 60 + minutes

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