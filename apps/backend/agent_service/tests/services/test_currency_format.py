"""
Tests for the currency-label backstop.

Every figure the composer receives is already INR. The prompt says so,
but in live output the model still wrote "¥8,500/night" for a rupee
amount — which reads as roughly 100x the real price — and "₹27,492 INR"
elsewhere. This normalises the label deterministically.

It must never change a number, only what the number is labelled as.
"""

import pytest

from services.currency_format import normalise_currency


@pytest.mark.parametrize(
    "text,expected",
    [
        # The actual bug: a rupee amount labelled as yen.
        ("¥8,500 per night", "₹8,500 per night"),
        ("¥34,000 total", "₹34,000 total"),
        ("$1,200 for flights", "₹1,200 for flights"),
        ("€950 per person", "₹950 per person"),
        ("£800 each", "₹800 each"),
        ("USD 1,200 total", "₹1,200 total"),
    ],
)
def test_wrong_symbols_become_rupees(text, expected):
    assert normalise_currency(text) == expected


@pytest.mark.parametrize(
    "text,expected",
    [
        # The other half: symbol and code together.
        ("Flight ₹27,492 INR", "Flight ₹27,492"),
        ("₹12,000 rupees per night", "₹12,000 per night"),
        ("₹5,000 Rs. total", "₹5,000 total"),
    ],
)
def test_redundant_currency_codes_are_dropped(text, expected):
    assert normalise_currency(text) == expected


def test_a_bare_code_gains_the_symbol():
    assert normalise_currency("Total 37,606 INR") == "Total ₹37,606"


@pytest.mark.parametrize(
    "text",
    [
        # Already correct: must pass through untouched.
        "The hotel costs ₹12,000 per night",
        "Flight ₹25,605.91 + hotel ₹12,000 = ₹37,605.91",
        # Prose, not a money label.
        "Prices are quoted in INR throughout",
        "The local currency is the Japanese yen",
        # Symbols that are not labelling a number.
        "Cafe $hop is worth a visit",
        "A shop called Euro€ Style",
        "",
    ],
)
def test_leaves_correct_and_non_monetary_text_alone(text):
    assert normalise_currency(text) == text


def test_never_alters_the_number_itself():
    """A mislabelled amount should become correctly labelled, not
    silently converted -- the figure is already in rupees."""
    out = normalise_currency("¥27,492.50 for the flight")
    assert "27,492.50" in out
    assert out.startswith("₹")


def test_handles_a_full_realistic_reply():
    reply = (
        "You'll fly direct for ¥25,605.91, staying at ₹12,000 INR per "
        "night. Total 37,606 INR. Prices are quoted in INR."
    )
    out = normalise_currency(reply)

    assert "¥" not in out
    assert "₹25,605.91" in out
    assert "₹12,000 per night" in out
    assert "₹37,606" in out
    # The closing prose sentence is not a money label.
    assert "quoted in INR" in out
