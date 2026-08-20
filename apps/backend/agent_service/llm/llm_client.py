import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_nvidia_ai_endpoints import ChatNVIDIA

load_dotenv()


def get_primary_llm(streaming: bool = False, timeout: float | None = None):
    return ChatGroq(
        model="openai/gpt-oss-120b",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.2,
        streaming=streaming,
        timeout=timeout,
    )


def get_planner_llm(streaming: bool = False, timeout: float | None = None):
    """
    A single NEW_TRIP/MODIFY_TRIP request calls both this (structured
    field extraction) and get_primary_llm() (narrative generation) --
    on a shared key, both draw from the same 12000 TPM Groq budget
    within the same request, which is the confirmed root cause of the
    rate-limit collisions found in real load testing (2026-08-04):
    single sequential requests, not just concurrent ones, could push
    close to the ceiling because planner + composer stack on the same
    key every time. Same convention as get_classifier_llm(): uses
    GROQ_PLANNER_API_KEY if set (a separate Groq account/key with its
    own daily allowance), otherwise falls back to GROQ_API_KEY, so
    this is a no-op for anyone who hasn't set up a second key yet.
    2026-08-19: model updated from llama-3.3-70b-versatile to
    openai/gpt-oss-120b -- Groq deprecated the former on 2026-06-17
    with a hard shutdown of 2026-08-16, confirmed by hitting a real
    404 model_not_found error in live local testing after the
    shutdown date passed. openai/gpt-oss-120b is Groq's own official
    recommended replacement.
    """
    return ChatGroq(
        model="openai/gpt-oss-120b",
        api_key=os.getenv("GROQ_PLANNER_API_KEY") or os.getenv("GROQ_API_KEY"),
        temperature=0.2,
        streaming=streaming,
        timeout=timeout,
    )


def get_classifier_llm(streaming: bool = False, timeout: float | None = None):
    """
    classify_message() runs on every single chat turn (not just
    modifications), so on a shared key its token usage competes with
    composer/planner/qa calls for the same daily Groq budget - that's
    what kept exhausting the quota before MODIFY_TRIP could even be
    tested. Uses GROQ_CLASSIFIER_API_KEY if it's set (a separate Groq
    account/key with its own daily allowance), otherwise falls back to
    GROQ_API_KEY so this is a no-op for anyone who hasn't set up a
    second key yet.
    """
    return ChatGroq(
        model="openai/gpt-oss-120b",
        api_key=os.getenv("GROQ_CLASSIFIER_API_KEY") or os.getenv("GROQ_API_KEY"),
        temperature=0.2,
        streaming=streaming,
        timeout=timeout,
    )


def get_fallback_llm(streaming: bool = False, timeout: float | None = None):
    # NVIDIA's client defaults to a 60s read timeout, which is fine for
    # a full generated answer but far too long when this is standing in
    # for a quick routing decision (classify_message) - callers doing
    # time-sensitive fallback should pass an explicit shorter timeout.
    return ChatNVIDIA(
        model="meta/llama-3.3-70b-instruct",
        api_key=os.getenv("NVIDIA_API_KEY"),
        temperature=0.2,
        streaming=streaming,
        timeout=timeout,
    )