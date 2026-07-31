"""
Issue 3 (PDF delivery) -- tests written first, per this project's TDD
convention.

Root cause being fixed: apps/backend/agent_service/api/chat_routes.py's
download_trip_pdf returned a FileResponse pointing at local/tmp disk.
Behind API Gateway (Lambda), this requires BinaryMediaTypes to correctly
decode the base64-encoded response back to real binary -- verified live on
2026-07-31 that this fails: the browser downloads the *base64 string
itself* as the file, never decoded, because the request's Accept header
doesn't match the configured binary media type. pdf_builder.py's own
docstring already named the intended fix: move to S3 presigned URLs,
which sidesteps API Gateway's binary-response handling entirely (the
browser downloads directly from S3, not through Lambda/API Gateway).

These tests fail against the pre-fix code (build_trip_pdf/download route
return/serve a local file path, no S3 involved) and should pass once the
S3 upload + redirect is implemented.
"""

import os
from unittest.mock import MagicMock, patch

import boto3
import pytest
from moto import mock_aws


@pytest.fixture()
def s3_bucket():
    with mock_aws():
        os.environ["PDF_S3_BUCKET"] = "test-travelmaster-pdfs"
        os.environ["AWS_REGION"] = "ap-south-1"
        client = boto3.client("s3", region_name="ap-south-1")
        client.create_bucket(
            Bucket="test-travelmaster-pdfs",
            CreateBucketConfiguration={"LocationConstraint": "ap-south-1"},
        )
        yield client


def test_upload_pdf_and_get_presigned_url_uploads_to_s3(s3_bucket, tmp_path):
    """
    Given a locally-rendered PDF file
    When it's uploaded via upload_pdf_and_get_presigned_url
    Then the object actually exists in S3
    And a presigned URL is returned pointing at that bucket/key
    """
    from services.pdf_builder import upload_pdf_and_get_presigned_url

    local_pdf = tmp_path / "session123.pdf"
    local_pdf.write_bytes(b"%PDF-1.7 fake pdf content for test")

    url = upload_pdf_and_get_presigned_url("session123", str(local_pdf))

    assert "test-travelmaster-pdfs" in url
    assert "session123" in url

    # The object must genuinely exist in S3 -- not just a URL that looks
    # right. Key matches the pre-existing pdfs/{id}/travelguru_new_trip.pdf
    # convention found live in the real bucket.
    head = s3_bucket.head_object(
        Bucket="test-travelmaster-pdfs",
        Key="pdfs/session123/travelguru_new_trip.pdf",
    )
    assert head["ContentLength"] > 0


def test_upload_pdf_and_get_presigned_url_cleans_up_local_file(s3_bucket, tmp_path):
    """
    Given a locally-rendered PDF file
    When it's uploaded to S3
    Then the local temp copy is deleted afterward
    (avoids /tmp accumulation across warm Lambda container reuse)
    """
    from services.pdf_builder import upload_pdf_and_get_presigned_url

    local_pdf = tmp_path / "session456.pdf"
    local_pdf.write_bytes(b"%PDF-1.7 fake pdf content for test")

    upload_pdf_and_get_presigned_url("session456", str(local_pdf))

    assert not local_pdf.exists()


def test_download_route_returns_presigned_url_as_json(s3_bucket):
    """
    Given a message with trip data, owned by the authenticated caller
    When GET /chat/messages/{id}/pdf is called
    Then the response is JSON containing the S3 presigned URL
    (not an HTTP redirect -- a redirect would require the frontend's
    fetch() to follow it cross-origin and read response.url, which
    depends on the S3 bucket having CORS configured for the frontend's
    origin. JSON keeps this a same-origin API call; the frontend does
    its own window.open() with the returned URL, a top-level navigation
    that never needs CORS. Also not a FileResponse streaming local/tmp
    bytes through API Gateway -- the original bug: base64 response body
    never decoded back to binary.)
    """
    with patch("api.chat_routes.chat_service.get_owned_message") as mock_get_message, \
         patch("api.chat_routes.build_trip_pdf") as mock_build_pdf:
        mock_get_message.return_value = {
            "id": "msg1",
            "trip_data": {"summary": "test trip"},
        }
        mock_build_pdf.return_value = "/tmp/generated_pdfs/msg1.pdf"

        # Import app only after patches are set up so route module picks up
        # the test S3 bucket env var set by the s3_bucket fixture.
        from main import app
        from fastapi.testclient import TestClient
        from core.auth import get_current_user

        # The route requires authentication (Issue 2) -- override the
        # real Clerk dependency rather than hitting Clerk's API in a test.
        fake_user = MagicMock()
        fake_user.payload = {"sub": "test-clerk-user"}
        app.dependency_overrides[get_current_user] = lambda: fake_user

        client = TestClient(app)

        try:
            with patch("api.chat_routes.upload_pdf_and_get_presigned_url") as mock_upload:
                mock_upload.return_value = (
                    "https://test-travelmaster-pdfs.s3.ap-south-1.amazonaws.com/"
                    "trip-pdfs/msg1.pdf?X-Amz-Signature=fake"
                )
                response = client.get("/chat/messages/msg1/pdf")
        finally:
            # Module-level `app` is cached across tests (from main import
            # app resolves to the same object each time) -- clear the
            # override so it doesn't leak into unrelated tests.
            app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    body = response.json()
    assert "s3" in body["url"]
    assert "test-travelmaster-pdfs" in body["url"]
