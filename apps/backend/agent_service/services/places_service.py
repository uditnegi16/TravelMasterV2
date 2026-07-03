from geopy.geocoders import Nominatim


def search_places(city: str):

    geolocator = Nominatim(user_agent="travelmaster")

    location = geolocator.geocode(city)

    if location is None:
        return []

    return [
        {
            "name": f"Top Attractions in {city}",
            "latitude": location.latitude,
            "longitude": location.longitude,
            "maps_url": f"https://www.google.com/maps/search/{city.replace(' ','+')}"
        }
    ]