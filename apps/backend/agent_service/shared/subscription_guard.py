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


subscription_guard = SubscriptionGuard()