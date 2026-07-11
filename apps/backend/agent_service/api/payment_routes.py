from fastapi import APIRouter, Depends, HTTPException, Header, Request
import json

from api.payment_schemas import (
    CreateOrderResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)
from core.auth import get_current_user
from services.razorpay_service import razorpay_service
from services.subscription_service import subscription_service
from shared.subscription_guard import subscription_guard

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


def _clerk_user_id(user) -> str:
    payload = getattr(user, "payload", None) or {}
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


@router.post(
    "/create-order",
    response_model=CreateOrderResponse,
)
def create_order(user=Depends(get_current_user)):
    return razorpay_service.create_order()

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

    import uuid

    # ... inside verify_payment(), before create_subscription:
    account_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, _clerk_user_id(user)))

    subscription_service.create_subscription(
        account_id=account_id,
        clerk_user_id=_clerk_user_id(user),
        order_id=request.razorpay_order_id,
        payment_id=request.razorpay_payment_id,
        amount=399.00,
        currency="INR",
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

    return {
        "received": True,
        "event": event.get("event"),
    }

@router.get("/premium/test")
def premium_test(user=Depends(get_current_user)):
    if not subscription_guard.is_premium(_clerk_user_id(user)):
        raise HTTPException(
            status_code=403,
            detail="Premium subscription required.",
        )

    return {
        "message": "Premium access granted."
    }