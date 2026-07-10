from fastapi import APIRouter, HTTPException

from api.contact_schemas import ContactRequest
from services.contact_service import save_contact_message

router = APIRouter(
    prefix="/contact",
    tags=["contact"],
)


@router.post("")
def submit_contact_form(
    request: ContactRequest,
):
    try:
        save_contact_message(request)

        return {
            "success": True,
            "message": "Your message has been sent successfully.",
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to submit contact form.",
        ) from exc