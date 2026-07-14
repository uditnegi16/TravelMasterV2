"""
Objective 5.4 — Async PDF Generation.

Renders the ALREADY-COMPUTED trip data (summary, flights, hotels,
places, weather) into a styled PDF itinerary. Deliberately makes no
new LLM calls — reuses exactly what /plan-trip already produced,
per the SDLC decision to keep 5.4 scoped to formatting, not content
generation.

Storage: local disk under generated_pdfs/, chosen as the pre-S3 step
(5.5 will swap this for S3 without touching the rendering logic —
save_pdf()/get_pdf_path() below are the seam for that swap).
"""

import re
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML
import tempfile
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"
OUTPUT_DIR = Path(tempfile.gettempdir()) / "generated_pdfs"

MAX_FLIGHTS_IN_PDF = 5

_DURATION_RE = re.compile(r"PT(?:(\d+)H)?(?:(\d+)M)?")


def _human_duration(value: str) -> str:
    """
    Converts Duffel's ISO 8601 duration strings (e.g. "PT2H25M") into
    a readable "2h 25m" for display in the PDF. Falls back to the
    raw value if it doesn't match the expected pattern rather than
    raising — a cosmetic filter should never break PDF generation.
    """
    if not value:
        return "—"

    match = _DURATION_RE.fullmatch(value)
    if not match:
        return value

    hours, minutes = match.groups()
    parts = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")

    return " ".join(parts) if parts else value


_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)
_env.filters["human_duration"] = _human_duration


def ensure_output_dir() -> None:
    """Called once at app startup (see main.py) and defensively here."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def get_pdf_path(session_id: str) -> Path:
    return OUTPUT_DIR / f"{session_id}.pdf"


def pdf_exists(session_id: str) -> bool:
    return get_pdf_path(session_id).exists()


def _flight_price(flight: dict[str, Any]) -> float:
    try:
        return float(flight.get("total_amount"))
    except (TypeError, ValueError):
        return float("inf")


def _prepare_display_trip(trip: dict[str, Any]) -> dict[str, Any]:
    """
    Shapes the raw trip dict for display purposes only:
    - caps the flight list to the cheapest MAX_FLIGHTS_IN_PDF (the
      real list can be 100+ raw Duffel offers, which is unusable in
      a PDF and was the "dumping all info" bug reported during
      verification)
    - records the true total so the PDF can say "showing 5 of 180"
      instead of silently truncating

    Does not mutate the caller's dict.
    """
    display = dict(trip)

    flights = trip.get("flights") or []
    display["flight_count_total"] = len(flights)
    display["flights"] = sorted(flights, key=_flight_price)[:MAX_FLIGHTS_IN_PDF]

    return display


def build_trip_pdf(session_id: str, trip: dict[str, Any]) -> str:
    """
    Renders `trip` (the same shape returned by response_builder.build_response()
    under the "trip" key) into a PDF and writes it to local disk.

    Returns the absolute file path as a string.

    Raises whatever Jinja2/WeasyPrint raises on bad input — caller
    (routes._generate_pdf_task) is responsible for catching this and
    emitting a "failed" progress event.
    """
    ensure_output_dir()

    display_trip = _prepare_display_trip(trip)

    template = _env.get_template("trip_pdf.html")
    html_string = template.render(trip=display_trip)

    output_path = get_pdf_path(session_id)
    HTML(string=html_string).write_pdf(target=str(output_path))

    return str(output_path)