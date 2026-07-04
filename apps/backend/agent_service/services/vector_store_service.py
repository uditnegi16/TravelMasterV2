"""
Vector Store Service.

Centralized service responsible for interacting with
the travel_knowledge pgvector table.
"""

from core.supabase_client import supabase


class VectorStoreService:
    """
    Handles storage and retrieval operations
    for the TravelGuru knowledge base.
    """

    def __init__(self) -> None:
        self.client = supabase

    def insert_chunk(
        self,
        chunk: dict,
    ) -> dict:
        """
        Insert one embedded chunk into pgvector.
        """

        response = (
            self.client.table("travel_knowledge")
            .upsert(
                {
                    "chunk_id": chunk["metadata"]["chunk_id"],
                    "title": chunk["metadata"]["title"],
                    "category": chunk["metadata"]["category"],
                    "source_file": chunk["metadata"]["source_file"],
                    "chunk_index": chunk["metadata"]["chunk_index"],
                    "version": chunk["metadata"]["version"],
                    "content": chunk["text"],
                    "embedding": chunk["embedding"],
                },
                on_conflict="chunk_id",
            )
            .execute()
        )

        return response

    def similarity_search(
        self,
        embedding: list[float],
        top_k: int = 5,
    ):
        """
        Perform semantic similarity search.
        """

        response = self.client.rpc(
            "match_travel_knowledge",
            {
                "query_embedding": embedding,
                "match_count": top_k,
            },
        ).execute()

        return response.data