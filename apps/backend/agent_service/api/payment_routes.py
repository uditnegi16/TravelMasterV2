from fastapi import APIRouter, HTTPException
import json

from fastapi import APIRouter, HTTPException, Header, Request
from api.payment_schemas import (
    CreateOrderResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)
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
def create_order():
    return razorpay_service.create_order()

@router.post("/verify",response_model=VerifyPaymentResponse,)
def verify_payment(
    request: VerifyPaymentRequest,
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

    subscription_service.create_subscription(
    account_id="00000000-0000-0000-0000-000000000001",
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
def premium_test():
    account_id = "00000000-0000-0000-0000-000000000001"

    if not subscription_guard.is_premium(account_id):
        raise HTTPException(
            status_code=403,
            detail="Premium subscription required.",
        )

    return {
        "message": "Premium access granted."
    }