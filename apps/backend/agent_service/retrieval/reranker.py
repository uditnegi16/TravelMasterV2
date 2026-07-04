"""
CrossEncoder reranker for semantic retrieval.
"""

from sentence_transformers import CrossEncoder


# ----------------------------------------------------------
# Singleton CrossEncoder model
# ----------------------------------------------------------

_reranker = CrossEncoder(
    "cross-encoder/ms-marco-MiniLM-L-6-v2"
)


class CrossEncoderReranker:
    """
    Re-ranks semantic search results using
    a CrossEncoder model.
    """

    def __init__(self) -> None:
        self.model = _reranker

    def rerank(
        self,
        query: str,
        documents: list[dict],
    ) -> list[dict]:

        if not documents:
            return []

        pairs = [
            (
                query,
                document["content"],
            )
            for document in documents
        ]

        scores = self.model.predict(pairs)

        for document, score in zip(
            documents,
            scores,
        ):
            document["rerank_score"] = float(score)

        documents.sort(
            key=lambda x: x["rerank_score"],
            reverse=True,
        )

        return documents