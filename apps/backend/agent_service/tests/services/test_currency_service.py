"""
Real tests for currency conversion (2026-08-19). A real user test
caught this: an international flight quoted in EUR was silently
treated as if the number were already INR, understating the true
trip cost by roughly 10x -- the whole reason this module exists.
"""

from unittest.mock import MagicMock, patch

from services.currency_service import convert_to_inr, get_exchange_rate


def test_same_currency_needs_no_conversion():
    rate = get_exchange_rate("INR", "INR")
    assert rate == 1.0


def test_convert_to_inr_same_currency_passthrough():
    amount, was_converted = convert_to_inr(1000.0, "INR")
    assert amount == 1000.0
    assert was_converted is True


def test_convert_to_inr_uses_the_real_fetched_rate(monkeypatch):
    from services import currency_service

    with patch.object(currency_service, "get_cache", return_value=None), \
         patch.object(currency_service, "set_cache"), \
         patch.object(currency_service.requests, "get") as mock_get:
        mock_response = MagicMock()
        mock_response.json.return_value = {"rates": {"INR": 91.5}}
        mock_get.return_value = mock_response

        amount, was_converted = convert_to_inr(688.52, "EUR")

    assert was_converted is True
    assert amount == round(688.52 * 91.5, 2)


def test_conversion_failure_returns_original_amount_honestly_flagged():
    """The real fix's core guarantee: never silently pretend a failed
    conversion succeeded. Callers need to know it didn't."""
    from services import currency_service

    with patch.object(currency_service, "get_cache", return_value=None), \
         patch.object(currency_service.requests, "get", side_effect=Exception("network down")):
        amount, was_converted = convert_to_inr(688.52, "EUR")

    assert was_converted is False
    assert amount == 688.52  # unchanged, not silently mangled


def test_rate_is_cached_not_refetched_on_second_call():
    from services import currency_service

    with patch.object(currency_service, "get_cache", return_value=91.5) as mock_get_cache, \
         patch.object(currency_service.requests, "get") as mock_http_get:
        rate = get_exchange_rate("EUR", "INR")

    assert rate == 91.5
    mock_http_get.assert_not_called()  # never hit the real API -- cache hit


def test_unrecognized_currency_returns_none_not_a_fabricated_rate():
    from services import currency_service

    with patch.object(currency_service, "get_cache", return_value=None), \
         patch.object(currency_service, "set_cache"), \
         patch.object(currency_service.requests, "get") as mock_get:
        mock_response = MagicMock()
        mock_response.json.return_value = {"rates": {}}  # no match found
        mock_get.return_value = mock_response

        rate = get_exchange_rate("XYZ", "INR")

    assert rate is None
