from pydantic import BaseModel


class FlightCard(BaseModel):
    airline: str
    price: str
    currency: str
    duration: str


class HotelCard(BaseModel):
    city: str
    booking_url: str


class PlaceCard(BaseModel):
    name: str
    maps_url: str


class WeatherCard(BaseModel):
    city: str
    temperature: float
    weather_code: int


class TripResponseModel(BaseModel):
    summary: str
    recommendation: str

    flight: FlightCard
    hotel: HotelCard
    places: list[PlaceCard]
    weather: WeatherCard