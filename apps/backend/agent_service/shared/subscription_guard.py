from core.supabase_client import supabase


class SubscriptionGuard:
    """
    Checks whether a user has an active premium subscription.
    """

    def is_premium(self, clerk_user_id: str) -> bool:
        response = (
            supabase.schema("user_db")
            .table("subscriptions")
            .select("status")
            .eq("clerk_user_id", clerk_user_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        )

        return len(response.data) > 0

    def get_active_subscription(self, clerk_user_id: str) -> dict | None:
        """
        The active subscription row (plan name + real expiry) for the
        account dashboard, or None on the free plan. Read-only; the
        latest-expiring active row wins if more than one exists.
        """
        response = (
            supabase.schema("user_db")
            .table("subscriptions")
            .select("plan_name,starts_at,expires_at")
            .eq("clerk_user_id", clerk_user_id)
            .eq("status", "active")
            .order("expires_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None


subscription_guard = SubscriptionGuard()