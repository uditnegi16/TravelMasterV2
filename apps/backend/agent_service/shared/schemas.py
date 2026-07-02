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