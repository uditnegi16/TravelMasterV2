from api.contact_schemas import ContactRequest
from core.supabase_client import supabase

CONTACT_TABLE = "contact_messages"


def save_contact_message(
    request: ContactRequest,
):

    response = (
        supabase.table(CONTACT_TABLE)
        .insert(
            {
                "name": request.name,
                "email": request.email,
                "subject": request.subject,
                "message": request.message,
            }
        )
        .execute()
    )

    return response.data