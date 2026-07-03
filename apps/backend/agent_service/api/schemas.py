from pydantic import BaseModel

from models.trip_response import TripResponseModel


class TripRequest(BaseModel):
    query: str


class TripResponse(BaseModel):
    trip: TripResponseModel