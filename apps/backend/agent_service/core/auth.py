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
        logger.exception("Clerk auth raised an unexpected error")
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        ) from exc