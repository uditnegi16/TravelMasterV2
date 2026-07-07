from __future__ import annotations

from typing import Any


BUDGET_HOTEL_LIMIT = 3000
MID_RANGE_HOTEL_LIMIT = 7000
LUXURY_HOTEL_LIMIT = 15000


def optimize_hotels(
    hotels: list[dict[str, Any]],
    hotel_budget: float,
    duration_days: int,
) -> list[dict[str, Any]]:
    """
    Enrich hotel results with planning metadata.

    This service contains business logic only.
    """

    optimized: list[dict[str, Any]] = []

    nights = max(1, duration_days - 1)

    for hotel in hotels:

        nightly_rate = estimate_nightly_rate(
            hotel_budget,
        )

        total_cost = nightly_rate * nights

        budget_fit = total_cost <= hotel_budget

        hotel_class = classify_hotel(
            nightly_rate,
        )

        score = calculate_score(
            budget_fit,
            hotel_class,
        )

        optimized.append(
            {
                **hotel,

                "estimated_price_per_night": nightly_rate,

                "estimated_total_cost": total_cost,

                "hotel_class": hotel_class,

                "budget_fit": budget_fit,

                "hotel_score": score,
            }
        )

    optimized.sort(
        key=lambda hotel: hotel["hotel_score"],
        reverse=True,
    )

    return optimized


def estimate_nightly_rate(
    hotel_budget: float,
) -> float:

    if hotel_budget <= 0:
        return 0

    return round(hotel_budget / 4, 2)


def classify_hotel(
    nightly_rate: float,
) -> str:

    if nightly_rate <= BUDGET_HOTEL_LIMIT:
        return "budget"

    if nightly_rate <= MID_RANGE_HOTEL_LIMIT:
        return "mid_range"

    return "luxury"


def calculate_score(
    budget_fit: bool,
    hotel_class: str,
) -> float:

    score = 100.0

    if not budget_fit:
        score -= 40

    if hotel_class == "budget":
        score += 5

    elif hotel_class == "mid_range":
        score += 10

    elif hotel_class == "luxury":
        score += 15

    return round(score, 2)