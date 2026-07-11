import logging
import os

from dotenv import load_dotenv
from fastapi import HTTPException, Request
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions

load_dotenv()

logger = logging.getLogger(__name__)

clerk = Clerk(
    bearer_auth=os.getenv("CLERK_SECRET_KEY"),
)

# Comma-separated list of allowed origins, e.g.
# CLERK_AUTHORIZED_PARTIES="http://localhost:5173,https://app.yourdomain.com"
AUTHORIZED_PARTIES = [
    origin.strip()
    for origin in os.getenv("CLERK_AUTHORIZED_PARTIES", "http://localhost:5173").split(",")
    if origin.strip()
]


async def get_current_user(request: Request):
    try:
        request_state = clerk.authenticate_request(
            request,
            AuthenticateRequestOptions(
                authorized_parties=AUTHORIZED_PARTIES,
            ),
        )

        if not request_state.is_signed_in:
            logger.warning(
                "Clerk auth rejected request: status=%s reason=%s",
                request_state.status,
                request_state.reason,
            )
            raise HTTPException(
                status_code=401,
                detail="Unauthorized",
            )

        return request_state

    except HTTPException:
        raise
    except Exception as exc:
        print("CLERK AUTH ERROR:", repr(exc))
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        ) from exc

def _role_from_payload(payload):
    if not payload:
        return "user"

    metadata = payload.get("metadata") or {}
    if isinstance(metadata, dict):
        role = metadata.get("role")
        if role:
            return role

    return payload.get("role", "user")


async def require_admin(request: Request):
    request_state = await get_current_user(request)

    role = _role_from_payload(getattr(request_state, "payload", None))

    if role not in ("admin", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )

    request_state.role = role
    return request_state
