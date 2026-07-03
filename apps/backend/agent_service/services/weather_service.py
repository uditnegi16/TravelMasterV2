from geopy.geocoders import Nominatim
import requests


def get_weather(city: str):
    geolocator = Nominatim(user_agent="travelmaster")

    location = geolocator.geocode(city)

    if location is None:
        return {}

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={location.latitude}"
        f"&longitude={location.longitude}"
        "&current=temperature_2m,weather_code"
    )

    data = requests.get(url, timeout=20).json()

    return {
        "city": city,
        "temperature": data["current"]["temperature_2m"],
        "weather_code": data["current"]["weather_code"],
    }