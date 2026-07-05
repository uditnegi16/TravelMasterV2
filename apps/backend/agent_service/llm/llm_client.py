import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_nvidia_ai_endpoints import ChatNVIDIA

load_dotenv()


def get_primary_llm(streaming: bool = False):
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.2,
        streaming=streaming,
    )


def get_fallback_llm(streaming: bool = False):
    return ChatNVIDIA(
        model="meta/llama-3.3-70b-instruct",
        api_key=os.getenv("NVIDIA_API_KEY"),
        temperature=0.2,
        streaming=streaming,
    )


def get_llm(streaming: bool = False):
    return get_primary_llm(streaming=streaming)