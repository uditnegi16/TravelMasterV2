from core.supabase_client import supabase


class SubscriptionService:
    """
    Handles subscription persistence.
    """

    def create_subscription(
        self,
        account_id: str,
        clerk_user_id: str,
        order_id: str,
        payment_id: str,
        amount: float,
        currency: str,
    ):
        return (
            supabase.schema("user_db")
            .table("subscriptions")
            .insert(
                {
                    "account_id": account_id,
                    "clerk_user_id": clerk_user_id,
                    "plan_name": "premium",
                    "status": "active",
                    "razorpay_order_id": order_id,
                    "razorpay_payment_id": payment_id,
                    "amount": amount,
                    "currency": currency,
                }
            )
            .execute()
        )


subscription_service = SubscriptionService()