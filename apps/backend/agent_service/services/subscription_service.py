from core.supabase_client import supabase


class SubscriptionService:
    """
    Handles subscription persistence.

    Two-phase flow (Issue 6, 2026-08-02): a 'pending' row is created at
    ORDER-creation time, bound to the account that requested it --
    matches the schema's own pre-existing 'pending' status value,
    confirmed already present in the real status CHECK constraint
    before this fix. Verification then looks the row up by order_id
    and only activates it if it belongs to the SAME account making the
    verify request. This is what actually closes the account-hijack
    gap: the old flow only checked the Razorpay signature (proves the
    order+payment were legitimately paired by Razorpay), never who
    initiated the order -- so User B replaying User A's leaked
    order_id/payment_id/signature would have activated premium on
    User B's account instead.

    Idempotency falls out of the same design: activating an
    already-'active' row is a no-op (the UPDATE's WHERE clause only
    matches status='pending'), so a replayed verify request doesn't
    error or create a second row -- it just confirms success again.
    """

    def create_pending_order(
        self,
        account_id: str,
        clerk_user_id: str,
        order_id: str,
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
                    "status": "pending",
                    "razorpay_order_id": order_id,
                    "amount": amount,
                    "currency": currency,
                }
            )
            .execute()
        )

    def get_order_owner(self, order_id: str) -> dict | None:
        """
        Looks up which account a given order_id belongs to, and its
        current status -- used to verify ownership before activating,
        and to detect an already-activated (idempotent replay) case.
        Returns None if the order was never created through
        create_pending_order (i.e., doesn't exist in our records at
        all -- not just "belongs to someone else").
        """
        response = (
            supabase.schema("user_db")
            .table("subscriptions")
            .select("subscription_id,account_id,status,amount,currency")
            .eq("razorpay_order_id", order_id)
            .limit(1)
            .execute()
        )
        rows = getattr(response, "data", None) or []
        return rows[0] if rows else None

    def activate_subscription(self, order_id: str, payment_id: str) -> dict:
        """
        Marks a pending order as active. Only matches rows still in
        'pending' status -- if this order was already activated (a
        replayed verify request), the WHERE clause matches nothing,
        this is a safe no-op, and the caller treats it as "already
        verified" rather than an error.
        """
        return (
            supabase.schema("user_db")
            .table("subscriptions")
            .update(
                {
                    "status": "active",
                    "razorpay_payment_id": payment_id,
                }
            )
            .eq("razorpay_order_id", order_id)
            .eq("status", "pending")
            .execute()
        )


subscription_service = SubscriptionService()