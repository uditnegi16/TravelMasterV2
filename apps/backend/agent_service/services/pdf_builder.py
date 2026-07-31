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

import logging
from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML
import tempfile
from pathlib import Path
import os
import boto3

logger = logging.getLogger(__name__)

PDF_S3_BUCKET = os.getenv("PDF_S3_BUCKET")
PDF_PRESIGNED_URL_TTL_SECONDS = 900  # 15 minutes -- generous for an
# immediate "click to download" flow, short enough that a leaked/logged
# URL doesn't stay valid indefinitely.

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


def upload_pdf_and_get_presigned_url(session_id: str, local_path: str) -> str:
    """
    Uploads a locally-rendered PDF to S3 and returns a short-lived
    presigned download URL, then deletes the local copy.

    Key convention (pdfs/{id}/travelguru_new_trip.pdf) matches what was
    already found live in the travelmaster-pdfs bucket (9 pre-existing
    UUID-keyed folders, confirmed 2026-07-31) -- a prior version of this
    code evidently had working S3 delivery already; this restores that
    pattern rather than inventing a new one alongside it.

    This is the fix for a real bug found live on 2026-07-31: the
    previous approach (FileResponse streaming local/tmp disk bytes
    through API Gateway) requires API Gateway's BinaryMediaTypes to
    exactly match the request's Accept header to correctly base64-decode
    the response back to real binary. In practice this failed --
    browsers downloaded the raw base64 string as the "PDF", which no
    reader could open. Serving the file directly from S3 sidesteps API
    Gateway's binary-response handling entirely; the browser downloads
    real bytes straight from S3, not through Lambda.

    Raises RuntimeError if PDF_S3_BUCKET isn't configured, rather than
    silently falling back to local-disk serving -- a silent fallback
    would reintroduce the exact bug this function exists to fix.
    """
    if not PDF_S3_BUCKET:
        raise RuntimeError(
            "PDF_S3_BUCKET is not configured. PDF delivery requires S3; "
            "serving local/tmp disk through API Gateway is the bug this "
            "function replaces, not a valid fallback."
        )

    key = f"pdfs/{session_id}/travelguru_new_trip.pdf"
    client = boto3.client("s3", region_name=os.getenv("AWS_REGION", "ap-south-1"))

    client.upload_file(
        local_path,
        PDF_S3_BUCKET,
        key,
        ExtraArgs={"ContentType": "application/pdf"},
    )

    url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": PDF_S3_BUCKET,
            "Key": key,
            # Internal key uses the legacy "travelguru_new_trip.pdf" name
            # (matching the pre-existing pdfs/{id}/ convention found live
            # in the bucket) -- override what the browser actually shows
            # as the downloaded filename.
            "ResponseContentDisposition": 'attachment; filename="TravelMaster-Itinerary.pdf"',
        },
        ExpiresIn=PDF_PRESIGNED_URL_TTL_SECONDS,
    )

    try:
        Path(local_path).unlink()
    except OSError:
        # Cleanup failure shouldn't fail the request -- the presigned URL
        # is already valid and that's what the caller actually needs.
        logger.warning("Failed to clean up local PDF copy at %s", local_path)

    return url