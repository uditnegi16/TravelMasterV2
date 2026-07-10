from __future__ import annotations


PROFILE_SCORE = {
    "Budget Saver": {
        "budget": 0.45,
        "flight": 0.25,
        "hotel": 0.30,
    },
    "Best Value": {
        "budget": 0.30,
        "flight": 0.35,
        "hotel": 0.35,
    },
    "Luxury": {
        "budget": 0.10,
        "flight": 0.45,
        "hotel": 0.45,
    },
}


def score_itinerary(
    itinerary: dict,
    profile: str,
    flight_score: float = 0,
    hotel_score: float = 0,
) -> float:

    weights = PROFILE_SCORE[profile]

    score = 0

    if itinerary["within_budget"]:
        score += 100 * weights["budget"]

    score += min(
        itinerary["remaining_budget"] / 1000,
        20,
    ) * weights["budget"]

    score += flight_score * weights["flight"]

    score += hotel_score * weights["hotel"]

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
            option["profile"],
            option.get("flight_score", 0),
            option.get("hotel_score", 0),
        )

        ranked.append(option)

    ranked.sort(
        key=lambda x: x["overall_score"],
        reverse=True,
    )

    return ranked