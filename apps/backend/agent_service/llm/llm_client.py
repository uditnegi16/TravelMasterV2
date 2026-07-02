import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq


# Load environment variables from .env
load_dotenv()


def get_llm() -> ChatGroq:
    """
    Returns the application's primary LLM client.

    Phase 1:
    - Groq only

    Phase 2:
    - Groq with NVIDIA NIM fallback
    """

    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.2,
    )