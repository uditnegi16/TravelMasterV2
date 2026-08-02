from fastapi import APIRouter, Depends, HTTPException, Header, Request
import json

from api.payment_schemas import (
    CreateOrderResponse,
    VerifyPaymentResponse,
    VerifyPaymentRequest,
)
from core.auth import get_current_user, get_account_id, get_clerk_user_id
from services.razorpay_service import razorpay_service
from services.subscription_service import subscription_service
from shared.subscription_guard import subscription_guard

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


@router.post(
    "/create-order",
    response_model=CreateOrderResponse,
)
def create_order(user=Depends(get_current_user)):
    order = razorpay_service.create_order()

    # Bind the order to this account NOW, before checkout even opens --
    # this is what verify_payment checks against later. Without this,
    # there's nothing to verify ownership against except the Razorpay
    # signature, which proves the order+payment were legitimately
    # paired by Razorpay but says nothing about who initiated it.
    subscription_service.create_pending_order(
        account_id=get_account_id(user),
        clerk_user_id=get_clerk_user_id(user),
        order_id=order["order_id"],
        amount=order["amount"],
        currency=order["currency"],
    )

    return order


@router.post("/verify", response_model=VerifyPaymentResponse)
def verify_payment(
    request: VerifyPaymentRequest,
    user=Depends(get_current_user),
):
    verified = razorpay_service.verify_payment(
        request.razorpay_order_id,
        request.razorpay_payment_id,
        request.razorpay_signature,
    )

    if not verified:
        raise HTTPException(
            status_code=400,
            detail="Invalid payment signature.",
        )

    account_id = get_account_id(user)
    order = subscription_service.get_order_owner(request.razorpay_order_id)

    if order is None:
        # No pending-order record for this order_id at all -- either a
        # stale/foreign order_id, or create-order was never called for
        # it through this API. Nothing to activate.
        raise HTTPException(status_code=404, detail="Order not found.")

    if order["account_id"] != account_id:
        # The actual fix: an order created by a DIFFERENT account.
        # A valid Razorpay signature alone is not proof of ownership --
        # reject regardless of how cryptographically valid it is.
        raise HTTPException(
            status_code=403,
            detail="This order does not belong to your account.",
        )

    if order["status"] == "active":
        # Idempotent replay: already verified. Confirm success again
        # without touching anything -- no duplicate row, no error.
        return VerifyPaymentResponse(
            verified=True,
            message="Payment already verified.",
        )

    subscription_service.activate_subscription(
        request.razorpay_order_id,
        request.razorpay_payment_id,
    )

    return VerifyPaymentResponse(
        verified=True,
        message="Payment verified successfully.",
    )

@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(...),
):
    # No get_current_user here on purpose — this is called by Razorpay's
    # servers, not a signed-in browser session. The webhook signature
    # check above is the auth mechanism for this route.
    body = await request.body()

    verified = razorpay_service.verify_webhook(
        body,
        x_razorpay_signature,
    )

    if not verified:
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook signature.",
        )

    event = json.loads(body)
    event_type = event.get("event")

    # Reconciliation path: mirrors verify_payment's activation logic,
    # but triggered by Razorpay itself rather than the browser --
    # covers the case where a user's browser closes/crashes after
    # paying but before the client-side verify call completes. Safe to
    # call repeatedly (Razorpay retries webhooks on non-2xx responses)
    # since activate_subscription is itself idempotent.
    if event_type == "payment.captured":
        payload = event.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payload.get("order_id")
        payment_id = payload.get("id")
        if order_id and payment_id:
            order = subscription_service.get_order_owner(order_id)
            if order is not None and order["status"] == "pending":
                subscription_service.activate_subscription(order_id, payment_id)

    return {
        "received": True,
        "event": event_type,
    }

@router.get("/premium/test")
def premium_test(user=Depends(get_current_user)):
    if not subscription_guard.is_premium(get_clerk_user_id(user)):
        raise HTTPException(
            status_code=403,
            detail="Premium subscription required.",
        )

    return {
        "message": "Premium access granted."
    }