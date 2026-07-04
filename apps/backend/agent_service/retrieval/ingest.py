"""
Knowledge base ingestion pipeline.

Reads markdown files and converts them into
embedded chunks ready for vector storage.
"""

from pathlib import Path

from retrieval.chunker import MarkdownChunker
from retrieval.embedder import EmbeddingService
from retrieval.metadata import MetadataGenerator
from services.vector_store_service import VectorStoreService

class KnowledgeIngestionPipeline:
    """
    Processes a markdown knowledge document into
    embedded chunks.
    """

    def __init__(self) -> None:
        self.chunker = MarkdownChunker()
        self.embedder = EmbeddingService()
        self.vector_store = VectorStoreService()

    def ingest_document(
        self,
        file_path: Path,
    ) -> list[dict]:

        chunks = self.chunker.chunk_document(file_path)

        embeddings = self.embedder.embed_documents(chunks)

        results = []

        for index, (chunk, embedding) in enumerate(
            zip(chunks, embeddings)
        ):
            metadata = MetadataGenerator.build_metadata(
                file_path=file_path,
                chunk_index=index,
            )

            results.append(
                {
                    "text": chunk,
                    "embedding": embedding,
                    "metadata": metadata,
                }
            )

        for chunk in results:
            self.vector_store.insert_chunk(chunk)

        return results