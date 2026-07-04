"""
Metadata generation utilities for the TravelGuru RAG pipeline.
"""

from pathlib import Path


class MetadataGenerator:
    """
    Generates metadata for each chunk extracted from a markdown document.
    """

    @staticmethod
    def build_metadata(
        file_path: Path,
        chunk_index: int,
    ) -> dict:
        """
        Build metadata for a single chunk.
        """

        category = file_path.parent.name

        title = file_path.stem.replace("_", " ").title()

        return {
            "chunk_id": f"{file_path.stem}_{chunk_index}",
            "title": title,
            "category": category,
            "source_file": file_path.name,
            "chunk_index": chunk_index,
            "version": 1,
        }