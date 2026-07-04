"""
Markdown chunking utilities for the TravelGuru RAG pipeline.

The chunker converts markdown travel documents into
overlapping chunks suitable for embedding.

The implementation is intentionally independent from
the embedding model and vector database.
"""

from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter

from retrieval.constants import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
)


class MarkdownChunker:
    """
    Splits markdown files into overlapping chunks.
    """

    def __init__(self) -> None:
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=[
                "\n# ",
                "\n## ",
                "\n### ",
                "\n\n",
                "\n",
                " ",
                "",
            ],
        )

    def load_document(self, file_path: Path) -> str:
        """
        Read a markdown document.
        """

        return file_path.read_text(
            encoding="utf-8",
        )

    def chunk_document(
        self,
        file_path: Path,
    ) -> list[str]:
        """
        Read and split a markdown file.
        """

        text = self.load_document(file_path)

        chunks = self.splitter.split_text(text)

        return chunks