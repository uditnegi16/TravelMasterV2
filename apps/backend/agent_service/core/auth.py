import logging
import os
import uuid

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

def get_account_id(user) -> str:
    """
    Derives the authoritative account_id from an authenticated Clerk
    user -- the SAME derivation already used in payment_routes.py
    (uuid5(NAMESPACE_DNS, clerk_user_id)) and by the RLS policies added
    in Issue 4 (public.current_account_id() in the database, keyed off
    the same JWT `sub` claim). Kept in one place so every caller
    (chat_routes.py, payment_routes.py, anything future) derives the
    identical value -- a second, slightly-different implementation here
    would silently break ownership checks and RLS matching alike.

    Raises 401 rather than returning None/empty if the token has no
    `sub` claim -- every caller already requires get_current_user first,
    so this should be unreachable in practice, but failing loudly here
    is safer than letting a blank identity flow into an ownership check.
    """
    payload = getattr(user, "payload", None) or {}
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, clerk_user_id))


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
