"""
LangGraph RAG retrieval node.
"""

from graph.state import TripPlanState
from retrieval.context_builder import ContextBuilder
from retrieval.retriever import SemanticRetriever


retriever = SemanticRetriever()


def rag_retriever_node(
    state: TripPlanState,
) -> TripPlanState:
    """
    Retrieve relevant travel knowledge and
    attach it to the graph state.
    """

    query = state["user_query"]

    documents = retriever.search(query)

    context = ContextBuilder.build(documents)

    state["retrieved_context"] = context

    return state