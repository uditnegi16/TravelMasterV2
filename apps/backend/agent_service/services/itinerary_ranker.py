from __future__ import annotations


def score_itinerary(
    itinerary: dict,
) -> float:
    """
    Computes an overall score for a complete itinerary.
    Higher is better.
    """

    score = 100.0

    if not itinerary["within_budget"]:
        score -= 50

    remaining = itinerary["remaining_budget"]

    if remaining > 0:
        score += min(
            remaining / 1000,
            20,
        )

    flight = itinerary.get("flight")

    if flight:

        score += flight.get(
            "route_score",
            0,
        ) * 0.30

    hotels = itinerary.get(
        "hotels",
        [],
    )

    if hotels:

        score += hotels[0].get(
            "hotel_score",
            0,
        ) * 0.20

    return round(score, 2)


def rank_itineraries(
    itineraries: list[dict],
) -> list[dict]:
    """
    Score every itinerary and sort descending.
    """

    ranked = []

    for option in itineraries:

        itinerary = option["itinerary"]

        option["overall_score"] = score_itinerary(
            itinerary,
        )

        ranked.append(option)

    ranked.sort(
        key=lambda x: x["overall_score"],
        reverse=True,
    )

    return ranked