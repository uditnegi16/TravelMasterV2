"""
Semantic retrieval service.
"""

print("retriever: imports start")

from retrieval.embedder import EmbeddingService
print("retriever: EmbeddingService imported")

from services.vector_store_service import VectorStoreService
print("retriever: VectorStoreService imported")

from retrieval.constants import (
    VECTOR_SEARCH_K,
    FINAL_CONTEXT_K,
)
print("retriever: constants imported")

from retrieval.reranker import CrossEncoderReranker
print("retriever: CrossEncoderReranker imported")

from shared.cache import get_cache, set_cache
print("retriever: cache imported")

from shared.logging_config import logger
print("retriever: logger imported")

import time

print("retriever: imports complete")


class SemanticRetriever:
    """
    Retrieves the most relevant travel knowledge chunks.
    """

    def __init__(self) -> None:
        print("retriever: __init__ start")

        print("retriever: creating EmbeddingService")
        self.embedder = EmbeddingService()
        print("retriever: EmbeddingService created")

        print("retriever: creating VectorStoreService")
        self.vector_store = VectorStoreService()
        print("retriever: VectorStoreService created")

        print("retriever: creating CrossEncoderReranker")
        self.reranker = CrossEncoderReranker()
        print("retriever: CrossEncoderReranker created")

        print("retriever: __init__ complete")

    def search(
        self,
        query: str,
        top_k: int = FINAL_CONTEXT_K,
    ) -> list[dict]:
        """
        Perform semantic similarity search.
        """
        print(f"retriever: search start ({query})")

        start = time.perf_counter()

        cache_key = f"travelguru:v2:rag:{query.lower().strip()}"

        cached = get_cache(cache_key)

        if cached:
            print("retriever: cache hit")
            logger.info("RAG Cache | HIT")
            logger.info(
                f"RAG Retrieval | {(time.perf_counter()-start):.2f}s"
            )
            return cached

        print("retriever: generating embedding")
        embedding = self.embedder.embed_text(query)

        print("retriever: vector search")
        results = self.vector_store.similarity_search(
            embedding=embedding,
            top_k=VECTOR_SEARCH_K,
        )

        print("retriever: reranking")
        results = self.reranker.rerank(
            query=query,
            documents=results,
        )

        results = results[:top_k]

        print(f"retriever: returning {len(results)} chunks")

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