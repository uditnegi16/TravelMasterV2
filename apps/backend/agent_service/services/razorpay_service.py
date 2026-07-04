import os
from requests.auth import HTTPBasicAuth

import requests
import hashlib
import hmac

class RazorpayService:
    """
    Razorpay REST API client.
    Uses official Razorpay HTTP APIs instead of the Python SDK.
    """

    BASE_URL = "https://api.razorpay.com/v1"

    def __init__(self):
        self.key_id = os.getenv("RAZORPAY_KEY_ID")
        self.key_secret = os.getenv("RAZORPAY_KEY_SECRET")

        if not self.key_id or not self.key_secret:
            raise RuntimeError(
                "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing."
            )

        self.auth = HTTPBasicAuth(
            self.key_id,
            self.key_secret,
        )
    

    def create_order(self):
        payload = {
            "amount": int(os.getenv("PREMIUM_PLAN_AMOUNT")),
            "currency": os.getenv("PREMIUM_PLAN_CURRENCY", "INR"),
            "receipt": "travelmaster_premium",
        }

        response = requests.post(
            f"{self.BASE_URL}/orders",
            auth=self.auth,
            json=payload,
            timeout=30,
        )

        response.raise_for_status()

        order = response.json()

        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": self.key_id,
        }
    def verify_payment(
    self,
    order_id: str,
    payment_id: str,
    signature: str,
    ):
        generated_signature = hmac.new(
            self.key_secret.encode(),
            f"{order_id}|{payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(
            generated_signature,
            signature,
        )
    def verify_webhook(
    self,
    body: bytes,
    signature: str,
):
        webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")

        if not webhook_secret:
            raise RuntimeError(
                "RAZORPAY_WEBHOOK_SECRET is not configured."
            )

        generated_signature = hmac.new(
            webhook_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(
            generated_signature,
            signature,
        )


razorpay_service = RazorpayService()