import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SECRET_KEY"),
)
print(supabase.schema("user_db").table("user_profiles").select("*").limit(1).execute())