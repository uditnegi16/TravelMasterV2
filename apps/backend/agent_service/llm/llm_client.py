import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_nvidia_ai_endpoints import ChatNVIDIA

from shared.logging_config import logger

load_dotenv()


def get_primary_llm():
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.2,
    )


def get_fallback_llm():
    return ChatNVIDIA(
        model="meta/llama-3.3-70b-instruct",
        api_key=os.getenv("NVIDIA_API_KEY"),
        temperature=0.2,
    )
def get_llm():
    """
    Backward compatibility.
    Existing nodes still call get_llm().
    """
    return get_primary_llm()