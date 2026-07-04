"""
Semantic retrieval service.
"""

from retrieval.embedder import EmbeddingService
from services.vector_store_service import VectorStoreService
from retrieval.constants import (
    VECTOR_SEARCH_K,
    FINAL_CONTEXT_K,
)
from retrieval.reranker import CrossEncoderReranker
from shared.cache import get_cache, set_cache
from shared.logging_config import logger
import time
class SemanticRetriever:
    """
    Retrieves the most relevant travel knowledge chunks.
    """

    def __init__(self) -> None:
        self.embedder = EmbeddingService()
        self.vector_store = VectorStoreService()
        self.reranker = CrossEncoderReranker()

    def search(
        self,
        query: str,
        top_k: int = FINAL_CONTEXT_K,
    ) -> list[dict]:
        """
        Perform semantic similarity search.
        """
        start = time.perf_counter()
        cache_key = f"travelguru:v2:rag:{query.lower().strip()}"

        cached = get_cache(cache_key)

        if cached:
            logger.info("RAG Cache | HIT")
            logger.info(
                f"RAG Retrieval | {(time.perf_counter()-start):.2f}s"
            )
            return cached

        embedding = self.embedder.embed_text(query)

        results = self.vector_store.similarity_search(
            embedding=embedding,
            top_k=VECTOR_SEARCH_K,
        )

        results = self.reranker.rerank(
            query=query,
            documents=results,
        )

        results = results[:top_k]
        logger.info(
            f"Retrieved {len(results)} knowledge chunks"
        )
        logger.info("RAG Cache | MISS")

        logger.info(
            f"RAG Retrieval | {(time.perf_counter()-start):.2f}s"
        )
        set_cache(
            cache_key,
            results,
            ttl=300,
        )

        return results