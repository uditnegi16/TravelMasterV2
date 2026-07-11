"""
Admin Panel — API routes.

Every route here is gated by `require_admin` (core/auth.py): signed in
AND publicMetadata.role in {admin, superadmin}. See docs/admin-panel.md
for the Clerk Dashboard step needed to make the role claim show up on
the session token.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from api.admin_schemas import (
    SetUserBannedRequest,
    SetUserRoleRequest,
    UpdateContactStatusRequest,
)
from core.auth import require_admin
from services import admin_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# -------------------------
# Dashboard (overview landing page)
# -------------------------
@router.get("/dashboard")
def get_dashboard():
    try:
        analytics = admin_service.get_analytics_overview(days=7)
        monitoring = admin_service.get_monitoring_snapshot()
        contact_new = admin_service.list_contact_submissions(status="new")

        return {
            "analytics": analytics,
            "monitoring": monitoring,
            "open_contact_submissions": len(contact_new),
        }
    except Exception as exc:
        logger.exception("Failed to build admin dashboard")
        raise HTTPException(status_code=500, detail="Failed to load dashboard.") from exc


# -------------------------
# Users
# -------------------------
@router.get("/users")
def get_users(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    query: str | None = None,
):
    try:
        return admin_service.list_users(limit=limit, offset=offset, query=query)
    except Exception as exc:
        logger.exception("Failed to list users")
        raise HTTPException(status_code=500, detail="Failed to list users.") from exc


@router.patch("/users/{user_id}/role")
def patch_user_role(user_id: str, body: SetUserRoleRequest):
    try:
        return admin_service.set_user_role(user_id, body.role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to update role for user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="Failed to update role.") from exc


@router.patch("/users/{user_id}/ban")
def patch_user_banned(user_id: str, body: SetUserBannedRequest):
    try:
        return admin_service.set_user_banned(user_id, body.banned)
    except Exception as exc:
        logger.exception("Failed to update ban state for user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="Failed to update user status.") from exc


# -------------------------
# Contact submissions
# -------------------------
@router.get("/contact-submissions")
def get_contact_submissions(status: str | None = None):
    try:
        return {"submissions": admin_service.list_contact_submissions(status=status)}
    except Exception as exc:
        logger.exception("Failed to list contact submissions")
        raise HTTPException(status_code=500, detail="Failed to list submissions.") from exc


@router.patch("/contact-submissions/{submission_id}")
def patch_contact_submission(submission_id: str, body: UpdateContactStatusRequest):
    try:
        return admin_service.update_contact_submission_status(submission_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to update submission_id=%s", submission_id)
        raise HTTPException(status_code=500, detail="Failed to update submission.") from exc


# -------------------------
# Analytics
# -------------------------
@router.get("/analytics")
def get_analytics(days: int = Query(7, ge=1, le=90)):
    try:
        return admin_service.get_analytics_overview(days=days)
    except Exception as exc:
        logger.exception("Failed to build analytics overview")
        raise HTTPException(status_code=500, detail="Failed to load analytics.") from exc


# -------------------------
# Monitoring
# -------------------------
@router.get("/monitoring")
def get_monitoring():
    try:
        return admin_service.get_monitoring_snapshot()
    except Exception as exc:
        logger.exception("Failed to build monitoring snapshot")
        raise HTTPException(status_code=500, detail="Failed to load monitoring data.") from exc


# -------------------------
# MLOps analytics dashboard
# -------------------------
@router.get("/mlops")
def get_mlops():
    try:
        return admin_service.get_mlops_dashboard()
    except Exception as exc:
        logger.exception("Failed to build MLOps dashboard")
        raise HTTPException(status_code=500, detail="Failed to load MLOps dashboard.") from exc
