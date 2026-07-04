from pathlib import Path

from retrieval.ingest import KnowledgeIngestionPipeline


pipeline = KnowledgeIngestionPipeline()

document = Path(
    "../../../knowledge_base/destinations/goa.md"
).resolve()

results = pipeline.ingest_document(document)

print(f"Chunks: {len(results)}")
print()

first = results[0]

print("Metadata")
print(first["metadata"])
print()

print("Chunk Preview")
print(first["text"][:300])
print()

print(f"Embedding Dimension: {len(first['embedding'])}")