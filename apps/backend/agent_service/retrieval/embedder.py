"""
Embedding service for the TravelGuru RAG pipeline.
Uses HuggingFace Inference API - no local model loading.
Keeps Lambda under 250MB size limit.
"""

import os
import json
import logging
import urllib.request

log = logging.getLogger(__name__)

# HuggingFace Inference API endpoint
HF_API_URL = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction"

class EmbeddingService:
    """
    Generates vector embeddings using HuggingFace Inference API.
    No local model - stays within Lambda 250MB limit.
    Free tier: 30K requests/month (sufficient for portfolio).
    """

    def __init__(self) -> None:
        self.hf_token = os.getenv("HF_TOKEN", "")
        self.api_url = HF_API_URL

    def _get_embedding(self, text: str) -> list[float]:
        """Call HuggingFace Inference API to get embedding."""
        headers = {"Content-Type": "application/json"}
        if self.hf_token:
            headers["Authorization"] = f"Bearer {self.hf_token}"
        
        payload = json.dumps({"inputs": text}).encode("utf-8")
        req = urllib.request.Request(self.api_url, data=payload, headers=headers)
        
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read())
            
            # HF returns nested list for batched input - flatten
            if isinstance(result, list) and len(result) > 0 and isinstance(result[0], list):
                return result[0]
            return result
        except urllib.error.HTTPError as e:
            log.error(f"HF API HTTP error {e.code}: {e.read().decode()}")
            raise RuntimeError(f"Embedding API error: {e.code}") from e
        except Exception as e:
            log.error(f"HF embedding API error: {e}")
            raise

    def embed_text(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        return self._get_embedding(text)

    def embed_documents(self, documents: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts."""
        embeddings = []
        for doc in documents:
            try:
                emb = self._get_embedding(doc)
                embeddings.append(emb)
            except Exception as e:
                log.warning(f"Failed to embed document: {e}, using zero vector")
                # Fallback: zero vector (384-dim to match all-MiniLM-L6-v2)
                embeddings.append([0.0] * 384)
        return embeddings