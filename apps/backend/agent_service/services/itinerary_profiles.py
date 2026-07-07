from dataclasses import dataclass


@dataclass(frozen=True)
class ItineraryProfile:
    """
    Defines optimization preferences for generating
    different styles of itineraries.
    """

    name: str

    flight_strategy: str

    hotel_budget_ratio: float

    prioritize_budget: bool

    prioritize_comfort: bool

    prioritize_luxury: bool


BUDGET_PROFILE = ItineraryProfile(
    name="Budget Saver",

    flight_strategy="cheapest_available",

    hotel_budget_ratio=0.40,

    prioritize_budget=True,

    prioritize_comfort=False,

    prioritize_luxury=False,
)


VALUE_PROFILE = ItineraryProfile(
    name="Best Value",

    flight_strategy="allow_one_stop",

    hotel_budget_ratio=0.55,

    prioritize_budget=False,

    prioritize_comfort=True,

    prioritize_luxury=False,
)


LUXURY_PROFILE = ItineraryProfile(
    name="Luxury",

    flight_strategy="direct_only",

    hotel_budget_ratio=0.75,

    prioritize_budget=False,

    prioritize_comfort=False,

    prioritize_luxury=True,
)


ITINERARY_PROFILES = (
    BUDGET_PROFILE,
    VALUE_PROFILE,
    LUXURY_PROFILE,
)