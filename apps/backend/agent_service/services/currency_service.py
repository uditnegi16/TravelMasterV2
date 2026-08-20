"""
Real currency conversion, using Frankfurter (api.frankfurter.dev) --
free, open-source, ECB reference rates, no API key required. Same
cost-consciousness pattern as this project's other choices (Open-Meteo
for weather, Nominatim for hotels, faster-whisper for voice): a real,
reliable, zero-signup API rather than a paid one.

Added 2026-08-19 after a real user test: planning a trip to Japan
returned a flight priced in EUR, but the app's entire budget math
(hotel cost, remaining budget, package comparisons) assumes every
number is already in INR -- Duffel's sandbox quotes some
international routes in the airline's native currency, not always
INR the way Indian domestic routes always were. Without conversion,
a EUR-quoted flight was silently understating the true cost by
roughly 10x.

Rates are cached (ECB only publishes once per business day around
16:00 CET -- Frankfurter's own docs are explicit that fetching more
often than that returns identical data), so this adds no real latency
to a real trip-planning request after the first call of the day.
"""

import requests

from shared.cache import get_cache, set_cache
from shared.logging_config import logger

FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"
FRANKFURTER_TIMEOUT = 10

# ECB updates once/business day -- caching for 12 hours is well within
# that freshness window without needing to fetch on every request.
RATE_CACHE_TTL_SECONDS = 12 * 60 * 60

TARGET_CURRENCY = "INR"


def get_exchange_rate(from_currency: str, to_currency: str = TARGET_CURRENCY) -> float | None:
    """
    Returns how many units of `to_currency` one unit of `from_currency`
    is worth, or None if the rate genuinely couldn't be fetched (a
    real API failure, an unrecognized currency code) -- callers decide
    how to handle that honestly rather than this function silently
    returning a fabricated 1:1 rate.
    """
    from_currency = from_currency.upper().strip()
    to_currency = to_currency.upper().strip()

    if from_currency == to_currency:
        return 1.0

    cache_key = f"travelguru:v2:fxrate:{from_currency}:{to_currency}"
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    try:
        response = requests.get(
            FRANKFURTER_URL,
            params={"base": from_currency, "symbols": to_currency},
            timeout=FRANKFURTER_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        rate = data.get("rates", {}).get(to_currency)

        if rate is None:
            logger.warning(
                f"Frankfurter returned no rate for {from_currency}->{to_currency} "
                f"(response: {data})"
            )
            return None

        set_cache(cache_key, rate, ttl=RATE_CACHE_TTL_SECONDS)
        return rate

    except Exception as e:
        logger.warning(f"Currency rate fetch failed for {from_currency}->{to_currency} | {e}")
        return None


def convert_to_inr(amount: float, from_currency: str) -> tuple[float, bool]:
    """
    Returns (converted_amount, was_converted). If the rate can't be
    fetched, returns the ORIGINAL amount unchanged with was_converted
    =False -- callers should treat that as a real signal to flag the
    currency honestly rather than silently trusting an unconverted
    number as if it were INR (the exact bug this module fixes).
    """
    from_currency = (from_currency or "INR").upper().strip()

    if from_currency == TARGET_CURRENCY:
        return amount, True

    rate = get_exchange_rate(from_currency, TARGET_CURRENCY)

    if rate is None:
        return amount, False

    return round(amount * rate, 2), True
