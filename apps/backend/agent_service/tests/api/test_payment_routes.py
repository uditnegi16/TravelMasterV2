"""
Issue 6 -- "tests to write first", from the Critical Product and TDD
Backlog.

Route functions are called directly (not via TestClient) -- FastAPI's
@router.post(...) decorators register the function with the router
but don't change the underlying object; it's still a plain callable.
Sidesteps needing the full app import chain (this project's ML
dependencies aren't installable in every environment) while still
exercising the real route logic, not a reimplementation of it.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

ACCOUNT_A = "e5133235-60d4-55bd-8df7-e160b1da006b"  # uuid5(NAMESPACE_DNS, "clerk_user_a")
ACCOUNT_B = "c2aa8f04-ac8a-5211-8c13-5f7df401206e"  # uuid5(NAMESPACE_DNS, "clerk_user_b")


def _fake_user(clerk_sub: str):
    user = MagicMock()
    user.payload = {"sub": clerk_sub}
    return user


def test_create_order_binds_order_to_requesting_account():
    """
    Orders must be bound to the account that requested them at
    creation time -- this is what verify_payment checks against later
    to prevent the account-hijack bug.
    """
    from api import payment_routes

    with patch.object(payment_routes.razorpay_service, "create_order") as mock_create, \
         patch.object(payment_routes.subscription_service, "create_pending_order") as mock_pending:
        mock_create.return_value = {
            "order_id": "order_abc123",
            "amount": 39900,
            "currency": "INR",
            "key_id": "rzp_test_fake",
        }

        result = payment_routes.create_order(user=_fake_user("clerk_user_a"))

    assert result["order_id"] == "order_abc123"
    _, kwargs = mock_pending.call_args
    assert kwargs["order_id"] == "order_abc123"
    # The real Razorpay-returned amount, not a hardcoded literal.
    assert kwargs["amount"] == 39900
    assert kwargs["currency"] == "INR"


def test_verify_payment_rejects_order_belonging_to_a_different_account():
    """
    Given an order belongs to User A
    When User B submits its payment details
    Then User B is not upgraded

    The core fix: a valid Razorpay signature alone used to be treated
    as sufficient. It proves Razorpay legitimately paired the order
    and payment together, but says nothing about who initiated the
    order -- this test is exactly the gap that left open.
    """
    from api import payment_routes
    from api.payment_schemas import VerifyPaymentRequest

    request = VerifyPaymentRequest(
        razorpay_order_id="order_belongs_to_a",
        razorpay_payment_id="pay_123",
        razorpay_signature="fake_valid_signature",
    )

    with patch.object(payment_routes.razorpay_service, "verify_payment", return_value=True), \
         patch.object(payment_routes.subscription_service, "get_order_owner") as mock_owner, \
         patch.object(payment_routes.subscription_service, "activate_subscription") as mock_activate:
        mock_owner.return_value = {
            "subscription_id": "sub-1",
            "account_id": ACCOUNT_A,
            "status": "pending",
            "amount": 39900,
            "currency": "INR",
        }

        with pytest.raises(HTTPException) as exc_info:
            payment_routes.verify_payment(request, user=_fake_user("clerk_user_b"))

    assert exc_info.value.status_code == 403
    mock_activate.assert_not_called()


def test_verify_payment_activates_order_belonging_to_requester():
    from api import payment_routes
    from api.payment_schemas import VerifyPaymentRequest

    request = VerifyPaymentRequest(
        razorpay_order_id="order_belongs_to_a",
        razorpay_payment_id="pay_123",
        razorpay_signature="fake_valid_signature",
    )

    with patch.object(payment_routes.razorpay_service, "verify_payment", return_value=True), \
         patch.object(payment_routes.subscription_service, "get_order_owner") as mock_owner, \
         patch.object(payment_routes.subscription_service, "activate_subscription") as mock_activate:
        mock_owner.return_value = {
            "subscription_id": "sub-1",
            "account_id": ACCOUNT_A,
            "status": "pending",
            "amount": 39900,
            "currency": "INR",
        }

        result = payment_routes.verify_payment(request, user=_fake_user("clerk_user_a"))

    assert result.verified is True
    mock_activate.assert_called_once_with("order_belongs_to_a", "pay_123")


def test_verify_payment_replay_is_idempotent():
    """
    Given one successful payment
    When verification is submitted twice
    Then exactly one subscription exists (i.e., activation doesn't
    fire again on the second call -- it just confirms success).
    """
    from api import payment_routes
    from api.payment_schemas import VerifyPaymentRequest

    request = VerifyPaymentRequest(
        razorpay_order_id="order_belongs_to_a",
        razorpay_payment_id="pay_123",
        razorpay_signature="fake_valid_signature",
    )

    with patch.object(payment_routes.razorpay_service, "verify_payment", return_value=True), \
         patch.object(payment_routes.subscription_service, "get_order_owner") as mock_owner, \
         patch.object(payment_routes.subscription_service, "activate_subscription") as mock_activate:
        mock_owner.return_value = {
            "subscription_id": "sub-1",
            "account_id": ACCOUNT_A,
            "status": "active",  # already activated by a prior call
            "amount": 39900,
            "currency": "INR",
        }

        result = payment_routes.verify_payment(request, user=_fake_user("clerk_user_a"))

    assert result.verified is True
    mock_activate.assert_not_called()


def test_verify_payment_rejects_invalid_signature():
    from api import payment_routes
    from api.payment_schemas import VerifyPaymentRequest

    request = VerifyPaymentRequest(
        razorpay_order_id="order_1",
        razorpay_payment_id="pay_1",
        razorpay_signature="tampered",
    )

    with patch.object(payment_routes.razorpay_service, "verify_payment", return_value=False):
        with pytest.raises(HTTPException) as exc_info:
            payment_routes.verify_payment(request, user=_fake_user("clerk_user_a"))

    assert exc_info.value.status_code == 400


def test_verify_payment_rejects_unknown_order():
    """Order the signature check passed for, but that was never
    created through create_order at all -- nothing to activate."""
    from api import payment_routes
    from api.payment_schemas import VerifyPaymentRequest

    request = VerifyPaymentRequest(
        razorpay_order_id="order_never_created_by_us",
        razorpay_payment_id="pay_1",
        razorpay_signature="fake_valid_signature",
    )

    with patch.object(payment_routes.razorpay_service, "verify_payment", return_value=True), \
         patch.object(payment_routes.subscription_service, "get_order_owner", return_value=None):
        with pytest.raises(HTTPException) as exc_info:
            payment_routes.verify_payment(request, user=_fake_user("clerk_user_a"))

    assert exc_info.value.status_code == 404
