from graph.state import TripPlanState


def emit_progress(
    state: TripPlanState,
    stage: str,
    status: str,
    message: str | None = None,
) -> None:
    # NOTE (Phase 5 fix): we no longer broadcast through the global
    # progress_emitter singleton here. That was delivering every event
    # to every currently-subscribed session (cross-session leakage) and
    # double-delivering to the originating session (since it was ALSO
    # called directly via state["progress_callback"] below). The
    # per-request callback captured in state is already correctly
    # scoped to this session, so it's the single source of truth.
    callback = state.get("progress_callback")

    if callback:
        try:
            callback(
                {
                    "type": "progress",
                    "stage": stage,
                    "status": status,
                    "message": message,
                }
            )
        except Exception:
            pass


def emit_token(
    state: TripPlanState,
    token: str,
) -> None:
    callback = state.get("progress_callback")

    if callback:
        try:
            callback(
                {
                    "type": "token",
                    "token": token,
                }
            )
        except Exception:
            pass