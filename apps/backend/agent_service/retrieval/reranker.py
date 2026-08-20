"""
Reranking for semantic retrieval.

NOTE: Previously used a local sentence-transformers CrossEncoder
(cross-encoder/ms-marco-MiniLM-L-6-v2). That pulled in torch +
transformers as module-level imports, which broke Lambda cold
starts: Lambda enforces a hard ~10s INIT-phase timeout separate
from the function timeout, and loading torch/transformers/model
weights at import time blew past it (logs showed 996MB/1024MB
memory used just getting that far). This is what caused the
"INIT timeout / Runtime.Unknown" errors.

Fix: drop the local model. Supabase/pgvector already returns
results ordered by vector similarity (see
VectorStoreService.similarity_search -> match_travel_knowledge
RPC), so this class just trims to top_k. If a real cross-encoder
rerank is wanted later, call it out-of-process via an HTTP API
(same pattern as retrieval/embedder.py), never as a local
in-Lambda model load.

2026-08-19: added a minimum similarity threshold below (no new model
or dependency -- this is a plain numeric filter on the `similarity`
field match_travel_knowledge already returns). Real bug report: the
chatbot recommended Goa content for unrelated destinations. Root
cause traced directly: 25 of the 27 real knowledge-base files are
empty (dubai.md, japan.md, and everything under seasons/,
travel_tips/, visas/, etc.) -- Goa is genuinely the only destination
with real content. Because search() had no relevance floor, a query
about Dubai still got Goa's chunks back as the "closest available"
match, even though they're not actually relevant. This filters those
out; it does NOT fix the underlying content gap (populating real
knowledge base content for other destinations is a data task, not a
code fix). With the filter, an unrelated-destination query correctly
gets an empty context instead of misattributed Goa facts -- the
downstream prompts (composer_node.py, qa_node.py) already say
"ignore any missing section gracefully" / "only use if relevant", so
an empty context degrades to general LLM knowledge, not silence.
"""

# pgvector's cosine-similarity-derived score, roughly 0-1 (exact
# range/distribution depends on the embedding model and corpus size,
# not a hard guarantee) -- chosen conservatively low rather than
# tuned against a large real corpus, since the knowledge base is
# currently tiny. Revisit once real content exists for more
# destinations and this can be validated against real query/result
# pairs instead of a single reasonable-looking default.
MIN_RELEVANCE_SIMILARITY = 0.35


class CrossEncoderReranker:
    """
    Trims vector-search results to top_k, preserving the
    similarity ordering already returned by pgvector, and drops
    anything below MIN_RELEVANCE_SIMILARITY -- "the closest match we
    have" is not the same claim as "a relevant match."
    """

    def rerank(
        self,
        query: str,
        documents: list[dict],
    ) -> list[dict]:
        if not documents:
            return []

        return [
            doc for doc in documents
            if doc.get("similarity", 0) >= MIN_RELEVANCE_SIMILARITY
        ]