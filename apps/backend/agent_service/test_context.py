from retrieval.context_builder import ContextBuilder
from retrieval.retriever import SemanticRetriever

retriever = SemanticRetriever()

docs = retriever.search("best beaches in goa")

context = ContextBuilder.build(docs)

print(context)