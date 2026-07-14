"""
Central configuration for the TravelGuru RAG pipeline.

This module stores constants shared across the chunking,
embedding, ingestion and retrieval components.

Keeping configuration centralized avoids hardcoded values
throughout the RAG pipeline.
"""

from pathlib import Path

# ------------------------------------------------------------------
# Knowledge Base
# ------------------------------------------------------------------


PROJECT_ROOT = Path(__file__).resolve().parent.parent

KNOWLEDGE_BASE_DIR = PROJECT_ROOT / "knowledge_base"

# ------------------------------------------------------------------
# Chunking
# ------------------------------------------------------------------

CHUNK_SIZE = 500

CHUNK_OVERLAP = 100

# ------------------------------------------------------------------
# Embeddings
# ------------------------------------------------------------------

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# ------------------------------------------------------------------
# Retrieval
# ------------------------------------------------------------------

VECTOR_SEARCH_K = 10

FINAL_CONTEXT_K = 5