from retrieval.retriever import SemanticRetriever

retriever = SemanticRetriever()

results = retriever.search(
    "best beaches in goa",
)

print()

print(f"Retrieved: {len(results)} chunks")

print()

for result in results:

    print(result["chunk_id"])
    print(f"Similarity : {result['similarity']:.4f}")
    print(f"Rerank     : {result['rerank_score']:.4f}")
    print(result["content"][:150])
    print("-" * 80)