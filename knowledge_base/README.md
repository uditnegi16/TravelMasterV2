# TravelGuru Knowledge Base

## Purpose

The knowledge base contains curated travel information used by the RAG (Retrieval-Augmented Generation) system.

Unlike live APIs that provide dynamic information such as flights, hotels, weather, and attractions, the knowledge base stores relatively static travel knowledge including:

- Destination guides
- Visa information
- Seasonal travel advice
- Local customs
- Transportation guides
- Food recommendations
- Festivals
- Budget travel tips
- Travel experiences

The AI retrieves relevant knowledge from this repository to enhance trip planning responses with contextual travel expertise.

---

# Folder Structure

knowledge_base/

- destinations/
- visas/
- travel_tips/
- experiences/
- transportation/
- food/
- festivals/

---

# Document Standard

Every markdown file must follow a consistent structure.

Recommended sections:

# Title

## Overview

## Best Time to Visit

## Top Attractions

## Local Food

## Transportation

## Budget

## Safety Tips

## Travel Advice

---

# Writing Rules

- Use factual information.
- Avoid promotional language.
- Keep paragraphs concise.
- Prefer headings over long blocks of text.
- One destination/topic per file.
- Do not duplicate content across files.
- Update information when travel guidance changes.

---

# Metadata

During ingestion every document will automatically receive metadata including:

- title
- category
- topic
- source_file
- chunk_id
- destination
- country
- season
- version
- last_updated

Metadata is generated automatically during the embedding pipeline.

---

# Future Pipeline

Markdown Files

↓

Chunking

↓

Metadata Generation

↓

MiniLM Embeddings

↓

Supabase pgvector

↓

Retriever

↓

CrossEncoder Reranker

↓

LangGraph

↓

Composer