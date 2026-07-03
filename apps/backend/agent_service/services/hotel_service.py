from geopy.geocoders import Nominatim


geolocator = Nominatim(user_agent="travelmaster")


def search_hotels(city: str):
    location = geolocator.geocode(city)

    if location is None:
        return []

    google_hotels_url = (
        f"https://www.google.com/travel/hotels/{city.replace(' ', '%20')}"
    )

    return [
        {
            "city": city,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "booking_url": google_hotels_url,
        }
    ]