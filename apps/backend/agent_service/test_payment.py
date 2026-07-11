import os
import hmac
import hashlib
import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "http://localhost:8000"
TOKEN = "***REMOVED_CLERK_TEST_JWT***"

headers = {"Authorization": f"Bearer {TOKEN}"}

# 1. Create order
resp = requests.post(f"{BASE_URL}/payments/create-order", headers=headers)
if resp.status_code != 200:
    print("Status:", resp.status_code)
    print("Body:", resp.text)
    exit(1)
order = resp.json()
print("Order:", order)

order_id = order["order_id"]
payment_id = "pay_test_fake123"
key_secret = os.getenv("RAZORPAY_KEY_SECRET")

# 2. Compute signature locally
signature = hmac.new(
    key_secret.encode(),
    f"{order_id}|{payment_id}".encode(),
    hashlib.sha256,
).hexdigest()

# 3. Verify
verify_resp = requests.post(
    f"{BASE_URL}/payments/verify",
    headers=headers,
    json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": signature,
    },
)
print("Verify status:", verify_resp.status_code)
print("Verify response:", verify_resp.json())