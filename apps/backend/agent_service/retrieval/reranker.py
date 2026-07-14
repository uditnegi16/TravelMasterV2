"""
Reranking for semantic retrieval.

NOTE: Previously used a local sentence-transformers CrossEncoder
(cross-encoder/ms-marco-MiniLM-L-6-v2). That pulled in torch +
transformers as module-level imports, which broke Lambda cold
starts: Lambda enforces a hard ~10s INIT-phase timeout separate
from the function timeout, and loading torch/transformers/model
weights at import time blew past it (logs showed 996MB/1024MB
memory used just getting that far). This is what caused the
"INIT timeout / Runtime.Unknown" errors.

Fix: drop the local model. Supabase/pgvector already returns
results ordered by vector similarity (see
VectorStoreService.similarity_search -> match_travel_knowledge
RPC), so this class just trims to top_k. If a real cross-encoder
rerank is wanted later, call it out-of-process via an HTTP API
(same pattern as retrieval/embedder.py), never as a local
in-Lambda model load.
"""


class CrossEncoderReranker:
    """
    Trims vector-search results to top_k, preserving the
    similarity ordering already returned by pgvector.
    """

    def rerank(
        self,
        query: str,
        documents: list[dict],
    ) -> list[dict]:
        if not documents:
            return []

        return documents