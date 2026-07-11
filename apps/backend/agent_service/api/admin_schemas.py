from typing import Literal, Optional

from pydantic import BaseModel


class SetUserRoleRequest(BaseModel):
    role: Literal["user", "admin", "superadmin"]


class SetUserBannedRequest(BaseModel):
    banned: bool


class UpdateContactStatusRequest(BaseModel):
    status: Literal["new", "in_progress", "resolved"]
