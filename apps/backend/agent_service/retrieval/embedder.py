"""
Embedding service for the TravelGuru RAG pipeline.
"""

from sentence_transformers import SentenceTransformer

from retrieval.constants import EMBEDDING_MODEL


# ----------------------------------------------------------
# Singleton embedding model
# ----------------------------------------------------------

_embedding_model = SentenceTransformer(EMBEDDING_MODEL)


class EmbeddingService:
    """
    Generates vector embeddings using a shared embedding model.
    """

    def __init__(self) -> None:
        self.model = _embedding_model

    def embed_text(
        self,
        text: str,
    ) -> list[float]:
        """
        Generate an embedding for a single text.
        """

        embedding = self.model.encode(
            text,
            normalize_embeddings=True,
        )

        return embedding.tolist()

    def embed_documents(
        self,
        documents: list[str],
    ) -> list[list[float]]:
        """
        Generate embeddings for multiple texts.
        """

        embeddings = self.model.encode(
            documents,
            normalize_embeddings=True,
        )

        return embeddings.tolist()