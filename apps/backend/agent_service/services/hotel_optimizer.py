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

        # BUG FIX (Phase 8 - packages look identical):
        # This used to call estimate_nightly_rate(hotel_budget) for every
        # hotel, which depends only on the trip's overall hotel_budget -
        # NOT on the individual hotel. That collapsed every hotel (a
        # ₹2,500 guesthouse and a ₹12,000 resort alike) onto the exact
        # same nightly rate, which is a big reason Budget/Best Value/
        # Luxury packages ended up looking nearly identical downstream.
        #
        # Fix: use the hotel's own price from search_hotels() as the
        # source of truth, and only fall back to the budget-derived
        # estimate if a hotel is missing a price for some reason.
        nightly_rate = hotel.get("estimated_price_per_night")

        if nightly_rate is None:
            nightly_rate = estimate_nightly_rate(
                hotel_budget,
            )

        total_cost = nightly_rate * nights

        budget_fit = (
            total_cost <= hotel_budget
            if hotel_budget > 0
            else True
        )

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
                "name": hotel.get("name"),

                "address": hotel.get("address"),

                "rating": hotel.get("rating"),

                "booking_url": hotel.get("booking_url"),

                "amenities": hotel.get("amenities", []),

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

    # NOTE (Phase 8.3 - packages look identical):
    # Previously truncated to the top 5 here by a single generic
    # hotel_score, before any profile-specific ranking ran. That reduced
    # every profile (Budget Saver / Best Value / Luxury) to choosing from
    # the same narrow, generically-scored set. The pool is already bounded
    # by hotel_service.search_hotels(), so return it in full here and let
    # rank_hotels_for_profile() (per profile) do the final trimming.
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
PROFILE_WEIGHTS = {
    "Budget Saver": {
        "price": 0.70,
        "rating": 0.15,
        "class": 0.10,
        "budget_fit": 0.05,
    },
    "Best Value": {
        "price": 0.35,
        "rating": 0.30,
        "class": 0.20,
        "budget_fit": 0.15,
    },
    "Luxury": {
        "price": 0.10,
        "rating": 0.40,
        "class": 0.35,
        "budget_fit": 0.15,
    },
}


CLASS_SCORE = {
    "budget": 1,
    "mid_range": 2,
    "luxury": 3,
}


def rank_hotels_for_profile(
    hotels: list[dict[str, Any]],
    profile: str,
) -> list[dict[str, Any]]:

    if not hotels:
        return []

    weights = PROFILE_WEIGHTS[profile]

    max_price = max(
        hotel["estimated_price_per_night"]
        for hotel in hotels
    )

    ranked = []

    for hotel in hotels:

        price_score = 1 - (
            hotel["estimated_price_per_night"] / max_price
        )

        rating_score = (
            hotel.get("rating") or 0
        ) / 5

        class_score = (
            CLASS_SCORE.get(
                hotel["hotel_class"],
                1,
            )
            / 3
        )

        budget_score = (
            1 if hotel["budget_fit"] else 0
        )

        hotel = hotel.copy()

        hotel["profile_score"] = round(
            (
                price_score * weights["price"]
                + rating_score * weights["rating"]
                + class_score * weights["class"]
                + budget_score * weights["budget_fit"]
            )
            * 100,
            2,
        )

        ranked.append(hotel)

    ranked.sort(
        key=lambda h: h["profile_score"],
        reverse=True,
    )

    # Trim to a short list *after* profile-specific ranking, so each
    # package's top pick (and its alternates) genuinely reflects that
    # profile's priorities instead of a generic pre-filtered set.
    return ranked[:5]