"""
Normalises currency in generated narrative text.

Every money figure the composer receives has already been converted to
INR by currency_service. The prompt says so, but a prompt is a tendency,
not a guarantee: in live testing the model produced "¥8,500/night" for a
rupee figure and "₹27,492 INR" in another reply. The yen version reads
as roughly 100x the real price, which is the kind of error a user acts
on.

This is the deterministic backstop. It only rewrites the symbol or code
attached to a number -- it never touches the number itself, so a
mislabelled amount becomes correctly labelled rather than silently
changed.

Deliberately narrow:
  - Only symbols immediately preceding a digit are treated as currency,
    so "$" in prose or "€" inside a place name is left alone.
  - Currency words are only stripped when they directly follow a rupee
    amount, so "prices are quoted in INR" survives untouched.
"""

from __future__ import annotations

import re

# A currency symbol directly attached to a number. Anything else is
# prose and gets left alone.
_WRONG_SYMBOL = re.compile(
    r"(?<![A-Za-z0-9])"          # not mid-word
    r"(?:¥|\$|€|£|₩|USD\s*|EUR\s*|GBP\s*|JPY\s*)"
    r"(?=\s?[\d])"               # must be labelling a number
)

# "₹27,492 INR" / "₹27,492 rupees" -- the symbol already says it.
_REDUNDANT_CODE = re.compile(
    # \b after "Rs\.?" would not consume the dot, leaving "₹5,000. total".
    r"(₹\s?[\d,]+(?:\.\d+)?)\s*(?:INR\b|Rs\.?|rupees?\b)",
    flags=re.IGNORECASE,
)

# "27,492 INR" with no symbol at all.
_BARE_CODE = re.compile(
    r"(?<![₹\w])([\d,]+(?:\.\d+)?)\s*(?:INR|rupees)\b",
    flags=re.IGNORECASE,
)


def normalise_currency(text: str) -> str:
    """Rewrites money labels to a single rupee convention."""
    if not text:
        return text

    out = _WRONG_SYMBOL.sub("₹", text)
    out = _REDUNDANT_CODE.sub(r"\1", out)
    out = _BARE_CODE.sub(r"₹\1", out)
    return out
