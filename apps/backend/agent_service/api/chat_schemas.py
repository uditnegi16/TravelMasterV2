from typing import Optional

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    device_id: str
    title: Optional[str] = None


class RenameSessionRequest(BaseModel):
    device_id: str
    title: str


class PinSessionRequest(BaseModel):
    device_id: str
    pinned: bool


class DeviceScopedRequest(BaseModel):
    device_id: str


class SendMessageRequest(BaseModel):
    device_id: str
    query: str
