class FeatureFlags:
    """
    Centralized premium feature registry.
    """

    PREMIUM_FEATURES = {
        "unlimited_trip_plans": True,
        "premium_ai_planner": True,
        "priority_support": True,
    }

    FREE_FEATURES = {
        "basic_trip_planner": True,
    }

    def is_premium_feature(self, feature_name: str) -> bool:
        return self.PREMIUM_FEATURES.get(
            feature_name,
            False,
        )

    def is_free_feature(self, feature_name: str) -> bool:
        return self.FREE_FEATURES.get(
            feature_name,
            False,
        )


feature_flags = FeatureFlags()