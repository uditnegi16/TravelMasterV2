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
from unittest.mock import patch

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

    # The object must genuinely exist in S3 -- not just a URL that looks right.
    head = s3_bucket.head_object(Bucket="test-travelmaster-pdfs", Key="trip-pdfs/session123.pdf")
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


def test_download_route_redirects_to_s3_not_filestream(s3_bucket):
    """
    Given a message with trip data
    When GET /chat/messages/{id}/pdf is called
    Then the response is a redirect to an S3 URL
    (not a FileResponse streaming local/tmp bytes through API Gateway --
    the actual bug: base64 response body never decoded back to binary).
    """
    with patch("api.chat_routes.chat_service.get_message_by_id") as mock_get_message, \
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

        client = TestClient(app, follow_redirects=False)

        with patch("api.chat_routes.upload_pdf_and_get_presigned_url") as mock_upload:
            mock_upload.return_value = (
                "https://test-travelmaster-pdfs.s3.ap-south-1.amazonaws.com/"
                "trip-pdfs/msg1.pdf?X-Amz-Signature=fake"
            )
            response = client.get("/chat/messages/msg1/pdf")

    assert response.status_code == 307
    assert "s3" in response.headers["location"]
    assert "test-travelmaster-pdfs" in response.headers["location"]
