from pydantic import BaseModel, Field


class TripRequest(BaseModel):
    origin: str = ""
    destination: str = ""
    start_date: str = ""
    end_date: str = ""
    duration_days: int = 0
    travelers: int = 1
    budget: str = ""
    trip_type: str = ""
    preferences: list[str] = Field(default_factory=list)
    flight_strategy: str = "prefer_direct"
class FlightOption(BaseModel):
    id: str

    airline: str

    price: float
    currency: str

    origin: str
    destination: str

    origin_city: str
    destination_city: str

    duration: str

    stops: int

    is_direct: bool

    layover_airport: str | None = None
    layover_city: str | None = None

    layover_duration_minutes: int | None = None

    overnight_layover: bool = False

    requires_layover_hotel: bool = False

    estimated_extra_cost: int = 0

    route_score: float

    expires_at: str
class TripItinerary(BaseModel):
    flight: FlightOption | None = None

    hotels: list[dict] = Field(default_factory=list)

    total_flight_cost: float = 0.0

    total_hotel_cost: float = 0.0

    layover_cost: float = 0.0

    total_trip_cost: float = 0.0

    remaining_budget: float = 0.0

    within_budget: bool = True