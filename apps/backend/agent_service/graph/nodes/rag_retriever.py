"""
LangGraph RAG retrieval node.
"""

import time

from graph.state import TripPlanState
from retrieval.context_builder import ContextBuilder
from retrieval.retriever import SemanticRetriever
from graph.progress_utils import emit_progress
from shared import metrics

retriever = SemanticRetriever()


def rag_retriever_node(
    state: TripPlanState,
) -> TripPlanState:
    """
    Retrieve relevant travel knowledge and
    attach it to the graph state.
    """

    emit_progress(
        state,
        "rag",
        "started",
        "Searching travel knowledge...",
    )

    started = time.perf_counter()

    try:
        query = state["user_query"]

        documents = retriever.search(query)

        context = ContextBuilder.build(documents)

        state["retrieved_context"] = context

        metrics.record_latency(
            "rag_retrieval",
            (time.perf_counter() - started) * 1000,
            {"doc_count": len(documents) if documents else 0},
        )
        metrics.increment("rag_retrieval_calls")

        emit_progress(
            state,
            "rag",
            "completed",
        )

        return state

    except Exception:
        metrics.increment("rag_retrieval_errors")
        emit_progress(
            state,
            "rag",
            "failed",
        )
        raise